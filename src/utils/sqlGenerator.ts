import type { CellValue } from '@/types/query';

export interface ColumnInfo {
  name: string;
  dataType?: string;
  isPrimaryKey?: boolean;
  isIdentity?: boolean;
}

export interface GenerateDmlParams {
  tableName: string;
  schema?: string;
  database?: string;
  columns: ColumnInfo[];
  row: CellValue[];
  primaryKeyColumns?: string[];
}

/**
 * Escapes an identifier by enclosing it in square brackets and doubling any closing brackets.
 */
export function escapeIdentifier(name: string): string {
  return `[${name.replace(/\]/g, ']]')}]`;
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
    if (Math.abs(val) > Number.MAX_SAFE_INTEGER || (Number.isInteger(val) && !Number.isSafeInteger(val))) {
      throw new Error(`Imprecise integer (${val}) cannot safely be formatted as a SQL literal`);
    }
    return String(val);
  }

  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }

  if (typeof val === 'object' && 'type' in val && val.type === 'binary') {
    throw new Error('Binary placeholders cannot be safely formatted as SQL literals');
  }

  const str = String(val);
  const escaped = str.replace(/'/g, "''");
  return `N'${escaped}'`;
}

/**
 * Formats the full qualified table name [database].[schema].[tableName] (defaults schema to dbo if omitted)
 */
export function formatTableName(tableName: string, schema?: string, database?: string): string {
  const cleanTable = tableName.trim();
  const cleanSchema = (schema || 'dbo').trim();
  const parts: string[] = [];

  if (database && database.trim()) {
    parts.push(escapeIdentifier(database.trim()));
  }
  if (cleanSchema) {
    parts.push(escapeIdentifier(cleanSchema));
  }
  parts.push(escapeIdentifier(cleanTable));

  return parts.join('.');
}

/**
 * Builds the WHERE clause for UPDATE / DELETE.
 * If authoritative primaryKeyColumns are provided and completely present in projected columns, use PK columns.
 * Otherwise, fallback to ALL projected columns to prevent unintentional bulk updates/deletions.
 */
