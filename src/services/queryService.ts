import { invokeCommand } from './api';
import type { QueryResult } from '@/types/query';

export const queryService = {
  async executeQuery(
    connectionId: string,
    database: string,
    sql: string,
    maxRows?: number | null,
    requestId?: string,
    timeoutSeconds?: number
  ): Promise<QueryResult> {
    return invokeCommand<QueryResult>('execute_query', {
      connectionId,
      database,
      sql,
      maxRows: maxRows ?? null,
      requestId,
      timeoutSeconds,
    });
  },
};
