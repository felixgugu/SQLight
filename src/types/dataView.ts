import type { ColumnDef, CellValue } from './query';

export type DataViewSpecialType = 'null' | 'empty' | 'binary' | 'boolean' | 'json' | 'normal';

export interface DataViewFieldItem {
  index: number;
  name: string;
  dataType: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
  isIdentity?: boolean;
  value: CellValue;
  displayValue: string;
  specialType: DataViewSpecialType;
  formattedJson?: string;
}

export interface DataViewPayload {
  columns: ColumnDef[];
  row: CellValue[];
  rowIndex?: number;
  totalRows?: number;
  allRows?: CellValue[][];
  tableName?: string;
  sourceTitle?: string;
}
