export interface ExplorerTreeState {
  expandedConns: Record<string, boolean>;
  expandedDbs: Record<string, boolean>;
  expandedFolders: Record<string, boolean>;
  expandedTables: Record<string, boolean>;
}

export interface CollapseAllOptions {
  /**
   * Whether to collapse connection-level nodes. Defaults to true.
   */
  collapseConnections?: boolean;
  /**
   * Optional array of connection IDs to ensure all are explicitly set to false.
   */
  knownConnectionIds?: string[];
}

/**
 * Collapses all expanded nodes across the explorer tree (tables, folders, databases, and connections).
 *
 * @param state Object containing the tree expansion records.
 * @param options Configuration options.
 */
export function collapseAllTreeNodes(
  state: ExplorerTreeState,
  options: CollapseAllOptions = {}
): void {
  const { collapseConnections = true, knownConnectionIds } = options;

  // 1. Collapse all table/view columns
  if (state.expandedTables) {
    for (const key of Object.keys(state.expandedTables)) {
      state.expandedTables[key] = false;
    }
  }

  // 2. Collapse / reset all category folders
  if (state.expandedFolders) {
    for (const key of Object.keys(state.expandedFolders)) {
      delete state.expandedFolders[key];
    }
  }

  // 3. Collapse all databases
  if (state.expandedDbs) {
    for (const key of Object.keys(state.expandedDbs)) {
      state.expandedDbs[key] = false;
    }
  }

  // 4. Collapse all connections (if requested)
  if (collapseConnections && state.expandedConns) {
    if (knownConnectionIds) {
      for (const id of knownConnectionIds) {
        state.expandedConns[id] = false;
      }
    }
    for (const key of Object.keys(state.expandedConns)) {
      state.expandedConns[key] = false;
    }
  }
}
