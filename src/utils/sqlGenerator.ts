import type { CellValue } from '@/types/query';
import { wrapIdentifierIfNeeded } from './sqlParser';

export interface ColumnInfo {
  name: string;
  dataType?: string;
  isPrimaryKey?: boolean;
}

export interface GenerateDmlParams {
  tableName: string;
  schema?: string;
  columns: ColumnInfo[];
  row: CellValue[];
}

/**
 * Formats current date and time in YYYY-MM-DD HH:mm:ss format
 */
export function formatCurrentDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Formats a JavaScript/Tauri cell value into a safe T-SQL literal.
 */
export function formatSqlLiteral(val: CellValue | undefined): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      return 'NULL';
    }
    return String(val);
  }

  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }

  if (typeof val === 'object' && 'type' in val && val.type === 'binary') {
    return 'NULL';
  }

  const str = String(val);
  const escaped = str.replace(/'/g, "''");
  return `N'${escaped}'`;
}

/**
 * Formats the full qualified table name [schema].[tableName] or [tableName]
 */
export function formatTableName(tableName: string, schema?: string): string {
  const cleanTable = tableName.replace(/[\[\]]/g, '').trim();
  const cleanSchema = schema?.replace(/[\[\]]/g, '').trim();

  if (cleanSchema) {
    return `${wrapIdentifierIfNeeded(cleanSchema)}.${wrapIdentifierIfNeeded(cleanTable)}`;
  }
  return wrapIdentifierIfNeeded(cleanTable);
}

/**
 * Builds the WHERE clause for UPDATE / DELETE.
 * If PK columns exist and are present in columns, use PK columns.
 * Otherwise, fallback to ALL columns to prevent unintentional bulk updates/deletions.
 */
export function buildWhereConditions(
  columns: ColumnInfo[],
  row: CellValue[]
): string[] {
  const pkColumns = columns.filter((c) => c.isPrimaryKey);
  const targetCols = pkColumns.length > 0 ? pkColumns : columns;

  const conditions: string[] = [];

  for (const col of targetCols) {
    const colIdx = columns.findIndex((c) => c.name.toLowerCase() === col.name.toLowerCase());
    const val = colIdx >= 0 ? row[colIdx] : null;
    const colName = wrapIdentifierIfNeeded(col.name);

    if (val === null || val === undefined) {
      conditions.push(`${colName} IS NULL`);
    } else {
      conditions.push(`${colName} = ${formatSqlLiteral(val)}`);
    }
  }

  if (conditions.length === 0) {
    return ['1 = 1'];
  }

  return conditions;
}

/**
 * Extracts target schema and table name from a SQL query string
 */
export function parseTargetTableFromSql(
  sql: string
): { schema?: string; tableName: string } | null {
  if (!sql || !sql.trim()) return null;

  const cleanSql = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  // Match FROM, INTO, UPDATE, JOIN, TRUNCATE TABLE followed by [schema].[table] or [table]
  const regex = /\b(?:FROM|INTO|UPDATE|JOIN|TRUNCATE\s+TABLE)\s+(?:(?:\[?([a-zA-Z_][\w]*)\]?)\.)?(?:\[?([a-zA-Z_][\w]*)\]?)/i;
  const match = cleanSql.match(regex);

  if (match) {
    const rawSchema = match[1];
    const rawTable = match[2];

    if (rawTable) {
      const upper = rawTable.toUpperCase();
      if (!['SELECT', 'WHERE', 'VALUES', 'SET', 'GROUP', 'ORDER'].includes(upper)) {
        return {
          schema: rawSchema,
          tableName: rawTable,
        };
      }
    } else if (rawSchema) {
      const upper = rawSchema.toUpperCase();
      if (!['SELECT', 'WHERE', 'VALUES', 'SET', 'GROUP', 'ORDER'].includes(upper)) {
        return {
          tableName: rawSchema,
        };
      }
    }
  }

  return null;
}

/**
 * Generates an INSERT statement for a specific row
 */
export function generateInsertStatement(params: GenerateDmlParams): string {
  const { tableName, schema, columns, row } = params;
  const fullTableName = formatTableName(tableName, schema);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  const colNames = columns.map((c) => wrapIdentifierIfNeeded(c.name)).join(', ');
  const values = columns.map((_, idx) => formatSqlLiteral(row[idx])).join(', ');

  return `${timeHeader}\nINSERT INTO ${fullTableName} (${colNames})\nVALUES (${values});`;
}

/**
 * Generates an UPDATE statement for a specific row
 */
export function generateUpdateStatement(params: GenerateDmlParams): string {
  const { tableName, schema, columns, row } = params;
  const fullTableName = formatTableName(tableName, schema);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  const pkColumns = columns.filter((c) => c.isPrimaryKey);
  // If PK columns exist, update only non-PK columns. If table only has PK or no PK, update all columns.
  const setCols = pkColumns.length > 0 && pkColumns.length < columns.length
    ? columns.filter((c) => !c.isPrimaryKey)
    : columns;

  const setClauses = setCols.map((c) => {
    const idx = columns.findIndex((col) => col.name.toLowerCase() === c.name.toLowerCase());
    const val = idx >= 0 ? row[idx] : null;
    return `  ${wrapIdentifierIfNeeded(c.name)} = ${formatSqlLiteral(val)}`;
  });

  const whereConditions = buildWhereConditions(columns, row);
  const whereClause = whereConditions.join('\n  AND ');

  return `${timeHeader}\nUPDATE ${fullTableName}\nSET\n${setClauses.join(',\n')}\nWHERE ${whereClause};`;
}

/**
 * Generates a DELETE statement for a specific row
 */
export function generateDeleteStatement(params: GenerateDmlParams): string {
  const { tableName, schema, columns, row } = params;
  const fullTableName = formatTableName(tableName, schema);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  const whereConditions = buildWhereConditions(columns, row);
  const whereClause = whereConditions.join('\n  AND ');

  return `${timeHeader}\nDELETE FROM ${fullTableName}\nWHERE ${whereClause};`;
}
