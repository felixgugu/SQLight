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

  function formatTabTitle(sql: string): string {
    const trimmed = sql.trim().replace(/^(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)+/g, '').trim();
    const firstWordMatch = trimmed.match(/^[a-zA-Z]+/);
    const verb = firstWordMatch ? firstWordMatch[0].toUpperCase() : 'QUERY';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    return `${verb} (${timeStr})`;
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

      // Create new tab and unshift to the leftmost position
      const newTab: QueryResultTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: formatTabTitle(sql),
        sql,
        result,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount,
      };

      resultTabs.value.unshift(newTab);
      activeResultTabId.value = newTab.id;
      enforceResultLimit();

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
        title: formatTabTitle(sql),
        sql,
        result: errorResult,
        executedAt: timeStr,
        isPinned: false,
        durationMs: duration,
        rowCount: 0,
      };

      resultTabs.value.unshift(newTab);
      activeResultTabId.value = newTab.id;
      enforceResultLimit();

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
    const tab = resultTabs.value.find((t) => t.id === id);
    if (tab) {
      tab.isPinned = !tab.isPinned;
    }
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
    deleteResultTab,
    clearResults,
    clearHistory,
  };
});