export function buildWhereConditions(
  columns: ColumnInfo[],
  row: CellValue[],
  primaryKeyColumns?: string[]
): string[] {
  if (!columns || columns.length === 0 || !row || row.length === 0) {
    throw new Error('Columns and row must not be empty');
  }

  if (columns.length !== row.length) {
    throw new Error(`Column count (${columns.length}) does not match row value count (${row.length})`);
  }

  const seenNames = new Set<string>();
  for (const col of columns) {
    const lower = col.name.toLowerCase();
    if (seenNames.has(lower)) {
      throw new Error(`Ambiguous query result contains duplicate column name: ${col.name}`);
    }
    seenNames.add(lower);
  }

  let targetCols: ColumnInfo[];

  if (primaryKeyColumns && primaryKeyColumns.length > 0) {
    const colMap = new Map<string, ColumnInfo>();
    for (const col of columns) {
      colMap.set(col.name.toLowerCase(), col);
    }

    const hasCompletePk = primaryKeyColumns.every((pk) => colMap.has(pk.toLowerCase()));

    if (hasCompletePk) {
      targetCols = primaryKeyColumns.map((pk) => colMap.get(pk.toLowerCase())!);
    } else {
      // Partial composite primary key falls back to all projected columns
      targetCols = columns;
    }
  } else {
    // Unknown primary key metadata never assumes a partial key is unique; falls back to all projected columns
    targetCols = columns;
  }

  const conditions: string[] = [];

  for (const col of targetCols) {
    const colIdx = columns.findIndex((c) => c.name.toLowerCase() === col.name.toLowerCase());
    const val = colIdx >= 0 ? row[colIdx] : null;
    const colName = escapeIdentifier(col.name);

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
 * Splits a multipart SQL identifier (e.g. [db].[dbo].[table] or db..table) into clean parts
 */
export function splitIdentifierParts(targetStr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inBrackets = false;

  for (let i = 0; i < targetStr.length; i++) {
    const char = targetStr[i];
    if (char === '[') {
      inBrackets = true;
    } else if (char === ']') {
      inBrackets = false;
    } else if (char === '.' && !inBrackets) {
      parts.push(current.trim().replace(/[\[\]]/g, ''));
      current = '';
      continue;
    } else {
      current += char;
    }
  }
  parts.push(current.trim().replace(/[\[\]]/g, ''));
  return parts;
}

/**
 * Extracts target schema and table name from a single multipart identifier string
 */
function resolveTableParts(rawTarget: string): { schema?: string; tableName: string } | null {
  const parts = splitIdentifierParts(rawTarget);
  if (parts.length === 0) return null;

  let rawTable = '';
  let rawSchema: string | undefined = undefined;

  if (parts.length >= 3) {
    // 3 or 4 part name: [Server].[DB].[Schema].[Table] or [DB].[Schema].[Table] or [DB]..[Table]
    rawTable = parts[parts.length - 1] || '';
    const secondLast = parts[parts.length - 2];
    rawSchema = secondLast ? secondLast : 'dbo';
  } else if (parts.length === 2) {
    // 2 part name: [Schema].[Table]
    rawTable = parts[1] || '';
    rawSchema = parts[0] ? parts[0] : 'dbo';
  } else if (parts.length === 1) {
    // 1 part name: [Table]
    rawTable = parts[0] || '';
    rawSchema = undefined;
  }

  const cleanTable = rawTable.trim();
  if (!cleanTable) return null;

  const upper = cleanTable.toUpperCase();
  if (['SELECT', 'WHERE', 'VALUES', 'SET', 'GROUP', 'ORDER'].includes(upper)) {
    return null;
  }

  return {
    schema: rawSchema?.trim() || undefined,
    tableName: cleanTable,
  };
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

  // Match FROM, INTO, UPDATE, JOIN, TRUNCATE TABLE followed by multipart table identifier
  const regex = /\b(?:FROM|INTO|UPDATE|JOIN|TRUNCATE\s+TABLE)\s+((?:\[[^\]]+\]|[a-zA-Z0-9_#$@]+)(?:\s*\.\s*(?:\[[^\]]+\]|[a-zA-Z0-9_#$@]*))*)/i;
  const match = cleanSql.match(regex);

  if (match && match[1]) {
    return resolveTableParts(match[1].trim());
  }

  return null;
}

/**
 * Extracts all table names referenced in FROM or JOIN clauses of a SQL query
 */
export function extractAllTableNamesFromSql(
  sql: string
): { schema?: string; tableName: string }[] {
  if (!sql || !sql.trim()) return [];

  const cleanSql = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  const regex = /\b(?:FROM|JOIN)\s+((?:\[[^\]]+\]|[a-zA-Z0-9_#$@]+)(?:\s*\.\s*(?:\[[^\]]+\]|[a-zA-Z0-9_#$@]*))*)/gi;
  const results: { schema?: string; tableName: string }[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleanSql)) !== null) {
    if (match[1]) {
      const parsed = resolveTableParts(match[1].trim());
      if (parsed) {
        const key = `${parsed.schema || ''}.${parsed.tableName}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push(parsed);
        }
      }
    }
  }

  return results;
}

/**
 * Generates an INSERT statement for a specific row
 */
export function generateInsertStatement(params: GenerateDmlParams): string {
  const { tableName, schema, database, columns, row } = params;
  const fullTableName = formatTableName(tableName, schema, database);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  const insertColsWithIdx = columns
    .map((col, idx) => ({ col, idx }))
    .filter((item) => !item.col.isIdentity);

  if (insertColsWithIdx.length === 0) {
    return `${timeHeader}\nINSERT INTO ${fullTableName} DEFAULT VALUES;`;
  }

  const colNames = insertColsWithIdx.map((item) => escapeIdentifier(item.col.name)).join(', ');
  const values = insertColsWithIdx.map((item) => formatSqlLiteral(row[item.idx])).join(', ');

  return `${timeHeader}\nINSERT INTO ${fullTableName} (${colNames})\nVALUES (${values});`;
}

/**
 * Generates an UPDATE statement for a specific row
 */
export function generateUpdateStatement(params: GenerateDmlParams): string {
  const { tableName, schema, database, columns, row, primaryKeyColumns } = params;
  const fullTableName = formatTableName(tableName, schema, database);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  // Identity columns can never be updated
  const nonIdentityCols = columns.filter((c) => !c.isIdentity);

  // Determine PK column names
  let pkNames: Set<string>;
  if (primaryKeyColumns && primaryKeyColumns.length > 0) {
    const colMap = new Set(columns.map((c) => c.name.toLowerCase()));
    const hasCompletePk = primaryKeyColumns.every((pk) => colMap.has(pk.toLowerCase()));
    if (hasCompletePk) {
      pkNames = new Set(primaryKeyColumns.map((pk) => pk.toLowerCase()));
    } else {
      pkNames = new Set();
    }
  } else {
    pkNames = new Set();
  }

  // If complete PK exists, exclude PK columns from SET. Otherwise, update all non-identity columns.
  const nonPkCols = nonIdentityCols.filter((c) => !pkNames.has(c.name.toLowerCase()));
  const setCols = nonPkCols.length > 0 ? nonPkCols : nonIdentityCols;

  if (setCols.length === 0) {
    throw new Error('No columns available to update');
  }

  const setClauses = setCols.map((c) => {
    const idx = columns.findIndex((col) => col.name.toLowerCase() === c.name.toLowerCase());
    const val = idx >= 0 ? row[idx] : null;
    return `  ${escapeIdentifier(c.name)} = ${formatSqlLiteral(val)}`;
  });

  const whereConditions = buildWhereConditions(columns, row, primaryKeyColumns);
  const whereClause = whereConditions.join('\n  AND ');

  return `${timeHeader}
IF @@TRANCOUNT <> 0 THROW 50000, 'Existing transaction detected; aborting execution.', 1;
BEGIN TRANSACTION;
BEGIN TRY
  UPDATE ${fullTableName}
  SET
  ${setClauses.join(',\n')}
  WHERE ${whereClause};

  IF @@ROWCOUNT <> 1 THROW 50001, 'Expected exactly 1 row to be affected; transaction rolled back.', 1;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;`;
}

/**
 * Generates a DELETE statement for a specific row
 */
export function generateDeleteStatement(params: GenerateDmlParams): string {
  const { tableName, schema, database, columns, row, primaryKeyColumns } = params;
  const fullTableName = formatTableName(tableName, schema, database);
  const timeHeader = `-- 自動產生語法 時間: ${formatCurrentDateTime()}`;

  const whereConditions = buildWhereConditions(columns, row, primaryKeyColumns);
  const whereClause = whereConditions.join('\n  AND ');

  return `${timeHeader}
IF @@TRANCOUNT <> 0 THROW 50000, 'Existing transaction detected; aborting execution.', 1;
BEGIN TRANSACTION;
BEGIN TRY
  DELETE FROM ${fullTableName}
  WHERE ${whereClause};

  IF @@ROWCOUNT <> 1 THROW 50001, 'Expected exactly 1 row to be affected; transaction rolled back.', 1;
  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;`;
}
