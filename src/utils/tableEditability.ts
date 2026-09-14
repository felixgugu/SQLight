import { extractAllTableNamesFromSql, parseTargetTableFromSql } from './sqlGenerator';
import type { ColumnDef, QueryResultTab } from '@/types/query';
import type { TableSchema, ColumnItem } from '@/types/schema';

export interface TableEditabilityResult {
  canEdit: boolean;
  reason?: string;
  shortReason?: string;
  targetTable?: {
    schema: string;
    tableName: string;
  };
  pkColumns: string[];
}

export interface CheckEditabilityOptions {
  tab?: QueryResultTab | null;
  columns: ColumnDef[];
  getTableSchema: (tableName: string, connId?: string, database?: string) => TableSchema | undefined;
}

/**
 * Checks whether the current query result set is eligible for inline cell editing.
 * Rules:
 * 1. Must be from a single identifiable database table (not a multi-table JOIN or raw function/view).
 * 2. The table must have a defined Primary Key (PK). Tables without PK CANNOT be edited.
 * 3. The query result must project all PK columns of the target table.
 */
export function checkTableEditability(options: CheckEditabilityOptions): TableEditabilityResult {
  const { tab, columns, getTableSchema } = options;

  if (!tab) {
    return {
      canEdit: false,
      reason: '無有效查詢結果分頁',
      shortReason: '無分頁',
      pkColumns: [],
    };
  }

  if (!columns || columns.length === 0) {
    return {
      canEdit: false,
      reason: '查詢結果無欄位資料',
      shortReason: '無欄位',
      pkColumns: [],
    };
  }

  const connId = tab.connectionId;
  const database = tab.database;
  const sql = tab.sql || '';

  // 1. Determine target table
  let targetTable: { schema: string; tableName: string } | null = null;

  if (tab.tableName) {
    targetTable = {
      schema: tab.schema || 'dbo',
      tableName: tab.tableName,
    };
  } else if (sql.trim()) {
    const allTables = extractAllTableNamesFromSql(sql);

    if (allTables.length > 1) {
      return {
        canEdit: false,
        reason: '多資料表關聯 (JOIN) 查詢，不支援直接編輯',
        shortReason: '多表查詢',
        pkColumns: [],
      };
    }

    if (allTables.length === 1 && allTables[0]) {
      targetTable = {
        schema: allTables[0].schema || 'dbo',
        tableName: allTables[0].tableName,
      };
    } else {
      const parsedTarget = parseTargetTableFromSql(sql);
      if (parsedTarget) {
        targetTable = {
          schema: parsedTarget.schema || 'dbo',
          tableName: parsedTarget.tableName,
        };
      }
    }
  }

  if (!targetTable) {
    return {
      canEdit: false,
      reason: '無法辨識來源資料表，不支援直接編輯',
      shortReason: '非資料表',
      pkColumns: [],
    };
  }

  // 2. Query table schema from schemaStore
  const tableSchema =
    getTableSchema(targetTable.tableName, connId, database) ||
    getTableSchema(`${targetTable.schema}.${targetTable.tableName}`, connId, database);

  if (!tableSchema) {
    return {
      canEdit: false,
      reason: `尚未載入資料表 [${targetTable.schema}].[${targetTable.tableName}] 之綱要定義`,
      shortReason: '載入綱要中',
      targetTable,
      pkColumns: [],
    };
  }

  if (tableSchema.kind && tableSchema.kind.toUpperCase().includes('VIEW')) {
    return {
      canEdit: false,
      reason: '檢視表 (VIEW) 不支援直接編輯',
      shortReason: '檢視表',
      targetTable,
      pkColumns: [],
    };
  }

  // 3. Extract primary key columns from schema
  const pkColumns = tableSchema.columns
    .filter((c: ColumnItem) => c.isPrimaryKey)
    .map((c: ColumnItem) => c.name);

  if (pkColumns.length === 0) {
    return {
      canEdit: false,
      reason: `資料表 [${targetTable.schema}].[${targetTable.tableName}] 沒有主鍵 (Primary Key)，不支援直接編輯`,
      shortReason: '無主鍵',
      targetTable,
      pkColumns: [],
    };
  }

  // 4. Check if all PK columns exist in projected result set columns
  const projectedColNames = new Set(columns.map((c: ColumnDef) => c.name.toLowerCase()));
  const missingPks = pkColumns.filter((pk: string) => !projectedColNames.has(pk.toLowerCase()));

  if (missingPks.length > 0) {
    return {
      canEdit: false,
      reason: `查詢結果未包含完整主鍵欄位 (${missingPks.join(', ')})，不支援直接編輯`,
      shortReason: '缺少 PK 欄位',
      targetTable,
      pkColumns,
    };
  }

  // All checks pass
  return {
    canEdit: true,
    targetTable,
    pkColumns,
  };
}
