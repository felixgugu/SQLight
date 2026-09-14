import { escapeIdentifier, formatCurrentDateTime } from './sqlGenerator';

export interface AlterTableColumnOptions {
  schema: string;
  tableName: string;
  columnName: string;
  dataType?: string;
  fullType?: string;
  isNullable?: string | boolean;
  defaultValue?: string | null;
  database?: string;
}

function resolveFullTableName(schema: string, tableName: string): string {
  const s = (schema || 'dbo').trim();
  const t = tableName.trim();
  return `${escapeIdentifier(s)}.${escapeIdentifier(t)}`;
}

function resolveUseDatabase(database?: string): string {
  if (!database || !database.trim()) return '';
  return `USE ${escapeIdentifier(database.trim())};\nGO\n\n`;
}

function resolveNullability(isNullable?: string | boolean): string {
  if (isNullable === false || isNullable === 'NO' || isNullable === '0') {
    return 'NOT NULL';
  }
  return 'NULL';
}

/**
 * Generate T-SQL script to alter/modify an existing column.
 */
export function generateAlterColumnSql(options: AlterTableColumnOptions): string {
  const fullTableName = resolveFullTableName(options.schema, options.tableName);
  const colName = escapeIdentifier(options.columnName);
  const typeStr = options.fullType || options.dataType || 'nvarchar(255)';
  const nullability = resolveNullability(options.isNullable);
  const now = formatCurrentDateTime();
  const useDb = resolveUseDatabase(options.database);

  return `-- ============================================================
-- Script: ALTER TABLE ... ALTER COLUMN
-- Target: ${fullTableName}
-- Column: ${colName} (當前型態: ${typeStr} ${nullability})
-- Date  : ${now}
-- ============================================================
${useDb}-- 提示：修改欄位資料型態、長度或 NULL / NOT NULL 屬性
ALTER TABLE ${fullTableName}
ALTER COLUMN ${colName} ${typeStr} ${nullability};
GO
`;
}

/**
 * Generate T-SQL script to drop an existing column.
 */
export function generateDropColumnSql(options: AlterTableColumnOptions): string {
  const fullTableName = resolveFullTableName(options.schema, options.tableName);
  const colName = escapeIdentifier(options.columnName);
  const now = formatCurrentDateTime();
  const useDb = resolveUseDatabase(options.database);

  const defaultHint = options.defaultValue
    ? `\n-- 偵測到預設值約束: ${options.defaultValue}`
    : '';

  return `-- ============================================================
-- Script: ALTER TABLE ... DROP COLUMN
-- Target: ${fullTableName}
-- Column: ${colName}
-- Date  : ${now}
-- ============================================================
${useDb}-- 注意：若該欄位具有 DEFAULT 約束、CHECK 約束、外鍵或索引，需先刪除相依物件後方可刪除欄位。${defaultHint}
-- 例如若有預設約束：ALTER TABLE ${fullTableName} DROP CONSTRAINT [DF_${options.tableName}_${options.columnName}];
ALTER TABLE ${fullTableName}
DROP COLUMN ${colName};
GO
`;
}

/**
 * Generate T-SQL script to add a new column to the table.
 */
export function generateAddColumnSql(options: AlterTableColumnOptions): string {
  const fullTableName = resolveFullTableName(options.schema, options.tableName);
  const refCol = options.columnName ? ` (參考現有欄位 [${options.columnName}])` : '';
  const now = formatCurrentDateTime();
  const useDb = resolveUseDatabase(options.database);

  return `-- ============================================================
-- Script: ALTER TABLE ... ADD COLUMN
-- Target: ${fullTableName}${refCol}
-- Date  : ${now}
-- ============================================================
${useDb}-- 提示：在此資料表中新增欄位
ALTER TABLE ${fullTableName}
ADD [NewColumnName] nvarchar(100) NULL;
GO
`;
}

/**
 * Generate a comprehensive ALTER TABLE script containing ADD, ALTER, and DROP examples.
 */
export function generateAllAlterTableTemplateSql(options: AlterTableColumnOptions): string {
  const fullTableName = resolveFullTableName(options.schema, options.tableName);
  const colName = escapeIdentifier(options.columnName);
  const typeStr = options.fullType || options.dataType || 'nvarchar(255)';
  const nullability = resolveNullability(options.isNullable);
  const now = formatCurrentDateTime();
  const useDb = resolveUseDatabase(options.database);

  return `-- ============================================================
-- Script: ALTER TABLE 語法範本 (ADD / ALTER / DROP)
-- Target: ${fullTableName}
-- Column: ${colName} (${typeStr} ${nullability})
-- Date  : ${now}
-- ============================================================
${useDb}-- 1. 新增欄位 (ADD COLUMN)
ALTER TABLE ${fullTableName}
ADD [NewColumnName] nvarchar(100) NULL;
GO

-- 2. 修改欄位型別或可空屬性 (ALTER COLUMN)
ALTER TABLE ${fullTableName}
ALTER COLUMN ${colName} ${typeStr} ${nullability};
GO

-- 3. 刪除欄位 (DROP COLUMN)
-- 注意：需先移除相依之預設約束、外鍵或索引
ALTER TABLE ${fullTableName}
DROP COLUMN ${colName};
GO
`;
}
