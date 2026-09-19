export type TabType = 'sql_editor' | 'table_data' | 'table_structure' | 'execution_plan' | 'er_diagram';

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
  filePath?: string;
}

export interface TableDataTab extends BaseTab {
  type: 'table_data';
  schema: string;
  tableName: string;
  filter?: string;
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface TableStructureTab extends BaseTab {
  type: 'table_structure';
  schema: string;
  tableName: string;
}

export interface ExecutionPlanTab extends BaseTab {
  type: 'execution_plan';
  planXml: string;
  querySql: string;
  executedAt: string;
  durationMs?: number;
}

export interface ErDiagramTab extends BaseTab {
  type: 'er_diagram';
  rootSchema?: string;
  rootTable?: string;
  depth: 1 | 2;
  initialData?: any;
  fileName?: string;
}

export type WorkspaceTab =
  | SqlEditorTab
  | TableDataTab
  | TableStructureTab
  | ExecutionPlanTab
  | ErDiagramTab;

export type BottomPanelTab = 'results' | 'messages' | 'history' | 'stats';

