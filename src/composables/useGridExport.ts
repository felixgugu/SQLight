import { ref, type Ref } from 'vue';
import type { ColumnDef, CellValue } from '@/types/query';
import { exportRowAsJson, exportRowsAsJson, exportRowsAsMarkdown } from '@/utils/exportFormatters';
import { formatCellForExport } from '@/composables/useColumnAutoWidth';
import type { UseGridSelectionReturn } from '@/composables/useGridSelection';

export interface UseGridExportOptions {
  getRows: () => CellValue[][];
  getColumns: () => ColumnDef[];
  selection: UseGridSelectionReturn;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) => void;
  onMenuClose?: () => void;
}

export interface UseGridExportReturn {
  copiedTsv: Ref<boolean>;
  copiedCsv: Ref<boolean>;
  copyCellValue: (value: unknown) => void;
  copyColumnName: (name: string) => void;
  copyCurrentRow: (row: CellValue[] | null | undefined) => void;
  copyCurrentRowAsJson: (columns: ColumnDef[], row: CellValue[] | null | undefined) => void;
  copySelectedCells: () => void;
  copySelectedAsJson: () => void;
  copyAsTsv: () => void;
  copyAsCsv: () => void;
  copyAsJson: () => void;
  copyAsMarkdown: () => void;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function useGridExport(options: UseGridExportOptions): UseGridExportReturn {
  const copiedTsv = ref(false);
  const copiedCsv = ref(false);

  function copyCellValue(value: unknown) {
    if (value !== null && value !== undefined) {
      navigator.clipboard.writeText(String(value));
    } else {
      navigator.clipboard.writeText('NULL');
    }
    options.onMenuClose?.();
  }

  function copyColumnName(name: string) {
    const text = (name ?? '').trim();
    if (!text) {
      options.showToast('無法取得欄位名稱', 'warning', 2000);
      options.onMenuClose?.();
      return;
    }
    navigator.clipboard.writeText(text);
    options.showToast(`已複製欄位名稱「${text}」至剪貼簿`, 'success', 2000);
    options.onMenuClose?.();
  }

  function copyCurrentRow(row: CellValue[] | null | undefined) {
    if (row) {
      const rowStr = row.map(formatCellForExport).join('\t');
      navigator.clipboard.writeText(rowStr);
      options.showToast('已複製整列資料至剪貼簿 (TSV)', 'success', 2000);
    }
    options.onMenuClose?.();
  }

  function copyCurrentRowAsJson(columns: ColumnDef[], row: CellValue[] | null | undefined) {
    if (row) {
      const jsonStr = exportRowAsJson(columns, row);
      navigator.clipboard.writeText(jsonStr);
      options.showToast('已複製目前列為 JSON 物件', 'success', 2000);
    }
    options.onMenuClose?.();
  }

  function copySelectedCells() {
    const rows = options.getRows();
    const columns = options.getColumns();
    const { hasSelection, selectedColSet, selectionRange, getVisualDataColIndices, selectionStats } = options.selection;

    if (!rows.length || !hasSelection.value) return;

    const lines: string[] = [];
    const visualIndices = getVisualDataColIndices();

    if (selectedColSet.value.size > 0) {
      const activeIndices = visualIndices.filter((cIdx) => selectedColSet.value.has(cIdx));
      lines.push(activeIndices.map((cIdx) => columns[cIdx]?.name || '').join('\t'));
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        lines.push(activeIndices.map((cIdx) => formatCellForExport(row[cIdx])).join('\t'));
      }
    } else if (selectionRange.value) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      const rangeIndices = visualIndices.filter((_, vIdx) => vIdx >= minCol && vIdx <= maxCol);
      if (minRow === 0 && maxRow === rows.length - 1) {
        lines.push(rangeIndices.map((cIdx) => columns[cIdx]?.name || '').join('\t'));
      }
      for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const rowCells: string[] = [];
        for (const cIdx of rangeIndices) {
          rowCells.push(formatCellForExport(row[cIdx]));
        }
        lines.push(rowCells.join('\t'));
      }
    }

    navigator.clipboard.writeText(lines.join('\n'));
    options.showToast(`已複製選取內容 (${selectionStats.value?.totalCells ?? 0} 格) 至剪貼簿`, 'success', 2000);
    options.onMenuClose?.();
  }

  function copySelectedAsJson() {
    const rows = options.getRows();
    const columns = options.getColumns();
    const { hasSelection, selectedColSet, selectionRange, getVisualDataColIndices } = options.selection;

    if (!rows.length || !hasSelection.value) return;

    let cols: { name: string }[] = [];
    let rowsData: unknown[][] = [];
    const visualIndices = getVisualDataColIndices();

    if (selectedColSet.value.size > 0) {
      const activeIndices = visualIndices.filter((cIdx) => selectedColSet.value.has(cIdx));
      cols = activeIndices.map((cIdx) => ({ name: columns[cIdx]?.name || '' }));
      rowsData = rows.map((r) => activeIndices.map((cIdx) => r[cIdx]));
    } else if (selectionRange.value) {
      const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
      const rangeIndices = visualIndices.filter((_, vIdx) => vIdx >= minCol && vIdx <= maxCol);
      cols = rangeIndices.map((cIdx) => ({ name: columns[cIdx]?.name || '' }));
      rowsData = rows
        .slice(minRow, maxRow + 1)
        .map((r) => rangeIndices.map((cIdx) => r[cIdx]));
    }

    const jsonStr = exportRowsAsJson(cols, rowsData);
    navigator.clipboard.writeText(jsonStr);
    options.showToast(`已複製選取為 JSON (${rowsData.length} 列 x ${cols.length} 欄)`, 'success', 2000);
    options.onMenuClose?.();
  }

  function copyAsTsv() {
    const rows = options.getRows();
    const columns = options.getColumns();
    if (!rows.length) return;
    const visualIndices = options.selection.getVisualDataColIndices();
    const headers = visualIndices.map((cIdx) => columns[cIdx]?.name || '').join('\t');
    const rowsText = rows
      .map((row) => visualIndices.map((cIdx) => formatCellForExport(row[cIdx])).join('\t'))
      .join('\n');
    const fullText = `${headers}\n${rowsText}`;

    navigator.clipboard.writeText(fullText).then(() => {
      copiedTsv.value = true;
      options.showToast(`已複製全表為 TSV (${rows.length} 筆)`, 'success', 2000);
      setTimeout(() => {
        copiedTsv.value = false;
      }, 2000);
    });
    options.onMenuClose?.();
  }

  function copyAsCsv() {
    const rows = options.getRows();
    const columns = options.getColumns();
    if (!rows.length) return;
    const visualIndices = options.selection.getVisualDataColIndices();
    const headers = visualIndices.map((cIdx) => escapeCsv(columns[cIdx]?.name || '')).join(',');
    const rowsText = rows
      .map((row) => visualIndices.map((cIdx) => escapeCsv(formatCellForExport(row[cIdx]))).join(','))
      .join('\n');
    const fullText = `${headers}\n${rowsText}`;

    navigator.clipboard.writeText(fullText).then(() => {
      copiedCsv.value = true;
      options.showToast(`已複製全表為 CSV (${rows.length} 筆)`, 'success', 2000);
      setTimeout(() => {
        copiedCsv.value = false;
      }, 2000);
    });
    options.onMenuClose?.();
  }

  function copyAsJson() {
    const rows = options.getRows();
    const columns = options.getColumns();
    if (!rows.length) return;
    const visualIndices = options.selection.getVisualDataColIndices();
    const cols = visualIndices.map((cIdx) => ({ name: columns[cIdx]?.name || '' }));
    const rowsData = rows.map((r) => visualIndices.map((cIdx) => r[cIdx]));
    const jsonStr = exportRowsAsJson(cols, rowsData);
    navigator.clipboard.writeText(jsonStr).then(() => {
      options.showToast(`已複製全表為 JSON 物件陣列 (${rows.length} 筆)`, 'success', 2000);
    });
    options.onMenuClose?.();
  }

  function copyAsMarkdown() {
    const rows = options.getRows();
    const columns = options.getColumns();
    if (!rows.length) return;
    const visualIndices = options.selection.getVisualDataColIndices();
    const cols = visualIndices.map((cIdx) => ({ name: columns[cIdx]?.name || '' }));
    const rowsData = rows.map((r) => visualIndices.map((cIdx) => r[cIdx]));
    const mdStr = exportRowsAsMarkdown(cols, rowsData);
    navigator.clipboard.writeText(mdStr).then(() => {
      options.showToast('已複製全表為 Markdown 表格', 'success', 2000);
    });
    options.onMenuClose?.();
  }

  return {
    copiedTsv,
    copiedCsv,
    copyCellValue,
    copyColumnName,
    copyCurrentRow,
    copyCurrentRowAsJson,
    copySelectedCells,
    copySelectedAsJson,
    copyAsTsv,
    copyAsCsv,
    copyAsJson,
    copyAsMarkdown,
  };
}
