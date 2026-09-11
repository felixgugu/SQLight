export type SchemaObjectType = 'database' | 'schema' | 'table' | 'view' | 'column';

export interface DatabaseItem {
  name: string;
}

export interface SchemaItem {
  name: string;
}

export interface TableItem {
  schema: string;
  name: string;
  kind: string; // 'BASE TABLE' | 'VIEW'
}

export interface RoutineItem {
  schema: string;
  name: string;
  kind: 'PROCEDURE' | 'FUNCTION';
}

export interface ColumnItem {
  name: string;
  dataType: string;
  maxLength?: number | null;
  precision?: number | null;
  scale?: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
}

export interface TableSchema {
  schema: string;
  name: string;
  kind: string; // 'BASE TABLE' | 'VIEW'
  columns: ColumnItem[];
}

export interface SchemaTreeNode {
  id: string;
  label: string;
  type: SchemaObjectType;
  children?: SchemaTreeNode[];
  isLoaded?: boolean;
  metadata?: Record<string, unknown>;
}
