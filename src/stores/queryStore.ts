import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { QueryResult, QueryHistoryItem } from '@/types/query';
import { queryService } from '@/services/queryService';

export const useQueryStore = defineStore('query', () => {
  const activeResult = ref<QueryResult | null>(null);
  const isExecuting = ref<boolean>(false);
  const executionError = ref<string | null>(null);
  const history = ref<QueryHistoryItem[]>([]);
  const maxRows = ref<number | null>(10000);

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
      activeResult.value = result;

      const duration = result.executionTimeMs || (Date.now() - startTime);

      // Add to query history
      history.value.unshift({
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        connectionId,
        database,
        sql,
        executedAt: new Date().toLocaleTimeString(),
        executionTimeMs: duration,
        status: result.messages.some((m) => m.level === 'error') ? 'error' : 'success',
        affectedRows: result.affectedRows,
        errorMessage: result.messages.find((m) => m.level === 'error')?.message,
      });

      return result;
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : String(err);
      executionError.value = msg;

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
      activeResult.value = errorResult;

      history.value.unshift({
        id: `hist-${Date.now()}`,
        connectionId,
        database,
        sql,
        executedAt: new Date().toLocaleTimeString(),
        executionTimeMs: duration,
        status: 'error',
        errorMessage: msg,
      });

      return errorResult;
    } finally {
      isExecuting.value = false;
    }
  }

  function clearResults() {
    activeResult.value = null;
    executionError.value = null;
  }

  function clearHistory() {
    history.value = [];
  }

  return {
    activeResult,
    isExecuting,
    executionError,
    history,
    maxRows,
    execute,
    clearResults,
    clearHistory,
  };
});
