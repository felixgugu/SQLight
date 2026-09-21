/**
 * Types for the TSV import wizard (Explorer → table node → 「TSV 匯入」).
 */

export interface TsvImportTarget {
  connId: string;
  connectionName?: string;
  database: string;
  schema: string;
  table: string;
}

export interface ImportCapabilities {
  identityColumn?: string | null;
  writableColumnCount: number;
  canAlterTable: boolean;
  engineEdition: number;
  supportsIdentityInsert: boolean;
  /** Reason shown when "允許手動指定識別值" has to stay disabled. */
  disabledReason?: string | null;
}

/** One column of the positional TSV payload. */
export interface ImportColumnPlan {
  /** Position inside the TSV row. */
  index: number;
  name: string;
  dataType: string;
  fullType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
  /** Identity values are range checked by the database, only the format is validated here. */
  deferRangeToDatabase: boolean;
}

/** A unique index (or the primary key) of the target table. */
export interface UniqueKeyPlan {
  name: string;
  isPrimaryKey: boolean;
  columns: string[];
}

/** One data row, cells hold the raw text; the sentinel `\N` means SQL NULL. */
export interface ParsedRow {
  line: number;
  cells: string[];
}

export interface ParsedTsv {
  rows: ParsedRow[];
  /** Lines of the original text that were empty in the middle of the payload. */
  blankLines: number[];
  headerLine: number | null;
  totalLines: number;
}

export type ImportErrorReason =
  | '欄位數不符'
  | '必填值缺漏'
  | '型別不符'
  | '長度超限'
  | '精度超限'
  | '主鍵重複'
  | '唯一值重複';

export interface ImportValidationError {
  line: number;
  /** 1-based position of the column inside the TSV row. */
  columnPosition: number;
  column: string;
  rawValue: string;
  reason: ImportErrorReason;
  detail: string;
}

export interface ImportPayloadRow {
  line: number;
  values: (string | null)[];
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportValidationError[];
  payload: ImportPayloadRow[];
  /** First rows, raw cells, for the preview table. */
  preview: ParsedRow[];
}

export interface ImportProgress {
  importId: string;
  processedRows: number;
  totalRows: number;
}

export interface ImportRowError {
  line: number;
  column?: string | null;
  message: string;
  serverCode?: number | null;
}

export interface ImportResult {
  insertedCount: number;
  rolledBack: boolean;
  errors: ImportRowError[];
  executionTimeMs: number;
}
