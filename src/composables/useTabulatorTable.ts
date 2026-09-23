import { nextTick, onBeforeUnmount, ref, shallowRef, type Ref, type ShallowRef } from 'vue';
import { TabulatorFull, type Tabulator, type TabulatorOptions } from 'tabulator-tables';
import { clearGridRanges } from '@/utils/tabulatorGrid';

/**
 * Lifecycle wrapper around a Tabulator instance.
 *
 * The component owns the markup (a plain `<div>` the table is built into) and the option object;
 * this composable owns creation, teardown, data replacement and the "column shape changed, build a
 * new table" rule. Tabulator cannot swap the column model in place without losing column state, so
 * a new column signature destroys and recreates the grid, which is why callers get an `onReady`
 * hook to restore their remembered layout.
 */
export interface UseTabulatorTableOptions {
  /** True while the grid element is rendered (the components hide it behind a `v-if`). */
  isActive: () => boolean;
  /** Builds the Tabulator options for a fresh instance. */
  buildOptions: () => TabulatorOptions;
  /** Rows for the current data set (raw, non-reactive payloads). */
  getRows: () => unknown[];
  /** Identifies the column shape; a new value rebuilds the table. */
  getColumnSignature: () => string;
  /** Called once the table finished building (and after every rebuild). */
  onReady?: (table: Tabulator) => void;
}

export interface UseTabulatorTableReturn {
  containerRef: Ref<HTMLDivElement | null>;
  table: ShallowRef<Tabulator | null>;
  isReady: Ref<boolean>;
  /** Creates, reloads or rebuilds the table to match the current props. */
  sync: () => Promise<void>;
  /** Re-renders rendered rows (used after programmatic data edits). */
  redraw: (force?: boolean) => void;
}

export function useTabulatorTable(
  options: UseTabulatorTableOptions
): UseTabulatorTableReturn {
  const containerRef = ref<HTMLDivElement | null>(null);
  const table = shallowRef<Tabulator | null>(null);
  const isReady = ref(false);
  let columnSignature = '';

  function destroyTable() {
    const instance = table.value;
    table.value = null;
    isReady.value = false;
    columnSignature = '';
    if (!instance) return;
    try {
      // Tabulator applies new range bounds on a deferred timer; a range that is still registered
      // when the table is torn down crashes its next layout pass, so drop the overlays first.
      clearGridRanges(instance);
    } catch {
      // A table that never finished building has nothing to clean up.
    }
    try {
      instance.destroy();
    } catch {
      // A grid that is already torn down (or never finished building) must not break unmount.
    }
  }

  function createTable() {
    const container = containerRef.value;
    if (!container || table.value) return;

    const instance = new TabulatorFull(container, {
      ...options.buildOptions(),
      data: options.getRows(),
    });

    table.value = instance;
    columnSignature = options.getColumnSignature();

    instance.on('tableBuilt', () => {
      isReady.value = true;
      options.onReady?.(instance);
    });
  }

  async function sync(): Promise<void> {
    if (!options.isActive()) {
      destroyTable();
      return;
    }

    if (!containerRef.value) {
      await nextTick();
    }
    if (!options.isActive() || !containerRef.value) return;

    const signature = options.getColumnSignature();

    if (!table.value || signature !== columnSignature) {
      destroyTable();
      createTable();
      return;
    }

    try {
      await table.value.replaceData(options.getRows());
    } catch {
      // A result set that is replaced while the table rebuilds must not surface as an error.
    }
  }

  function redraw(force = false) {
    table.value?.redraw(force);
  }

  onBeforeUnmount(() => {
    destroyTable();
  });

  return {
    containerRef,
    table,
    isReady,
    sync,
    redraw,
  };
}
