export type SchemaObjectType = 'database' | 'schema' | 'table' | 'view' | 'column';

export interface ColumnMetadata {
  name: string;
  dataType: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
}

export interface TableMetadata {
  schema: string;
  name: string;
  type: 'BASE TABLE' | 'VIEW';
  columns?: ColumnMetadata[];
}

export interface DatabaseMetadata {
  name: string;
  schemas: string[];
  tables: TableMetadata[];
}

export interface SchemaTreeNode {
  id: string;
  label: string;
  type: SchemaObjectType;
  children?: SchemaTreeNode[];
  isLoaded?: boolean;
  metadata?: Record<string, unknown>;
}
