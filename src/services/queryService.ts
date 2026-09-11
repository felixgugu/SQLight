import { invokeCommand } from './api';
import type { QueryResult } from '@/types/query';

export const queryService = {
  async executeQuery(connectionId: string, sql: string): Promise<QueryResult> {
    return invokeCommand<QueryResult>('execute_query', {
      connectionId,
      sql,
    });
  },
};
