import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { schemaService } from '@/services/schemaService';
import { queryService } from '@/services/queryService';
import { useConnectionStore } from './connectionStore';
import type { TableSchema, ColumnItem, RoutineItem, TableItem } from '@/types/schema';
import type { QuickFinderItem } from '@/utils/fuzzySearch';

export const useSchemaStore = defineStore('schema', () => {
  const schemasByDb = reactive<Record<string, TableSchema[]>>({});
  const loadingByDb = reactive<Record<string, boolean>>({});

  const tablesByDb = reactive<Record<string, TableItem[]>>({});
  const loadingTablesByDb = reactive<Record<string, boolean>>({});

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

  async function loadDatabaseTables(
    connId: string,
    database: string,
    force = false
  ): Promise<TableItem[]> {
    if (!connId || !database) return [];
    const key = dbKey(connId, database);

    if (!force && tablesByDb[key] !== undefined) {
      return tablesByDb[key];
    }

    loadingTablesByDb[key] = true;
    try {
      const tables = await schemaService.getTables(connId, database);
      tablesByDb[key] = tables;
      return tables;
    } catch (err) {
      console.warn(`[schemaStore] Failed to load tables for ${key}:`, err);
      tablesByDb[key] = [];
      return [];
    } finally {
      loadingTablesByDb[key] = false;
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
      const res = await queryService.executeQuery(connId, database, sql);
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
      const res = await queryService.executeQuery(connId, database, sql);
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

  function getDatabaseObjects(connId?: string, database?: string): QuickFinderItem[] {
    const connStore = useConnectionStore();
    const cId = connId || connStore.activeConnectionId;
    const db = database || connStore.activeDatabase;
    if (!cId || !db) return [];

    const key = dbKey(cId, db);
    const rawTables = tablesByDb[key] || [];
    const rawRoutines = routinesByDb[key] || [];

    const items: QuickFinderItem[] = [];

    for (const t of rawTables) {
      const isView = t.kind.toUpperCase().includes('VIEW');
      items.push({
        id: `${isView ? 'view' : 'table'}:${t.schema}.${t.name}`,
        schema: t.schema,
        name: t.name,
        type: isView ? 'view' : 'table',
        database: db,
        connId: cId,
      });
    }

    for (const r of rawRoutines) {
      const isProc = r.kind === 'PROCEDURE';
      items.push({
        id: `${isProc ? 'procedure' : 'function'}:${r.schema}.${r.name}`,
        schema: r.schema,
        name: r.name,
        type: isProc ? 'procedure' : 'function',
        database: db,
        connId: cId,
      });
    }

    return items;
  }

  async function ensureDatabaseObjectsLoaded(
    connId: string,
    database: string,
    force = false
  ): Promise<QuickFinderItem[]> {
    if (!connId || !database) return [];
    await Promise.all([
      loadDatabaseTables(connId, database, force),
      loadDatabaseRoutines(connId, database, force),
    ]);
    return getDatabaseObjects(connId, database);
  }

  return {
    schemasByDb,
    loadingByDb,
    tablesByDb,
    loadingTablesByDb,
    routinesByDb,
    loadingRoutinesByDb,
    loadDatabaseSchema,
    loadDatabaseTables,
    loadDatabaseRoutines,
    getObjectDefinition,
    getSchema,
    getTable,
    getColumnsForTable,
    isDatabaseLoaded,
    getDatabaseObjects,
    ensureDatabaseObjectsLoaded,
  };
});
