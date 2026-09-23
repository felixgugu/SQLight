import { getCurrentInstance, onMounted, onUnmounted, ref, type Ref } from 'vue';
import type { Tabulator, TabulatorCellComponent, TabulatorRowComponent } from 'tabulator-tables';
import type { CellValue, ColumnDef } from '@/types/query';
import { ROW_INDEX_FIELD, columnIndexFromField } from '@/utils/tabulatorColumns';
import { clearGridRanges } from '@/utils/tabulatorGrid';

/**
 * Spreadsheet-style selection for the Tabulator grids.
 *
 * The heavy lifting (mouse drag, shift/ctrl ranges, keyboard navigation, highlight overlay) is done
 * by Tabulator's range module; this composable is the translation layer that turns the active
 * ranges into what the UI needs: aggregate statistics for the bottom bar, the column order used by
 * exports, and the clipboard triggers.
 *
 * The frozen `#` row-number column is deliberately excluded from every selection so the range
 * highlight and the frozen column can never disagree about where a cell is.
 */

export interface SelectionStats {
  totalCells: number;
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  distinctCount: number;
}

/** One column of a selection block, addressed the way Tabulator stores it. */
export interface SelectionBlockColumn {
  field: string;
  /** Header text as rendered in the grid. */
  title: string;
}

/** One contiguous selection block, in display order. */
export interface SelectionBlock {
  columns: SelectionBlockColumn[];
  /** Raw row payloads (positional arrays or records) in display order. */
  rows: unknown[];
  /** True when the block spans every displayed row, i.e. a whole-column selection. */
  coversAllRows: boolean;
}

export interface UseGridSelectionOptions {
  getTable: () => Tabulator | null;
  getContainer: () => HTMLElement | null;
  getColumns: () => ColumnDef[];
  onCopySelected?: () => void;
}

export interface UseGridSelectionReturn {
  hasSelection: Ref<boolean>;
  selectionStats: Ref<SelectionStats | null>;
  selectedColumnsCount: Ref<number>;
  formatAggregateNumber: (num: number) => string;
  getColIndex: (field: string | null | undefined) => number | undefined;
  getVisualDataColIndices: () => number[];
  getSelectionBlocks: () => SelectionBlock[];
  selectAll: () => void;
  selectRow: (row: TabulatorRowComponent) => void;
  clearCellSelection: () => void;
  /** Recomputes the aggregate bar without waiting for the next animation frame. */
  refresh: () => void;
  /** Binds range/data/keyboard handling to a freshly built table instance. */
  attach: (table: Tabulator) => void;
}

export function formatAggregateNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

/** Reads one cell value out of either a positional array row or a record row. */
export function readCellValue(data: unknown, field: string): CellValue {
  if (Array.isArray(data)) {
    const index = columnIndexFromField(field);
    return index === undefined ? null : ((data[index] as CellValue) ?? null);
  }
  if (data && typeof data === 'object') {
    return ((data as Record<string, CellValue>)[field] as CellValue) ?? null;
  }
  return null;
}

function visibleDataColumns(table: Tabulator) {
  return table
    .getColumns()
    .filter((column) => column.isVisible() && column.getField() !== ROW_INDEX_FIELD);
}

