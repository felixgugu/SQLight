import { invokeCommand } from './api';
import type { QueryResult } from '@/types/query';
import { buildPerfFixture, parsePerfFixtureSpec } from '@/utils/perfGridFixture';

export const queryService = {
  async executeQuery(
    connectionId: string,
    database: string,
    sql: string,
    maxRows?: number | null,
    requestId?: string,
    timeoutSeconds?: number
  ): Promise<QueryResult> {
    // Dev-only shortcut that lets a synthetic result set stand in for a server round trip so
    // Grid scroll/render baselines can be reproduced on demand. `import.meta.env.DEV` is
    // statically replaced, so this branch and the fixture module are dropped from prod builds.
    const fixture = import.meta.env?.DEV ? parsePerfFixtureSpec(sql) : null;
    if (fixture) {
      return buildPerfFixture(fixture);
    }

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
