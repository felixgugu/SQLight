import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { schemaService } from '@/services/schemaService';
import { queryService } from '@/services/queryService';
import { useConnectionStore } from './connectionStore';
import type { TableSchema, ColumnItem, RoutineItem } from '@/types/schema';

export const useSchemaStore = defineStore('schema', () => {
  const schemasByDb = reactive<Record<string, TableSchema[]>>({});
  const loadingByDb = reactive<Record<string, boolean>>({});

  const routinesByDb = reactive<Record<string, RoutineItem[]>>({});
  const loadingRoutinesByDb = reactive<Record<string, boolean>>({});

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

  async function loadDatabaseRoutines(
    connId: string,
    database: string,
    force = false
  ): Promise<RoutineItem[]> {
    if (!connId || !database) return [];
    const key = dbKey(connId, database);

    if (!force && routinesByDb[key] !== undefined) {
      return routinesByDb[key];
    }

    loadingRoutinesByDb[key] = true;
    try {
      const sql = `SELECT ROUTINE_SCHEMA, ROUTINE_NAME, ROUTINE_TYPE FROM [${database}].INFORMATION_SCHEMA.ROUTINES ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME;`;
      const res = await queryService.executeQuery(connId, sql);
      const rows = res.resultSets[0]?.rows || [];
      const routines: RoutineItem[] = rows.map((r) => {
        const schema = String(r[0] || 'dbo');
        const name = String(r[1] || '');
        const rawType = String(r[2] || '').toUpperCase();
        const kind: 'PROCEDURE' | 'FUNCTION' = rawType.includes('PROCEDURE') ? 'PROCEDURE' : 'FUNCTION';
        return { schema, name, kind };
      });
      routinesByDb[key] = routines;
      return routines;
    } catch (err) {
      console.warn(`[schemaStore] Failed to load routines for ${key}:`, err);
      routinesByDb[key] = [];
      return [];
    } finally {
      loadingRoutinesByDb[key] = false;
    }
  }

  async function getObjectDefinition(
    connId: string,
    database: string,
    schema: string,
    name: string
  ): Promise<string | null> {
    try {
      const sql = `USE [${database}]; SELECT OBJECT_DEFINITION(OBJECT_ID(N'[${schema}].[${name}]')) AS [def];`;
      const res = await queryService.executeQuery(connId, sql);
      const val = res.resultSets[0]?.rows[0]?.[0];
      if (val && typeof val === 'string') {
        return val;
      }
      return null;
    } catch (err) {
      console.warn(`[schemaStore] Failed to get object definition for [${database}].[${schema}].[${name}]:`, err);
      return null;
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
    routinesByDb,
    loadingRoutinesByDb,
    loadDatabaseSchema,
    loadDatabaseRoutines,
    getObjectDefinition,
    getSchema,
    getTable,
    getColumnsForTable,
    isDatabaseLoaded,
  };
});
