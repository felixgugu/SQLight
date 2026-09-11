import { invokeCommand } from './api';
import type { DatabaseItem, TableItem, ColumnItem } from '@/types/schema';

export const schemaService = {
  async getDatabases(connectionId: string): Promise<DatabaseItem[]> {
    return invokeCommand<DatabaseItem[]>('get_databases', { connectionId });
  },

  async getTables(
    connectionId: string,
    database?: string,
    schema?: string
  ): Promise<TableItem[]> {
    return invokeCommand<TableItem[]>('get_tables', {
      connectionId,
      database,
      schema,
    });
  },

  async getColumns(
    connectionId: string,
    schema: string,
    table: string,
    database?: string
  ): Promise<ColumnItem[]> {
    return invokeCommand<ColumnItem[]>('get_columns', {
      connectionId,
      schema,
      table,
      database,
    });
  },

  async switchDatabase(connectionId: string, database: string): Promise<void> {
    return invokeCommand<void>('switch_database', { connectionId, database });
  },
};
