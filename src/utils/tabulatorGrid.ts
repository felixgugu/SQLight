import type { Tabulator } from 'tabulator-tables';

/** Minimal shape of the range module internals this project relies on. */
interface RangeModuleInternals {
  setDefaultRange?: () => void;
  layoutElement?: (visibleRows?: boolean) => void;
}

export const CLEAR_GRID_SELECTION_EVENT = 'sqlight:clear-grid-selection';

/** Dispatches a global event to instruct active data grids to clear their range selection. */
export function dispatchClearGridSelection(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLEAR_GRID_SELECTION_EVENT));
  }
}


/**
 * Drops every active range.
 *
 * Tabulator exposes `addRange()` but no public "clear ranges" call. Removing the last range with
 * `RangeComponent.remove()` makes the range module auto-create an empty placeholder range whose
 * bounds are `NaN`; a later layout pass then throws while trying to resolve its cells. The module's
 * own `setDefaultRange()` (used internally on `data-processed`) tears the ranges down without that
 * placeholder, and with `selectableRangeInitializeDefault: false` it leaves none behind.
 */
export function clearGridRanges(table: Tabulator | null | undefined): void {
  if (!table) return;

  const selectRange = (
    table as unknown as { modules?: { selectRange?: RangeModuleInternals } }
  ).modules?.selectRange;

  if (selectRange?.setDefaultRange) {
    try {
      selectRange.setDefaultRange();
      // Re-paint the rendered cells so stale `.tabulator-range-selected` classes disappear.
      selectRange.layoutElement?.(true);
      return;
    } catch {
      // Fall through to the public API if the internals ever change shape.
    }
  }

  try {
    for (const range of table.getRanges()) {
      range.remove();
    }
  } catch {
    // A grid that is already torn down has nothing left to clear.
  }
}
