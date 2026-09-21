import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { GridApi, ColumnMovedEvent } from 'ag-grid-community';
import type { ColumnDef, CellValue } from '@/types/query';

export interface CellCoord {
  rowIndex: number;
  colIndex: number;
}

export interface SelectionRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface SelectionStats {
  totalCells: number;
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  distinctCount: number;
}

export interface UseGridSelectionOptions {
  getRows: () => CellValue[][];
  getColumns: () => ColumnDef[];
  getGridApi: () => GridApi | null;
  getGridContainer: () => HTMLElement | null;
  onCopySelected?: () => void;
}

export interface UseGridSelectionReturn {
  isCellDragging: Ref<boolean>;
  isRowDragging: Ref<boolean>;
  selectionRange: Ref<SelectionRange | null>;
  selectedColSet: Ref<Set<number>>;
  selectionStats: Ref<SelectionStats | null>;
  hasSelection: ComputedRef<boolean>;
  selectedColumnsCount: ComputedRef<number>;
  getColIndex: (colId: string | null | undefined) => number | undefined;
  getVisualDataColIndices: () => number[];
  isCellInSelection: (r: number, c: number, vColIdx?: number) => boolean;
  isColumnSelected: (c: number, vColIdx?: number) => boolean;
  formatAggregateNumber: (num: number) => string;
  computeSelectionStats: () => void;
  updateSelectionHighlight: () => void;
  clearCellSelection: () => void;
  selectAll: () => void;
  onGridMouseDown: (e: MouseEvent) => void;
  onGridClick: (e: MouseEvent) => void;
  onColumnMoved: (event: ColumnMovedEvent) => void;
  onBodyScroll: () => void;
}

// Helper to extract 0-based column index from standard colId `col_N`
export function getColIndex(colId: string | null | undefined): number | undefined {
  if (!colId) return undefined;
  if (colId.startsWith('col_')) {
    const idx = parseInt(colId.substring(4), 10);
    return isNaN(idx) ? undefined : idx;
  }
  return undefined;
}

export function formatAggregateNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

