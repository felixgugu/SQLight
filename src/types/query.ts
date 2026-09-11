export type CellValue = string | number | boolean | null | { type: 'binary'; length: number };

export interface ColumnDef {
  name: string;
  dataType: string;
  nullable: boolean;
  ordinal: number;
}

export interface ResultSet {
  columns: ColumnDef[];
  rows: CellValue[][];
  rowCount: number;
  totalCount?: number;
  isTruncated?: boolean;
}

export interface QueryMessage {
  level: 'info' | 'warning' | 'error';
  message: string;
  code?: number;
  lineNumber?: number;
  timestamp: string;
}

export interface QueryResult {
  resultSets: ResultSet[];
  messages: QueryMessage[];
  affectedRows: number;
  executionTimeMs: number;
}

export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  database: string;
  sql: string;
  executedAt: string;
  executionTimeMs: number;
  status: 'success' | 'error';
  affectedRows?: number;
  errorMessage?: string;
}
