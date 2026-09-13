import type { ColumnItem } from '@/types/schema';

export interface DdlOptions {
  tableName: string;
  schema?: string;
  database?: string;
  columns: ColumnItem[];
}

/**
 * Format column data type according to SQL Server standards
 */
export function formatColumnDataType(col: ColumnItem): string {
  const dt = col.dataType.toLowerCase();

  if (dt === 'varchar' || dt === 'char') {
    if (col.maxLength === -1) {
      return `[${dt}](MAX)`;
    }
    if (col.maxLength && col.maxLength > 0) {
      return `[${dt}](${col.maxLength})`;
    }
    return `[${dt}]`;
  }

  if (dt === 'nvarchar' || dt === 'nchar') {
    if (col.maxLength === -1) {
      return `[${dt}](MAX)`;
    }
    if (col.maxLength && col.maxLength > 0) {
      return `[${dt}](${col.maxLength})`;
    }
    return `[${dt}]`;
  }

  if (dt === 'varbinary' || dt === 'binary') {
    if (col.maxLength === -1) {
      return `[${dt}](MAX)`;
    }
    if (col.maxLength && col.maxLength > 0) {
      return `[${dt}](${col.maxLength})`;
    }
    return `[${dt}]`;
  }

  if (dt === 'decimal' || dt === 'numeric') {
    if (col.precision != null) {
      const scale = col.scale != null ? col.scale : 0;
      return `[${dt}](${col.precision}, ${scale})`;
    }
    return `[${dt}](18, 2)`;
  }

  if (dt === 'datetime2' || dt === 'time' || dt === 'datetimeoffset') {
    if (col.scale != null && col.scale !== 7) {
      return `[${dt}](${col.scale})`;
    }
    return `[${dt}]`;
  }

  return `[${dt}]`;
}

import { escapeIdentifier } from './sqlGenerator';

/**
 * Generate a clean, standard CREATE TABLE DDL script for SQL Server
 */
export function generateCreateTableDdl(options: DdlOptions): string {
  const schema = options.schema || 'dbo';
  const table = options.tableName;
  const nowStr = new Date().toLocaleString();

  const lines: string[] = [];

  options.columns.forEach((col) => {
    const colName = escapeIdentifier(col.name);
    const dataType = formatColumnDataType(col);
    const identity = col.isIdentity ? ' IDENTITY(1,1)' : '';
    const nullable = col.isNullable ? 'NULL' : 'NOT NULL';

    lines.push(`    ${colName.padEnd(28)} ${dataType.padEnd(16)}${identity} ${nullable}`);
  });

  // Extract Primary Key columns
  const pkCols = options.columns.filter((c) => c.isPrimaryKey);
  if (pkCols.length > 0) {
    const pkConstraintName = escapeIdentifier(`PK_${table}`);
    const pkColList = pkCols
      .map((c) => `${escapeIdentifier(c.name)} ASC`)
      .join(', ');
    lines.push(`    -- 提示：若修改資料表名稱，請一併修改下方的約束名稱 ${pkConstraintName}`);
    lines.push(`    CONSTRAINT ${pkConstraintName} PRIMARY KEY CLUSTERED (${pkColList})`);
  }

  const columnsSql = lines.join(',\n');
  const fullTableName = `${escapeIdentifier(schema)}.${escapeIdentifier(table)}`;
  const useDbHeader = options.database ? `USE ${escapeIdentifier(options.database)};\nGO\n\n` : '';

  return `-- ============================================================
-- 資料表結構 DDL 腳本: ${fullTableName}
-- 產生時間: ${nowStr}
-- ============================================================
${useDbHeader}CREATE TABLE ${fullTableName} (
${columnsSql}
);
`;
}
