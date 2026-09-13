import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { QueryResult, QueryHistoryItem, QueryResultTab, QueryMessage, ResultSet } from '@/types/query';
import { queryService } from '@/services/queryService';
import { useSettingsStore } from './settingsStore';
import { useWorkspaceStore } from './workspaceStore';
import { parseTargetTableFromSql } from '@/utils/sqlGenerator';
import { splitSqlBatches } from '@/utils/sqlStatementExtractor';
import {
  buildExecutionStats,
  wrapQueryWithPerfTelemetry,
  type ExecutionStatsData,
  type PerfTelemetrySummary,
  type WaitStatItem,
} from '@/utils/statsParser';
import { extractShowPlanXml } from '@/utils/planXmlParser';

let queryExecutionSeq = 0;

export function resetQueryExecutionSeq(): void {
  queryExecutionSeq = 0;
}

const STORAGE_STATS_ENABLED_KEY = 'sqlight_perf_stats_enabled';

function loadSavedStatsSetting(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_STATS_ENABLED_KEY);
    return raw === 'true'; // Default is false!
  } catch {
    return false;
  }
}

function saveStatsSetting(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_STATS_ENABLED_KEY, String(enabled));
  } catch {
    // ignore storage error
  }
}

export const useQueryStore = defineStore('query', () => {
  const resultTabs = ref<QueryResultTab[]>([]);
  const activeResultTabId = ref<string | null>(null);

  const isExecuting = ref<boolean>(false);
  const isCancelling = ref<boolean>(false);
  const currentRequestId = ref<string | null>(null);
  const currentRunningConnectionId = ref<string | null>(null);
  const elapsedExecutionMs = ref<number>(0);
  let executionTimer: ReturnType<typeof setInterval> | null = null;

  function startExecutionTimer() {
    elapsedExecutionMs.value = 0;
    const start = Date.now();
    if (executionTimer) clearInterval(executionTimer);
    executionTimer = setInterval(() => {
      elapsedExecutionMs.value = Date.now() - start;
    }, 100);
  }

  function stopExecutionTimer() {
    if (executionTimer) {
      clearInterval(executionTimer);
      executionTimer = null;
    }
  }

  const executionError = ref<string | null>(null);
  const history = ref<QueryHistoryItem[]>([]);
  const maxRows = ref<number | null>(10000);

  // Performance Analysis & IO Stats State (default false)
  const isStatsEnabled = ref<boolean>(loadSavedStatsSetting());
  const activeExecutionStats = ref<ExecutionStatsData | null>(null);
  const statsHistory = ref<ExecutionStatsData[]>([]);

  // Estimated Execution Plan State (SET SHOWPLAN_ALL ON, default false)
  const isShowplanEnabled = ref<boolean>(false);

  // Actual Execution Plan State (SET STATISTICS XML ON, default false)
  const isActualPlanEnabled = ref<boolean>(false);

  watch(
    isStatsEnabled,
    (newVal) => {
      saveStatsSetting(newVal);
      if (newVal) {
        if (isShowplanEnabled.value) isShowplanEnabled.value = false;
        if (isActualPlanEnabled.value) isActualPlanEnabled.value = false;
      }
    },
    { flush: 'sync' }
  );

  watch(
    isShowplanEnabled,
    (newVal) => {
      if (newVal) {
        if (isStatsEnabled.value) isStatsEnabled.value = false;
        if (isActualPlanEnabled.value) isActualPlanEnabled.value = false;
      }
    },
    { flush: 'sync' }
  );

  watch(
    isActualPlanEnabled,
    (newVal) => {
      if (newVal) {
        if (isStatsEnabled.value) isStatsEnabled.value = false;
        if (isShowplanEnabled.value) isShowplanEnabled.value = false;
      }
    },
    { flush: 'sync' }
  );

  function toggleStatsEnabled() {
    isStatsEnabled.value = !isStatsEnabled.value;
    if (isStatsEnabled.value) {
      isShowplanEnabled.value = false;
      isActualPlanEnabled.value = false;
    }
  }

  function toggleShowplanEnabled() {
    isShowplanEnabled.value = !isShowplanEnabled.value;
    if (isShowplanEnabled.value) {
      isStatsEnabled.value = false;
      isActualPlanEnabled.value = false;
    }
  }

  function toggleActualPlanEnabled() {
    isActualPlanEnabled.value = !isActualPlanEnabled.value;
    if (isActualPlanEnabled.value) {
      isStatsEnabled.value = false;
      isShowplanEnabled.value = false;
    }
  }

  const activeResultTab = computed<QueryResultTab | null>(() => {
    if (!resultTabs.value.length) return null;
    const found = resultTabs.value.find((tab) => tab.id === activeResultTabId.value);
    if (found) return found;
    return resultTabs.value[0] ?? null;
  });

  // Backward compatible activeResult computed from currently selected tab
  const activeResult = computed<QueryResult | null>(() => {
    return activeResultTab.value?.result ?? null;
  });

  function enforceResultLimit() {
    const settingsStore = useSettingsStore();
    const maxTabs = settingsStore.maxResultTabs;

    while (resultTabs.value.length > maxTabs) {
      // Find the oldest unpinned tab from the end
      let targetIndex = -1;
      for (let i = resultTabs.value.length - 1; i >= 0; i--) {
        const tab = resultTabs.value[i];
        if (tab && !tab.isPinned) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex !== -1) {
        resultTabs.value.splice(targetIndex, 1);
      } else {
        // If all tabs are pinned, respect the pins and stop evicting
        break;
      }
    }
  }

  function extractFirstTableName(sql: string): string {
    if (!sql || !sql.trim()) return 'Query';
    const parsed = parseTargetTableFromSql(sql);
    if (parsed?.tableName) {
      return parsed.tableName;
    }

    const cleanSql = sql
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    // Match FROM, INTO, UPDATE, JOIN, TRUNCATE TABLE followed by table name
    const regex = /\b(?:FROM|INTO|UPDATE|JOIN|TRUNCATE\s+TABLE)\s+(?:\[?[\w]+\]?\.)*(?:\[?([\w]+)\]?)/i;
    const match = cleanSql.match(regex);

    if (match && match[1]) {
      const name = match[1].replace(/[\[\]]/g, '').trim();
      if (name && !['SELECT', 'WHERE', 'VALUES', 'SET'].includes(name.toUpperCase())) {
        return name;
      }
    }

    const firstWord = cleanSql.match(/^[a-zA-Z]+/);
    if (firstWord) {
      return firstWord[0].toUpperCase();
    }

    return 'Query';
  }

  function insertNewTab(newTab: QueryResultTab) {
    // Insert right after all pinned tabs (leftmost position among unpinned tabs)
    const firstUnpinnedIdx = resultTabs.value.findIndex((t) => !t.isPinned);
    if (firstUnpinnedIdx === -1) {
      resultTabs.value.push(newTab);
    } else {
      resultTabs.value.splice(firstUnpinnedIdx, 0, newTab);
    }
    activeResultTabId.value = newTab.id;
    enforceResultLimit();
  }

  async function execute(
    connectionId: string,
    database: string,
    sql: string,
    limitOverride?: number | null
  ): Promise<QueryResult | null> {
    if (!sql.trim()) return null;

    const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    currentRequestId.value = reqId;
    currentRunningConnectionId.value = connectionId;
    isExecuting.value = true;
    isCancelling.value = false;
    executionError.value = null;
    startExecutionTimer();
    const startTime = Date.now();

    try {
      const limit = limitOverride !== undefined ? limitOverride : maxRows.value;
      const isShowplan = isShowplanEnabled.value;
      const isActualPlan = isActualPlanEnabled.value;
      let result: QueryResult;
      let actualPlanXml: string | null = null;

      const batches = splitSqlBatches(sql);

      if (batches.length > 1 && !isShowplan && !isActualPlan) {
        // Multi-batch execution (Batch Runner - executes batches sequentially)
        const combinedResultSets: ResultSet[] = [];
        const combinedMessages: QueryMessage[] = [];
        let totalAffectedRows = 0;

        for (let bIdx = 0; bIdx < batches.length; bIdx++) {
          if (isCancelling.value) break;
          const batchSql = batches[bIdx];
          if (!batchSql || !batchSql.trim()) continue;

          const batchEffectiveSql = isStatsEnabled.value
            ? wrapQueryWithPerfTelemetry(batchSql)
            : batchSql;

          const batchRes = await queryService.executeQuery(
            connectionId,
            database,
            batchEffectiveSql,
            limit,
            reqId
          );

          if (batchRes.resultSets && batchRes.resultSets.length > 0) {
            combinedResultSets.push(...batchRes.resultSets);
          }
          if (batchRes.messages) {
            combinedMessages.push(...batchRes.messages);
          }
          totalAffectedRows += batchRes.affectedRows || 0;

          // If a batch produced an error, stop executing subsequent batches
          if (batchRes.messages && batchRes.messages.some((m) => m.level === 'error')) {
            break;
          }
        }

        result = {
          resultSets: combinedResultSets,
          messages: combinedMessages,
          affectedRows: totalAffectedRows,
          executionTimeMs: Date.now() - startTime,
        };
      } else if (isShowplan) {
        try {
          await queryService.executeQuery(connectionId, database, 'SET SHOWPLAN_ALL ON;', null, reqId);
          result = await queryService.executeQuery(connectionId, database, sql, limit, reqId);
        } finally {
          try {
            await queryService.executeQuery(connectionId, database, 'SET SHOWPLAN_ALL OFF;');
          } catch (offErr) {
            console.error('Failed to turn off SET SHOWPLAN_ALL', offErr);
          }
        }
      } else if (isActualPlan) {
        try {
          await queryService.executeQuery(connectionId, database, 'SET STATISTICS XML ON;', null, reqId);
          result = await queryService.executeQuery(connectionId, database, sql, limit, reqId);
        } finally {
          try {
            await queryService.executeQuery(connectionId, database, 'SET STATISTICS XML OFF;');
          } catch (offErr) {
            console.error('Failed to turn off SET STATISTICS XML', offErr);
          }
        }
      } else {
        const effectiveSql = isStatsEnabled.value ? wrapQueryWithPerfTelemetry(sql) : sql;
        result = await queryService.executeQuery(connectionId, database, effectiveSql, limit, reqId);
      }

      const duration = result.executionTimeMs || (Date.now() - startTime);

      // If actual execution plan was enabled, extract the XML showplan
      if (isActualPlan) {
        const extracted = extractShowPlanXml(result.resultSets);
        actualPlanXml = extracted.planXml;
        result.resultSets = extracted.cleanedResultSets;
      }

      let telemetrySummary: PerfTelemetrySummary | null = null;
      const waitStats: WaitStatItem[] = [];

      // If performance analysis was enabled (and not showplan), extract telemetry payloads and remove them from user data grids
      if (!isShowplan && isStatsEnabled.value) {
        result.resultSets = result.resultSets.filter((rs) => {
          const tagCol = rs.columns.find((c) => c.name === '__sqlight_tag__');
          if (!tagCol) return true;

          const tagVal = String(rs.rows[0]?.[tagCol.ordinal] || '');
          if (tagVal === '__SQLIGHT_PERF_SUMMARY__') {
            const row = rs.rows[0];
            if (row) {
              telemetrySummary = {
                elapsedTimeMs: Number(row[1] || 0),
                cpuTimeMs: Number(row[2] || 0),
                logicalReads: Number(row[3] || 0),
                physicalReads: Number(row[4] || 0),
                physicalWrites: Number(row[5] || 0),
              };
            }
            return false;
          }

          if (tagVal === '__SQLIGHT_WAIT_STATS__') {
            for (const r of rs.rows) {
              waitStats.push({
                waitType: String(r[1] || ''),
                waitingTasksCount: Number(r[2] || 0),
                waitTimeMs: Number(r[3] || 0),
                maxWaitTimeMs: Number(r[4] || 0),
              });
            }
            return false;
          }

          return true;
        });

        const stats = buildExecutionStats({
          messages: result.messages.map((m) => m.message),
          telemetrySummary,
          waitStats,
          executionTimeMsFallback: duration,
          querySql: sql,
        });

        activeExecutionStats.value = stats;
        statsHistory.value.unshift(stats);
        if (statsHistory.value.length > 50) {
          statsHistory.value.pop();
        }

        try {
          const workspaceStore = useWorkspaceStore();
          workspaceStore.setBottomPanelTab('stats');
        } catch {
          // ignore if workspaceStore is unavailable (e.g. unit tests)
        }
      } else if (!isShowplan) {
        // If not explicitly enabled, but messages have STATISTICS IO / TIME, parse it gracefully
        const hasIoMsg = result.messages.some((m) =>
          /Table\s+'[^']+'\.\s+Scan\s+count/i.test(m.message)
        );
        if (hasIoMsg) {
          const stats = buildExecutionStats({
            messages: result.messages.map((m) => m.message),
            executionTimeMsFallback: duration,
            querySql: sql,
          });
          activeExecutionStats.value = stats;
        }
      }

      const hasError = result.messages.some((m) => m.level === 'error');
      const rowCount = result.resultSets[0]?.rowCount ?? result.affectedRows ?? 0;
      const timeStr = new Date().toLocaleTimeString();
      const parsed = parseTargetTableFromSql(sql);
      const tableName = parsed?.tableName || extractFirstTableName(sql);
      const schema = parsed?.schema;

      queryExecutionSeq++;
      const seq = queryExecutionSeq;
      const tabTitle = isShowplan
        ? `${seq}.${tableName} [Plan] ${rowCount}r`
        : `${seq}.${tableName} ${rowCount}r`;

      const newTab: QueryResultTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: tabTitle,
        sql,
        result,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount,
        connectionId,
        database,
        tableName,
        schema,
        seq,
        isShowplan,
      };

      insertNewTab(newTab);

      if (isShowplan) {
        try {
          const workspaceStore = useWorkspaceStore();
          workspaceStore.setBottomPanelTab('results');
        } catch {
          // ignore if workspaceStore is unavailable (e.g. unit tests)
        }
      }

      if (actualPlanXml) {
        try {
          const workspaceStore = useWorkspaceStore();
          workspaceStore.addExecutionPlanTab(
            actualPlanXml,
            sql,
            `${tableName} (Actual Plan)`,
            connectionId,
            database
          );
        } catch {
          // ignore if workspaceStore is unavailable (e.g. unit tests)
        }
      }

      // Add to query history
      history.value.unshift({
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        connectionId,
        database,
        sql,
        executedAt: timeStr,
        executionTimeMs: duration,
        status: hasError ? 'error' : 'success',
        affectedRows: result.affectedRows,
        errorMessage: result.messages.find((m) => m.level === 'error')?.message,
      });

      return result;
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : String(err);
      const isCancelled =
        isCancelling.value ||
        msg.toLowerCase().includes('cancelled') ||
        msg.includes('取消');

      if (isCancelled) {
        executionError.value = '查詢已被使用者取消 (Query cancelled by user)';
        const timeStr = new Date().toLocaleTimeString();

        history.value.unshift({
          id: `hist-${Date.now()}`,
          connectionId,
          database,
          sql,
          executedAt: timeStr,
          executionTimeMs: duration,
          status: 'cancelled',
          errorMessage: '查詢已被使用者取消 (Query cancelled by user)',
        });

        const cancelMessage: QueryMessage = {
          level: 'warning',
          message: `🛑 查詢已被使用者中斷與取消 (Query cancelled by user). 耗時: ${(duration / 1000).toFixed(2)} 秒`,
          timestamp: new Date().toISOString(),
        };

        if (activeResultTab.value) {
          activeResultTab.value.result.messages.push(cancelMessage);
        }

        try {
          const workspaceStore = useWorkspaceStore();
          workspaceStore.setBottomPanelTab('messages');
          workspaceStore.showToast('查詢已中斷並取消 (Query cancelled)', 'info', 2500);
        } catch {
          // ignore if workspaceStore unavailable
        }

        return null;
      }

      executionError.value = msg;
      const timeStr = new Date().toLocaleTimeString();
      const parsed = parseTargetTableFromSql(sql);
      const tableName = parsed?.tableName || extractFirstTableName(sql);
      const schema = parsed?.schema;

      queryExecutionSeq++;
      const seq = queryExecutionSeq;
      const tabTitle = `${seq}.${tableName} 0r`;

      const errorResult: QueryResult = {
        resultSets: [],
        messages: [
          {
            level: 'error',
            message: msg,
            timestamp: new Date().toISOString(),
          },
        ],
        affectedRows: 0,
        executionTimeMs: duration,
      };

      const newTab: QueryResultTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: tabTitle,
        sql,
        result: errorResult,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount: 0,
        connectionId,
        database,
        tableName,
        schema,
        seq,
      };

      insertNewTab(newTab);

      history.value.unshift({
        id: `hist-${Date.now()}`,
        connectionId,
        database,
        sql,
        executedAt: timeStr,
        executionTimeMs: duration,
        status: 'error',
        errorMessage: msg,
      });

      return errorResult;
    } finally {
      stopExecutionTimer();
      isExecuting.value = false;
      isCancelling.value = false;
      currentRequestId.value = null;
      currentRunningConnectionId.value = null;
    }
  }

  async function cancelQuery(): Promise<void> {
    if (!isExecuting.value) return;
    isCancelling.value = true;
    try {
      const connId = currentRunningConnectionId.value;
      const reqId = currentRequestId.value;
      if (connId) {
        await queryService.cancelQuery(connId, reqId || undefined);
      }
    } catch (err) {
      console.error('Failed to cancel query:', err);
    }
  }

  function selectResultTab(id: string) {
    activeResultTabId.value = id;
  }

  function togglePinTab(id: string) {
    const index = resultTabs.value.findIndex((t) => t.id === id);
    if (index === -1) return;
    const tab = resultTabs.value[index];
    if (!tab) return;
    tab.isPinned = !tab.isPinned;

    resultTabs.value.splice(index, 1);

    if (tab.isPinned) {
      // Move to the end of pinned tabs (to the left of unpinned tabs)
      let lastPinnedIdx = -1;
      for (let i = resultTabs.value.length - 1; i >= 0; i--) {
        const item = resultTabs.value[i];
        if (item && item.isPinned) {
          lastPinnedIdx = i;
          break;
        }
      }
      resultTabs.value.splice(lastPinnedIdx + 1, 0, tab);
    } else {
      // Unpinned: move to the beginning of unpinned tabs (newest position)
      const firstUnpinnedIdx = resultTabs.value.findIndex((t) => !t.isPinned);
      if (firstUnpinnedIdx === -1) {
        resultTabs.value.push(tab);
      } else {
        resultTabs.value.splice(firstUnpinnedIdx, 0, tab);
      }
    }
  }

  function reorderResultTabs(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= resultTabs.value.length) return;
    if (toIndex < 0 || toIndex >= resultTabs.value.length) return;

    const moved = resultTabs.value[fromIndex];
    if (!moved) return;
    resultTabs.value.splice(fromIndex, 1);
    resultTabs.value.splice(toIndex, 0, moved);
  }

  function deleteResultTab(id: string) {
    // Cannot delete the last remaining tab
    if (resultTabs.value.length <= 1) return;

    const index = resultTabs.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      const isCurrentlyActive = activeResultTabId.value === id;
      resultTabs.value.splice(index, 1);

      if (isCurrentlyActive) {
        // Fallback to the adjacent tab or first tab
        const nextTab = resultTabs.value[index] || resultTabs.value[index - 1] || resultTabs.value[0];
        activeResultTabId.value = nextTab ? nextTab.id : null;
      }
    }
  }

  function renameResultTab(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const tab = resultTabs.value.find((t) => t.id === id);
    if (tab) {
      tab.title = trimmed;
    }
  }

  function clearResults() {
    // Retain pinned tabs if any, or clear all
    resultTabs.value = resultTabs.value.filter((t) => t.isPinned);
    if (resultTabs.value.length > 0) {
      activeResultTabId.value = resultTabs.value[0]?.id ?? null;
    } else {
      activeResultTabId.value = null;
    }
    executionError.value = null;
  }

  function clearHistory() {
    history.value = [];
  }

  function clearExecutionStats() {
    activeExecutionStats.value = null;
  }

  return {
    resultTabs,
    activeResultTabId,
    activeResultTab,
    activeResult,
    isExecuting,
    isCancelling,
    currentRequestId,
    elapsedExecutionMs,
    cancelQuery,
    executionError,
    history,
    maxRows,
    isStatsEnabled,
    isShowplanEnabled,
    isActualPlanEnabled,
    toggleStatsEnabled,
    toggleShowplanEnabled,
    toggleActualPlanEnabled,
    activeExecutionStats,
    statsHistory,
    currentExecutionSeq: computed(() => queryExecutionSeq),
    execute,
    selectResultTab,
    togglePinTab,
    reorderResultTabs,
    deleteResultTab,
    renameResultTab,
    clearResults,
    clearHistory,
    clearExecutionStats,
  };
});
