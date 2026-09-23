import { defineStore } from 'pinia';
import type { ColumnState, GridApi } from 'ag-grid-community';

/**
 * Per-result-tab AG Grid layout cache (session only, never persisted).
 *
 * AG Grid does not retain column state when a grid is destroyed (multi result set tabs) or
 * when its column definitions are replaced (single reused grid across query result tabs).
 * This store remembers the layout keyed by `tabId:setIndex` so switching back restores it.
 */

export interface GridLayoutEntry {
  columnState: ColumnState[];
  filterModel: Record<string, unknown>;
}

/** Builds the stable layout key for one result set. Kept pure for unit testing. */
export function buildLayoutKey(tabId: string | null | undefined, setIndex: number): string {
  return `${tabId ?? 'orphan'}:${setIndex}`;
}

export const useGridLayoutStore = defineStore('gridLayout', () => {
  // Plain (non-reactive) maps: nothing renders from them and column state arrays can be
  // large, so keeping them outside Vue's reactivity avoids proxy overhead on every capture.
  const layouts = new Map<string, GridLayoutEntry>();
  const activeSetIndexByTab = new Map<string, number>();

  function layoutKey(tabId: string | null | undefined, setIndex: number): string {
    return buildLayoutKey(tabId, setIndex);
  }

  /** Snapshots the current column layout / filter model of one grid. */
  function capture(key: string, api: GridApi | null | undefined): void {
    if (!api) return;
    try {
      const columnState = api.getColumnState?.() ?? [];
      const filterModel = (api.getFilterModel?.() ?? {}) as Record<string, unknown>;
      layouts.set(key, { columnState, filterModel });
    } catch {
      // A grid torn down mid-capture must not break unmount: skip this snapshot.
    }
  }

  /** Re-applies a stored layout. Returns false when nothing was stored for the key. */
  function restore(key: string, api: GridApi | null | undefined): boolean {
    if (!api) return false;
    const entry = layouts.get(key);
    if (!entry) return false;
    try {
      if (entry.columnState.length > 0) {
        api.applyColumnState({ state: entry.columnState, applyOrder: true });
      }
      if (entry.filterModel && Object.keys(entry.filterModel).length > 0) {
        api.setFilterModel(entry.filterModel);
      }
      return true;
    } catch {
      return false;
    }
  }

  function has(key: string): boolean {
    return layouts.has(key);
  }

  function getActiveSetIndex(tabId: string | null | undefined): number | null {
    if (!tabId) return null;
    const index = activeSetIndexByTab.get(tabId);
    return index === undefined ? null : index;
  }

  function setActiveSetIndex(tabId: string | null | undefined, index: number): void {
    if (!tabId) return;
    activeSetIndexByTab.set(tabId, index);
  }

  /** Drops every cached layout / remembered index of a closed result tab. */
  function clearTab(tabId: string | null | undefined): void {
    if (!tabId) return;
    activeSetIndexByTab.delete(tabId);
    const prefix = `${tabId}:`;
    for (const key of [...layouts.keys()]) {
      if (key.startsWith(prefix)) layouts.delete(key);
    }
  }

  return {
    layoutKey,
    capture,
    restore,
    has,
    getActiveSetIndex,
    setActiveSetIndex,
    clearTab,
  };
});
