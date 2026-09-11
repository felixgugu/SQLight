import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { QueryResult, QueryHistoryItem, QueryResultTab } from '@/types/query';
import { queryService } from '@/services/queryService';
import { useSettingsStore } from './settingsStore';

export const useQueryStore = defineStore('query', () => {
  const resultTabs = ref<QueryResultTab[]>([]);
  const activeResultTabId = ref<string | null>(null);

  const isExecuting = ref<boolean>(false);
  const executionError = ref<string | null>(null);
  const history = ref<QueryHistoryItem[]>([]);
  const maxRows = ref<number | null>(10000);

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
    const limit = Math.max(1, settingsStore.maxResultTabs || 10);

    while (resultTabs.value.length > limit) {
      // Find oldest unpinned tab starting from the right (oldest)
      let targetIndex = -1;
      for (let i = resultTabs.value.length - 1; i >= 0; i--) {
        const item = resultTabs.value[i];
        if (item && !item.isPinned) {
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

    isExecuting.value = true;
    executionError.value = null;
    const startTime = Date.now();

    try {
      const limit = limitOverride !== undefined ? limitOverride : maxRows.value;
      const result = await queryService.executeQuery(connectionId, sql, limit);
      const duration = result.executionTimeMs || (Date.now() - startTime);

      const hasError = result.messages.some((m) => m.level === 'error');
      const rowCount = result.resultSets[0]?.rowCount ?? result.affectedRows ?? 0;
      const timeStr = new Date().toLocaleTimeString();

      const newTab: QueryResultTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: extractFirstTableName(sql),
        sql,
        result,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount,
      };

      insertNewTab(newTab);

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
      executionError.value = msg;
      const timeStr = new Date().toLocaleTimeString();

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
        title: extractFirstTableName(sql),
        sql,
        result: errorResult,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount: 0,
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
      isExecuting.value = false;
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

  return {
    resultTabs,
    activeResultTabId,
    activeResultTab,
    activeResult,
    isExecuting,
    executionError,
    history,
    maxRows,
    execute,
    selectResultTab,
    togglePinTab,
    reorderResultTabs,
    deleteResultTab,
    clearResults,
    clearHistory,
  };
});
