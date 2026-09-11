import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { schemaService } from '@/services/schemaService';
import { useConnectionStore } from './connectionStore';
import type { TableSchema, ColumnItem } from '@/types/schema';

export const useSchemaStore = defineStore('schema', () => {
  const schemasByDb = reactive<Record<string, TableSchema[]>>({});
  const loadingByDb = reactive<Record<string, boolean>>({});

  function dbKey(connId: string, database: string): string {
    return `${connId}:${database}`;
  }

  async function loadDatabaseSchema(
    connId: string,
    database: string,
    force = false
  ): Promise<TableSchema[]> {
    if (!connId || !database) return [];
    const key = dbKey(connId, database);

    if (!force && schemasByDb[key] !== undefined) {
      return schemasByDb[key];
    }

    loadingByDb[key] = true;
    try {
      const schema = await schemaService.getDatabaseSchema(connId, database);
      schemasByDb[key] = schema;
      return schema;
    } catch (err) {
      console.warn(`[schemaStore] Failed to load schema for ${key}:`, err);
      return schemasByDb[key] ?? [];
    } finally {
      loadingByDb[key] = false;
    }
  }

  function getSchema(connId?: string, database?: string): TableSchema[] {
    const connStore = useConnectionStore();
    const cId = connId || connStore.activeConnectionId;
    const db = database || connStore.activeDatabase;
    if (!cId || !db) return [];
    return schemasByDb[dbKey(cId, db)] ?? [];
  }

  function getTable(
    tableName: string,
    connId?: string,
    database?: string
  ): TableSchema | undefined {
    const cleanName = tableName.replace(/[\[\]]/g, '').toLowerCase();
    const tables = getSchema(connId, database);
    return tables.find(
      (t) =>
        t.name.toLowerCase() === cleanName ||
        `${t.schema}.${t.name}`.toLowerCase() === cleanName
    );
  }

  function getColumnsForTable(
    tableName: string,
    connId?: string,
    database?: string
  ): ColumnItem[] {
    const table = getTable(tableName, connId, database);
    return table ? table.columns : [];
  }

  function isDatabaseLoaded(connId: string, database: string): boolean {
    return schemasByDb[dbKey(connId, database)] !== undefined;
  }

  return {
    schemasByDb,
    loadingByDb,
    loadDatabaseSchema,
    getSchema,
    getTable,
    getColumnsForTable,
    isDatabaseLoaded,
  };
});
