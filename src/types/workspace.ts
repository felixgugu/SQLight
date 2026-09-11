export type TabType = 'sql_editor' | 'table_data';

export interface BaseTab {
  id: string;
  title: string;
  connectionId?: string;
  database?: string;
  isDirty?: boolean;
}

export interface SqlEditorTab extends BaseTab {
  type: 'sql_editor';
  query: string;
  cursorPosition?: { lineNumber: number; column: number };
}

export interface TableDataTab extends BaseTab {
  type: 'table_data';
  schema: string;
  tableName: string;
  filter?: string;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export type WorkspaceTab = SqlEditorTab | TableDataTab;

export type BottomPanelTab = 'results' | 'messages' | 'history';