export function useGridSelection(
  options: UseGridSelectionOptions
): UseGridSelectionReturn {
  const hasSelection = ref(false);
  const selectionStats = ref<SelectionStats | null>(null);
  const selectedColumnsCount = ref(0);

  let frameId: number | null = null;

  const getColIndex = (field: string | null | undefined) => columnIndexFromField(field);

  function getVisualDataColIndices(): number[] {
    const table = options.getTable();
    if (!table) return options.getColumns().map((_, index) => index);
    const indices: number[] = [];
    for (const column of visibleDataColumns(table)) {
      const index = columnIndexFromField(column.getField());
      if (index !== undefined) indices.push(index);
    }
    return indices.length > 0 ? indices : options.getColumns().map((_, index) => index);
  }

  function collectBlocks(): SelectionBlock[] {
    const table = options.getTable();
    if (!table) return [];

    const totalRows = table.getDataCount('display');
    const blocks: SelectionBlock[] = [];

    for (const range of table.getRanges()) {
      const columns = range
        .getColumns()
        .filter((column) => column.getField() !== ROW_INDEX_FIELD)
        .map((column) => {
          const definition = column.getDefinition();
          return {
            field: column.getField(),
            title: typeof definition.title === 'string' ? definition.title : column.getField(),
          };
        });
      if (columns.length === 0) continue;

      const rows = range.getRows().map((row) => row.getData());
      if (rows.length === 0) continue;

      blocks.push({
        columns,
        rows,
        coversAllRows: totalRows > 0 && rows.length >= totalRows,
      });
    }

    return blocks;
  }

  function getSelectionBlocks(): SelectionBlock[] {
    return collectBlocks();
  }

  function resetSelectionState() {
    hasSelection.value = false;
    selectionStats.value = null;
    selectedColumnsCount.value = 0;
  }

  /**
   * Aggregates the active ranges. Values are read from the rows inside the range (display order),
   * so sorting and filtering can never make the totals disagree with the highlighted cells.
   */
  function refresh(): void {
    frameId = null;

    const blocks = collectBlocks();
    if (blocks.length === 0) {
      resetSelectionState();
      return;
    }

    const distinctValues = new Set<string>();
    let totalCells = 0;
    let numericCount = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let wholeRowSelectionColumns = 0;

    for (const block of blocks) {
      if (block.coversAllRows) wholeRowSelectionColumns += block.columns.length;

      for (const row of block.rows) {
        for (const column of block.columns) {
          const value = readCellValue(row, column.field);
          totalCells++;
          distinctValues.add(value === null || value === undefined ? 'NULL' : String(value));
          if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
            continue;
          }
          const num = typeof value === 'number' ? value : Number(value);
          if (Number.isNaN(num)) continue;
          numericCount++;
          sum += num;
          if (num < min) min = num;
          if (num > max) max = num;
        }
      }
    }

    hasSelection.value = true;
    selectedColumnsCount.value = wholeRowSelectionColumns;
    selectionStats.value = {
      totalCells,
      numericCount,
      sum: numericCount > 0 ? sum : 0,
      avg: numericCount > 0 ? sum / numericCount : 0,
      min: numericCount > 0 ? min : 0,
      max: numericCount > 0 ? max : 0,
      distinctCount: distinctValues.size,
    };
  }

  function scheduleRefresh() {
    if (typeof requestAnimationFrame === 'undefined') {
      refresh();
      return;
    }
    if (frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      refresh();
    });
  }

  function removeAllRanges() {
    clearGridRanges(options.getTable());
  }

  function clearCellSelection() {
    removeAllRanges();
    resetSelectionState();
  }

  function applyRange(start: TabulatorCellComponent | null, end: TabulatorCellComponent | null) {
    const table = options.getTable();
    if (!table) return;
    removeAllRanges();
    if (start && end) {
      // Tabulator applies the new bounds on the next tick and then emits rangeAdded/rangeChanged,
      // so the aggregate bar is refreshed from those events rather than from a premature read.
      table.addRange(start, end);
    }
    scheduleRefresh();
  }

  function dataFieldBounds(): { first: string; last: string } | null {
    const table = options.getTable();
    if (!table) return null;
    const fields = visibleDataColumns(table).map((column) => column.getField());
    if (fields.length === 0) return null;
    return { first: fields[0]!, last: fields[fields.length - 1]! };
  }

  /** Selects every data cell of one row (triggered by clicking the frozen `#` cell). */
  function selectRow(row: TabulatorRowComponent) {
    const bounds = dataFieldBounds();
    if (!bounds) return;
    const start = row.getCell(bounds.first);
    const end = row.getCell(bounds.last);
    applyRange(start || null, end || null);
  }

  /** Selects the whole data table (Ctrl+A, or clicking the `#` header). */
  function selectAll() {
    const table = options.getTable();
    const bounds = dataFieldBounds();
    if (!table || !bounds) return;

    const rowCount = table.getDataCount('display');
    if (rowCount === 0) return;

    const firstRow = table.getRowFromPosition(1);
    const lastRow = table.getRowFromPosition(rowCount);
    if (!firstRow || !lastRow) return;

    applyRange(firstRow.getCell(bounds.first) || null, lastRow.getCell(bounds.last) || null);
  }

  function handleKeyDown(event: KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }

    if (event.key === 'Escape') {
      clearCellSelection();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
      const container = options.getContainer();
      if (container && container.contains(document.activeElement)) {
        event.preventDefault();
        selectAll();
      }
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 'c' || event.key === 'C') &&
      hasSelection.value
    ) {
      event.preventDefault();
      options.onCopySelected?.();
    }
  }

  function attach(table: Tabulator) {
    // Range events cover drag selection, header clicks, shift/ctrl ranges and keyboard navigation.
    table.on('rangeChanged', scheduleRefresh);
    table.on('rangeAdded', scheduleRefresh);
    table.on('rangeRemoved', scheduleRefresh);
    // Row positions move with the data, so the aggregate bar has to be recalculated.
    table.on('dataProcessed', () => {
      resetSelectionState();
      scheduleRefresh();
    });
    table.on('dataSorted', scheduleRefresh);
    table.on('dataFiltered', scheduleRefresh);
  }

  const selection: UseGridSelectionReturn = {
    hasSelection,
    selectionStats,
    selectedColumnsCount,
    formatAggregateNumber,
    getColIndex,
    getVisualDataColIndices,
    getSelectionBlocks,
    selectAll,
    selectRow,
    clearCellSelection,
    refresh,
    attach,
  };

  if (getCurrentInstance()) {
    onMounted(() => {
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', handleKeyDown);
      }
    });

    onUnmounted(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
      if (frameId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    });
  }

  return selection;
}