export function useGridSelection(options: UseGridSelectionOptions): UseGridSelectionReturn {
  const isCellDragging = ref(false);
  const isRowDragging = ref(false);

  const cellDragStart = ref<CellCoord | null>(null);
  const cellDragEnd = ref<CellCoord | null>(null);
  const lastAnchorCell = ref<CellCoord | null>(null);

  const lastAnchorHeaderCol = ref<number | null>(null);

  const rowDragStart = ref<number | null>(null);
  const lastAnchorRow = ref<number | null>(null);

  const selectionRange = ref<SelectionRange | null>(null);
  const selectedColSet = ref<Set<number>>(new Set());
  const selectionStats = ref<SelectionStats | null>(null);

  let headerMouseDownInfo: {
    x: number;
    y: number;
    time: number;
    colId: string;
  } | null = null;

  function getVisualDataColIndices(): number[] {
    const gridApi = options.getGridApi();
    const columns = options.getColumns();
    if (!gridApi) {
      return columns.map((_, i) => i);
    }
    const cols = gridApi.getAllGridColumns();
    if (!cols || !cols.length) {
      return columns.map((_, i) => i);
    }
    return cols
      .map((c) => c.getColId())
      .filter((id) => id && id !== 'row_index' && id !== '#')
      .map((id) => getColIndex(id))
      .filter((idx): idx is number => idx !== undefined);
  }

  const hasSelection = computed(() => {
    return selectedColSet.value.size > 0 || selectionRange.value !== null;
  });

  const selectedColumnsCount = computed(() => {
    if (selectedColSet.value.size > 0) {
      return selectedColSet.value.size;
    }
    const rows = options.getRows();
    if (selectionRange.value && rows.length > 0) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      if (minRow === 0 && maxRow === rows.length - 1) {
        return maxCol - minCol + 1;
      }
    }
    return 0;
  });

  function isCellInSelection(r: number, c: number, vColIdx?: number): boolean {
    if (selectedColSet.value.size > 0) {
      return selectedColSet.value.has(c);
    }
    if (selectionRange.value) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      const colPosition = vColIdx !== undefined ? vColIdx : c;
      return r >= minRow && r <= maxRow && colPosition >= minCol && colPosition <= maxCol;
    }
    return false;
  }

  function isColumnSelected(c: number, vColIdx?: number): boolean {
    if (selectedColSet.value.size > 0) {
      return selectedColSet.value.has(c);
    }
    const rows = options.getRows();
    if (selectionRange.value && rows.length > 0) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      const colPosition = vColIdx !== undefined ? vColIdx : c;
      return (
        minRow === 0 &&
        maxRow === rows.length - 1 &&
        colPosition >= minCol &&
        colPosition <= maxCol
      );
    }
    return false;
  }

  function computeSelectionStats() {
    const rows = options.getRows();
    if (!rows.length || !hasSelection.value) {
      selectionStats.value = null;
      return;
    }

    const distinctValues = new Set<string>();
    const numericValues: number[] = [];
    let totalCells = 0;

    if (selectedColSet.value.size > 0) {
      const colIndices = Array.from(selectedColSet.value);
      const rowCount = rows.length;
      totalCells = colIndices.length * rowCount;

      for (let r = 0; r < rowCount; r++) {
        const row = rows[r];
        if (!row) continue;
        for (const c of colIndices) {
          const val = row[c];
          distinctValues.add(val === null || val === undefined ? 'NULL' : String(val));
          if (val !== null && val !== undefined && val !== '' && typeof val !== 'boolean') {
            const num = typeof val === 'number' ? val : Number(val);
            if (!isNaN(num)) {
              numericValues.push(num);
            }
          }
        }
      }
    } else if (selectionRange.value) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      const visualIndices = getVisualDataColIndices();
      const rangeCols = visualIndices.filter((_, vIdx) => vIdx >= minCol && vIdx <= maxCol);
      totalCells = (maxRow - minRow + 1) * rangeCols.length;

      for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        for (const c of rangeCols) {
          const val = row[c];
          distinctValues.add(val === null || val === undefined ? 'NULL' : String(val));
          if (val !== null && val !== undefined && val !== '' && typeof val !== 'boolean') {
            const num = typeof val === 'number' ? val : Number(val);
            if (!isNaN(num)) {
              numericValues.push(num);
            }
          }
        }
      }
    }

    let sum = 0;
    let min = 0;
    let max = 0;
    let avg = 0;

    if (numericValues.length > 0) {
      sum = numericValues.reduce((acc, curr) => acc + curr, 0);
      min = Math.min(...numericValues);
      max = Math.max(...numericValues);
      avg = sum / numericValues.length;
    }

    selectionStats.value = {
      totalCells,
      numericCount: numericValues.length,
      sum,
      avg,
      min,
      max,
      distinctCount: distinctValues.size,
    };
  }

  function updateSelectionHighlight() {
    const container = options.getGridContainer();
    if (!container) return;

    if (!hasSelection.value) {
      const selectedCells = container.querySelectorAll('.sqlight-cell-selected');
      selectedCells.forEach((cell) => cell.classList.remove('sqlight-cell-selected'));
      const selectedHeaders = container.querySelectorAll('.sqlight-header-selected');
      selectedHeaders.forEach((hCell) => hCell.classList.remove('sqlight-header-selected'));
      return;
    }

    const visualIndices = getVisualDataColIndices();
    const vIdxMap = new Map<number, number>();
    for (let i = 0; i < visualIndices.length; i++) {
      vIdxMap.set(visualIndices[i]!, i);
    }

    const cells = container.querySelectorAll('.ag-cell');
    cells.forEach((cell) => {
      const rStr = cell.getAttribute('row-index');
      const cId = cell.getAttribute('col-id');
      if (rStr == null || !cId) {
        cell.classList.remove('sqlight-cell-selected');
        return;
      }
      const r = parseInt(rStr, 10);
      const c = getColIndex(cId);
      if (c !== undefined) {
        const vIdx = vIdxMap.get(c);
        if (isCellInSelection(r, c, vIdx)) {
          cell.classList.add('sqlight-cell-selected');
        } else {
          cell.classList.remove('sqlight-cell-selected');
        }
      } else {
        cell.classList.remove('sqlight-cell-selected');
      }
    });

    // Highlight column headers if whole column selected
    const headerCells = container.querySelectorAll('.ag-header-cell');
    headerCells.forEach((hCell) => {
      const cId = hCell.getAttribute('col-id');
      const c = getColIndex(cId);
      if (c !== undefined) {
        const vIdx = vIdxMap.get(c);
        if (isColumnSelected(c, vIdx)) {
          hCell.classList.add('sqlight-header-selected');
        } else {
          hCell.classList.remove('sqlight-header-selected');
        }
      } else {
        hCell.classList.remove('sqlight-header-selected');
      }
    });
  }

  function clearCellSelection() {
    cellDragStart.value = null;
    cellDragEnd.value = null;
    rowDragStart.value = null;
    selectionRange.value = null;
    selectedColSet.value.clear();
    selectionStats.value = null;
    isCellDragging.value = false;
    isRowDragging.value = false;
    updateSelectionHighlight();
  }

  function selectAll() {
    const rows = options.getRows();
    if (rows.length === 0) return;
    selectedColSet.value.clear();
    const visualIndices = getVisualDataColIndices();
    selectionRange.value = {
      minRow: 0,
      maxRow: rows.length - 1,
      minCol: 0,
      maxCol: visualIndices.length - 1,
    };
    computeSelectionStats();
    updateSelectionHighlight();
  }

  function onGridMouseDown(e: MouseEvent) {
    const rows = options.getRows();
    if (e.button !== 0 || rows.length === 0) return; // Only handle left clicks
    const target = e.target as HTMLElement;

    // 1. Check if clicked inside column header
    const headerCell = target.closest('.ag-header-cell');
    if (headerCell) {
      const cId = headerCell.getAttribute('col-id');

      // If clicked on '#' top-left corner header -> SELECT ALL
      if (!cId || cId === 'row_index' || cId === '#') {
        e.preventDefault();
        selectAll();
        return;
      }

      const colIdx = getColIndex(cId);
      if (colIdx === undefined) return;

      // Track mousedown to distinguish drag (column reorder) from click (column select)
      headerMouseDownInfo = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
        colId: cId,
      };

      // If Shift or Ctrl/Cmd is held, prevent AG Grid's default multi-sort
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
      // For normal click/drag, DO NOT preventDefault so AG Grid can initiate column reorder drag
      return;
    }

    // 2. Check if clicked inside a data cell
    const cellEl = target.closest('.ag-cell');
    if (!cellEl) {
      clearCellSelection();
      return;
    }

    const rStr = cellEl.getAttribute('row-index');
    const cId = cellEl.getAttribute('col-id');
    if (rStr == null) return;

    const r = parseInt(rStr, 10);
    if (isNaN(r)) return;

    const colCount = options.getColumns().length;
    const visualIndices = getVisualDataColIndices();
    const maxVCol = visualIndices.length > 0 ? visualIndices.length - 1 : colCount - 1;

    // Clicked on '#' row number column -> Select entire row
    if (!cId || cId === 'row_index' || cId === '#') {
      e.preventDefault();
      selectedColSet.value.clear();

      if (e.shiftKey && lastAnchorRow.value !== null) {
        const minRow = Math.min(lastAnchorRow.value, r);
        const maxRow = Math.max(lastAnchorRow.value, r);
        selectionRange.value = { minRow, maxRow, minCol: 0, maxCol: maxVCol };
      } else {
        lastAnchorRow.value = r;
        rowDragStart.value = r;
        isRowDragging.value = true;
        selectionRange.value = { minRow: r, maxRow: r, minCol: 0, maxCol: maxVCol };
      }
      computeSelectionStats();
      updateSelectionHighlight();
      return;
    }

    const colIdx = getColIndex(cId);
    if (colIdx === undefined) return;

    e.preventDefault();
    selectedColSet.value.clear();

    const vIdx = visualIndices.indexOf(colIdx);
    const startVCol = vIdx >= 0 ? vIdx : colIdx;

    // Shift + Click on Cell: Rectangular Range Selection from Anchor
    if (e.shiftKey && lastAnchorCell.value) {
      const minRow = Math.min(lastAnchorCell.value.rowIndex, r);
      const maxRow = Math.max(lastAnchorCell.value.rowIndex, r);
      const minCol = Math.min(lastAnchorCell.value.colIndex, startVCol);
      const maxCol = Math.max(lastAnchorCell.value.colIndex, startVCol);
      selectionRange.value = { minRow, maxRow, minCol, maxCol };
      computeSelectionStats();
      updateSelectionHighlight();
      return;
    }

    // Normal Cell Click: Start Cell Drag Selection
    lastAnchorCell.value = { rowIndex: r, colIndex: startVCol };
    cellDragStart.value = { rowIndex: r, colIndex: startVCol };
    cellDragEnd.value = { rowIndex: r, colIndex: startVCol };
    isCellDragging.value = true;
    selectionRange.value = { minRow: r, maxRow: r, minCol: startVCol, maxCol: startVCol };
    computeSelectionStats();
    updateSelectionHighlight();
  }

  function onGridClick(e: MouseEvent) {
    const rows = options.getRows();
    if (e.button !== 0 || rows.length === 0) return;
    const target = e.target as HTMLElement;

    const headerCell = target.closest('.ag-header-cell');
    if (!headerCell) return;

    const cId = headerCell.getAttribute('col-id');
    if (!cId || cId === 'row_index' || cId === '#') return;

    // If user moved mouse > 5px, it was a column reorder drag, NOT a click!
    if (headerMouseDownInfo && headerMouseDownInfo.colId === cId) {
      const dist = Math.hypot(e.clientX - headerMouseDownInfo.x, e.clientY - headerMouseDownInfo.y);
      if (dist > 5) {
        headerMouseDownInfo = null;
        return;
      }
    }
    headerMouseDownInfo = null;

    const colIdx = getColIndex(cId);
    if (colIdx === undefined) return;

    const rowCount = rows.length;
    if (rowCount === 0) return;

    // A. Ctrl + Click on Header: Toggle multi-column selection
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      if (selectedColSet.value.size === 0 && selectionRange.value) {
        const { minCol, maxCol } = selectionRange.value;
        const visualIndices = getVisualDataColIndices();
        visualIndices.forEach((c, vIdx) => {
          if (vIdx >= minCol && vIdx <= maxCol) selectedColSet.value.add(c);
        });
        selectionRange.value = null;
      }
      if (selectedColSet.value.has(colIdx)) {
        selectedColSet.value.delete(colIdx);
      } else {
        selectedColSet.value.add(colIdx);
      }
      lastAnchorHeaderCol.value = colIdx;
      computeSelectionStats();
      updateSelectionHighlight();
      return;
    }

    // B. Shift + Click on Header: Select range of columns in visual order
    if (e.shiftKey && lastAnchorHeaderCol.value !== null) {
      e.stopPropagation();
      selectedColSet.value.clear();
      selectionRange.value = null;

      const visualIndices = getVisualDataColIndices();
      let vStart = visualIndices.indexOf(lastAnchorHeaderCol.value);
      let vEnd = visualIndices.indexOf(colIdx);
      if (vStart === -1) vStart = 0;
      if (vEnd === -1) vEnd = visualIndices.length - 1;

      const minV = Math.min(vStart, vEnd);
      const maxV = Math.max(vStart, vEnd);

      for (let v = minV; v <= maxV; v++) {
        const c = visualIndices[v];
        if (c !== undefined) selectedColSet.value.add(c);
      }
      computeSelectionStats();
      updateSelectionHighlight();
      return;
    }

    // C. Normal Header Click: Select single column
    selectedColSet.value.clear();
    selectedColSet.value.add(colIdx);
    lastAnchorHeaderCol.value = colIdx;
    selectionRange.value = null;
    computeSelectionStats();
    updateSelectionHighlight();
  }

  function onColumnMoved(event: ColumnMovedEvent) {
    if (event.finished) {
      updateSelectionHighlight();
    }
  }

  function handleGlobalMouseMove(e: MouseEvent) {
    const container = options.getGridContainer();
    const rows = options.getRows();
    if (!container || rows.length === 0) return;

    // 1. Row Dragging across rows
    if (isRowDragging.value && rowDragStart.value !== null) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = el?.closest('.ag-cell');
      const rStr = cellEl?.getAttribute('row-index');
      if (rStr != null) {
        const r = parseInt(rStr, 10);
        if (!isNaN(r)) {
          const minRow = Math.min(rowDragStart.value, r);
          const maxRow = Math.max(rowDragStart.value, r);
          const visualIndices = getVisualDataColIndices();
          selectionRange.value = {
            minRow,
            maxRow,
            minCol: 0,
            maxCol: visualIndices.length > 0 ? visualIndices.length - 1 : options.getColumns().length - 1,
          };
          scheduleDragHighlight();
        }
      }
      return;
    }

    // 2. Cell Dragging across rows and columns
    if (isCellDragging.value && cellDragStart.value !== null) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cellEl = el?.closest('.ag-cell');
      if (!cellEl) return;

      const rStr = cellEl.getAttribute('row-index');
      const cId = cellEl.getAttribute('col-id');
      if (rStr == null || !cId) return;

      const r = parseInt(rStr, 10);
      const c = getColIndex(cId);
      if (isNaN(r) || c === undefined) return;

      if (!activeDragVisualIndices || !activeDragVIdxMap) {
        activeDragVisualIndices = getVisualDataColIndices();
        activeDragVIdxMap = new Map();
        for (let i = 0; i < activeDragVisualIndices.length; i++) {
          activeDragVIdxMap.set(activeDragVisualIndices[i]!, i);
        }
      }

      const vIdx = activeDragVIdxMap.get(c);
      if (vIdx === undefined || vIdx === -1) return;

      if (cellDragEnd.value?.rowIndex !== r || cellDragEnd.value?.colIndex !== vIdx) {
        cellDragEnd.value = { rowIndex: r, colIndex: vIdx };
        const minRow = Math.min(cellDragStart.value.rowIndex, r);
        const maxRow = Math.max(cellDragStart.value.rowIndex, r);
        const minCol = Math.min(cellDragStart.value.colIndex, vIdx);
        const maxCol = Math.max(cellDragStart.value.colIndex, vIdx);
        selectionRange.value = { minRow, maxRow, minCol, maxCol };
        scheduleDragHighlight();
      }
    }
  }

  let activeDragVisualIndices: number[] | null = null;
  let activeDragVIdxMap: Map<number, number> | null = null;
  let dragHighlightRafId: number | null = null;

  function scheduleDragHighlight() {
    if (dragHighlightRafId !== null) return;
    dragHighlightRafId = requestAnimationFrame(() => {
      dragHighlightRafId = null;
      updateSelectionHighlight();
    });
  }

  function handleGlobalMouseUp() {
    const wasDragging = isCellDragging.value || isRowDragging.value;
    if (isCellDragging.value) isCellDragging.value = false;
    if (isRowDragging.value) isRowDragging.value = false;
    activeDragVisualIndices = null;
    activeDragVIdxMap = null;

    if (dragHighlightRafId !== null) {
      cancelAnimationFrame(dragHighlightRafId);
      dragHighlightRafId = null;
    }

    if (wasDragging) {
      computeSelectionStats();
      updateSelectionHighlight();
    }
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }

    // Escape: Clear selection
    if (e.key === 'Escape') {
      clearCellSelection();
      return;
    }

    // Ctrl+A / Cmd+A: Select All
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      const container = options.getGridContainer();
      if (container && container.contains(document.activeElement || null)) {
        e.preventDefault();
        selectAll();
        return;
      }
    }

    // Ctrl+C / Cmd+C: Copy Selected Cells / Columns
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && hasSelection.value) {
      e.preventDefault();
      options.onCopySelected?.();
    }
  }

  let scrollRafId: number | null = null;
  function onBodyScroll() {
    if (!hasSelection.value) return;
    if (scrollRafId !== null) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      updateSelectionHighlight();
    });
  }

  onMounted(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('keydown', handleGlobalKeyDown);
  });

  onUnmounted(() => {
    if (scrollRafId !== null) {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }
    if (dragHighlightRafId !== null) {
      cancelAnimationFrame(dragHighlightRafId);
      dragHighlightRafId = null;
    }
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
    window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  return {
    isCellDragging,
    isRowDragging,
    selectionRange,
    selectedColSet,
    selectionStats,
    hasSelection,
    selectedColumnsCount,
    getColIndex,
    getVisualDataColIndices,
    isCellInSelection,
    isColumnSelected,
    formatAggregateNumber,
    computeSelectionStats,
    updateSelectionHighlight,
    clearCellSelection,
    selectAll,
    onGridMouseDown,
    onGridClick,
    onColumnMoved,
    onBodyScroll,
  };
}
