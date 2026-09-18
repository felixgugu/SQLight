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

  async cancelQuery(
    connectionId: string,
    requestId?: string
  ): Promise<void> {
    return invokeCommand<void>('cancel_query', {
      connectionId,
      requestId,
    });
  },

  async getConnectionSpid(connectionId: string): Promise<number | null> {
    return invokeCommand<number | null>('get_connection_spid', {
      connectionId,
    });
  },

  async openQueryLogFile(): Promise<string> {
    return invokeCommand<string>('open_query_log_file');
  },

  async getQueryLogPath(): Promise<string> {
    return invokeCommand<string>('get_query_log_path');
  },
};
