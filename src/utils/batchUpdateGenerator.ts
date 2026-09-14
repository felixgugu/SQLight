import type { CellValue } from '@/types/query';
import {
  escapeIdentifier,
  formatSqlLiteral,
  formatTableName,
  formatCurrentDateTime,
} from './sqlGenerator';

export interface RowModification {
  rowIndex: number;
  /** Keyed by column name, value is the new CellValue to update */
  updates: Record<string, CellValue>;
  /** Keyed by PK column name, value is the original PK value used for WHERE condition */
  pkWhere: Record<string, CellValue>;
}

export interface BatchUpdateParams {
  tableName: string;
  schema?: string;
  database?: string;
  modifications: RowModification[];
}

/**
 * Generates an atomic, safe T-SQL batch script to commit multiple row/cell updates.
 * Features:
 * - Wrapped in BEGIN TRANSACTION ... COMMIT TRANSACTION
 * - Strict IF @@ROWCOUNT <> 1 THROW check per row to prevent partial/concurrency overwrites
 * - Auto-rollback in CATCH block
 * - Escaped identifiers and literals
 */
export function generateBatchUpdateScript(params: BatchUpdateParams): string {
  const { tableName, schema, database, modifications } = params;

  if (!modifications || modifications.length === 0) {
    throw new Error('No modifications provided to generate batch update script');
  }

  const fullTableName = formatTableName(tableName, schema, database);
  const timeHeader = `-- 自動產生批次更新 異動列數: ${modifications.length}, 時間: ${formatCurrentDateTime()}`;

  const statements: string[] = [];

  for (const mod of modifications) {
    const updateEntries = Object.entries(mod.updates);
    const pkEntries = Object.entries(mod.pkWhere);

    if (updateEntries.length === 0) {
      continue;
    }

    if (pkEntries.length === 0) {
      throw new Error(`Row modification at index ${mod.rowIndex} lacks primary key condition`);
    }

    const setClauses = updateEntries.map(([colName, val]) => {
      return `${escapeIdentifier(colName)} = ${formatSqlLiteral(val)}`;
    });

    const whereClauses = pkEntries.map(([pkName, val]) => {
      const colId = escapeIdentifier(pkName);
      if (val === null || val === undefined) {
        return `${colId} IS NULL`;
      }
      return `${colId} = ${formatSqlLiteral(val)}`;
    });

    const rowComment = `-- [列 ${mod.rowIndex + 1}] 更新 ${updateEntries.length} 個欄位`;
    const stmt = `${rowComment}
  UPDATE ${fullTableName}
  SET ${setClauses.join(', ')}
  WHERE ${whereClauses.join(' AND ')};

  IF @@ROWCOUNT <> 1 THROW 50001, 'Row update for index ${mod.rowIndex + 1} affected unexpected number of rows; transaction rolled back.', 1;`;

    statements.push(stmt);
  }

  if (statements.length === 0) {
    throw new Error('No valid row updates found in modifications');
  }

  return `${timeHeader}
IF @@TRANCOUNT <> 0 THROW 50000, 'Existing transaction detected; aborting execution.', 1;
BEGIN TRANSACTION;
BEGIN TRY
  ${statements.join('\n\n  ')}

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;`;
}
