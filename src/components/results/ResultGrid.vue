<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader Toolbar: Result Set Tabs, Quick Filter, Warnings, Actions -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 flex-shrink-0 space-x-2">
      <!-- Left: Result Sets Tabs & Quick Filter -->
      <div class="flex items-center space-x-2 min-w-0">
        <!-- Multiple Result Sets Tabs -->
        <div v-if="resultSets.length > 1" class="flex items-center space-x-1 flex-shrink-0">
          <button
            v-for="(_, idx) in resultSets"
            :key="idx"
            @click="activeSetIndex = idx"
            :class="[
              'h-5 px-2 rounded text-xxs font-medium transition-colors',
              activeSetIndex === idx
                ? 'bg-dark-750 text-brand-300 font-semibold shadow-xs'
                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
            ]"
          >
            Result Set #{{ idx + 1 }} ({{ resultSets[idx]?.rowCount ?? 0 }})
          </button>
          <div class="h-3.5 w-px bg-dark-750 mx-1"></div>
        </div>

        <!-- Quick Filter Input -->
        <div class="relative flex items-center w-48 sm:w-60">
          <Search class="w-3 h-3 text-dark-500 absolute left-2 pointer-events-none" />
          <input
            v-model="quickFilter"
            type="text"
            placeholder="Search grid results..."
            class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-0.5 pl-7 pr-6 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
          />
          <button
            v-if="quickFilter"
            @click="quickFilter = ''"
            class="absolute right-1.5 text-dark-400 hover:text-dark-200 p-0.5"
            title="Clear filter"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>

        <!-- Truncation Warning Badge (when max rows limit reached) -->
        <div
          v-if="currentSet?.isTruncated"
          class="hidden md:flex items-center space-x-1 bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded text-xxs font-sans truncate"
          :title="`查詢結果筆數超過上限，已自動截斷至 ${currentSet.rowCount.toLocaleString()} 筆以保護記憶體效能`"
        >
          <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span>已達上限 {{ currentSet.rowCount.toLocaleString() }} 筆（共 {{ (currentSet.totalCount ?? currentSet.rowCount).toLocaleString() }} 筆，其餘已截斷）</span>
        </div>
      </div>

      <!-- Right: Copy Tools & Row Stats -->
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Copy to TSV (Excel friendly) -->
        <button
          @click="copyAsTsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors"
          title="複製全部為 TSV (相容 Excel 貼上)"
        >
          <Check v-if="copiedTsv" class="w-2.5 h-2.5 text-emerald-400" />
          <FileSpreadsheet v-else class="w-2.5 h-2.5 text-emerald-400" />
          <span>{{ copiedTsv ? 'Copied!' : 'Copy TSV' }}</span>
        </button>

        <!-- Copy to CSV -->
        <button
          @click="copyAsCsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors"
          title="複製為 CSV 格式"
        >
          <Check v-if="copiedCsv" class="w-2.5 h-2.5 text-brand-400" />
          <FileText v-else class="w-2.5 h-2.5 text-brand-400" />
          <span>{{ copiedCsv ? 'Copied!' : 'CSV' }}</span>
        </button>

        <div class="h-3.5 w-px bg-dark-750 mx-0.5"></div>

        <!-- Row Count Indicator -->
        <span class="text-xxs text-dark-400 font-mono">
          <strong class="text-dark-200">{{ currentSet?.rows.length.toLocaleString() ?? 0 }}</strong> rows
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!currentSet || currentSet.rows.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-dark-500 space-y-1"
    >
      <Inbox class="w-6 h-6 stroke-1" />
      <span>No rows returned</span>
    </div>

    <!-- AG Grid Area -->
    <div v-else class="flex-1 w-full overflow-hidden relative" @contextmenu.prevent>
      <AgGridVue
        class="w-full h-full"
        :theme="sqlightGridTheme"
        :row-data="currentSet.rows"
        :column-defs="columnDefs"
        :quick-filter-text="quickFilter"
        :enable-cell-text-selection="true"
        :ensure-dom-order="true"
        :prevent-default-on-context-menu="true"
        :tooltip-show-mode="'whenTruncated'"
        :tooltip-show-delay="150"
        :tooltip-hide-delay="6000"
        :suppress-row-hover-highlight="false"
        @grid-ready="onGridReady"
        @cell-context-menu="onCellContextMenu"
      />
    </div>

    <!-- Custom Context Menu for Cells & Column Pinning -->
    <div
      v-if="contextMenu.visible"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-48 text-xs font-sans text-dark-200 select-none"
      @click="contextMenu.visible = false"
    >
      <div class="px-2.5 py-1 text-xxs text-dark-400 border-b border-dark-750 font-mono truncate">
        {{ contextMenu.colName }}: {{ String(contextMenu.cellValue ?? 'NULL') }}
      </div>

      <button
        @click="copyCellValue"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Copy class="w-3.5 h-3.5 text-brand-400" />
        <span>複製儲存格值 (Copy Cell)</span>
      </button>

      <button
        @click="copyCurrentRow"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileText class="w-3.5 h-3.5 text-emerald-400" />
        <span>複製整列資料 (Copy Row)</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="togglePinColumn"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <PinOff v-if="isColPinned" class="w-3.5 h-3.5 text-amber-400" />
        <Pin v-else class="w-3.5 h-3.5 text-amber-400" />
        <span>{{ isColPinned ? '取消凍結此欄 (Unpin)' : '凍結此欄於左側 (Pin Left)' }}</span>
      </button>

      <button
        @click="copyAsTsv"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors border-t border-dark-750"
      >
        <FileSpreadsheet class="w-3.5 h-3.5 text-indigo-400" />
        <span>複製全表為 TSV (Excel)</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import {
  Inbox,
  Search,
  X,
  Copy,
  Check,
  AlertTriangle,
  Pin,
  PinOff,
  FileSpreadsheet,
  FileText,
} from 'lucide-vue-next';
import { AgGridVue } from 'ag-grid-vue3';
import {
  AllCommunityModule,
  ModuleRegistry,
  type GridApi,
  type GridReadyEvent,
  type ColDef,
  type CellContextMenuEvent,
  type ICellRendererParams,
} from 'ag-grid-community';
import { sqlightGridTheme } from '@/styles/gridTheme';
import type { ResultSet, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  resultSets: ResultSet[];
}>();

const activeSetIndex = ref(0);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const copiedTsv = ref(false);
const copiedCsv = ref(false);

const currentSet = computed(() => {
  return props.resultSets[activeSetIndex.value] ?? props.resultSets[0] ?? null;
});

// Custom cell context menu state
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  colName: string;
  cellValue: unknown;
  rowIndex: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  colName: '',
  cellValue: null,
  rowIndex: -1,
});

const isColPinned = computed(() => {
  if (!gridApi.value || !contextMenu.colName) return false;
  const col = gridApi.value.getColumn(contextMenu.colName);
  return col ? col.isPinned() : false;
});

function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatValueForDisplay(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
    return `[Binary ${(val as any).length} B]`;
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  return String(val);
}

function estimateTextWidth(text: string, isMono = true): number {
  let width = 0;
  const charWidth = isMono ? 7.8 : 7.2;
  for (let i = 0; i < text.length; i++) {
    width += text.charCodeAt(i) > 255 ? 15 : charWidth;
  }
  return width;
}

function calculateColumnWidth(headerName: string, firstRowVal: unknown): number {
  const firstRowStr = firstRowVal !== undefined ? formatValueForDisplay(firstRowVal) : '';
  
  // Header: text width + padding + sort icon (~18px) + filter icon (~18px)
  const headerWidth = Math.ceil(estimateTextWidth(headerName, false) + 48);

  // First row: text width + cell left/right padding (~28px)
  const firstRowWidth = firstRowVal !== undefined && firstRowStr.length > 0
    ? Math.ceil(estimateTextWidth(firstRowStr, true) + 28)
    : 0;

  // Decide width based on first row length (at least large enough for header)
  const calculated = Math.max(headerWidth, firstRowWidth);

  // Keep within reasonable bounds: min 75px, max 600px
  return Math.min(Math.max(calculated, 75), 600);
}

// AG Grid Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  if (!currentSet.value) return [];

  // 1. Pinned Row Index Column (#)
  const rowCount = currentSet.value.rows.length;
  const digits = Math.max(2, String(rowCount).length);
  const indexWidth = Math.max(60, digits * 10 + 36);

  const indexCol: ColDef = {
    headerName: '#',
    pinned: 'left',
    width: indexWidth,
    minWidth: 48,
    suppressMovable: true,
    sortable: false,
    filter: false,
    resizable: true,
    valueGetter: (params) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
    cellClass: 'text-dark-500 bg-dark-850/40 text-center font-mono text-xxs select-none !px-1',
    headerClass: 'text-center !px-1',
  };

  const firstRow = currentSet.value.rows[0];

  // 2. Dynamic Data Columns sized by the first row
  const dataCols: ColDef[] = currentSet.value.columns.map((col, colIdx) => {
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const colWidth = calculateColumnWidth(col.name, firstVal);

    return {
      colId: col.name,
      field: `col_${colIdx}`,
      headerName: col.name,
      width: colWidth,
      minWidth: 70,
      tooltipShowMode: 'whenTruncated',
      // Floating tooltip on hover (clean header without inline type text)
      headerTooltip: `型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'}`,
      tooltipValueGetter: (params) => {
        const val = params.value;
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `[Binary ${(val as any).length} Bytes]`;
        }
        if (typeof val === 'boolean') {
          return val ? 'TRUE' : 'FALSE';
        }
        return String(val);
      },
      sortable: true,
      filter: true,
      resizable: true,
      suppressMovable: false,
      valueGetter: (params) => params.data?.[colIdx],
      cellRenderer: (params: ICellRendererParams) => {
        const val = params.value;
        if (val === null || val === undefined) {
          return '<span class="italic text-dark-500 font-mono text-xxs">NULL</span>';
        }
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `<span class="bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded text-xxs font-sans font-medium border border-indigo-800/50">[Binary ${(val as any).length} B]</span>`;
        }
        if (typeof val === 'boolean') {
          const color = val ? 'text-emerald-400' : 'text-rose-400';
          return `<span class="${color} font-semibold text-xxs">${val ? 'TRUE' : 'FALSE'}</span>`;
        }
        return escapeHtml(String(val));
      },
    };
  });

  return [indexCol, ...dataCols];
});

function onCellContextMenu(event: CellContextMenuEvent) {
  if (event.event) {
    (event.event as Event).preventDefault?.();
    (event.event as Event).stopPropagation?.();
  }
  const mouseEvent = event.event as MouseEvent | undefined;
  if (!mouseEvent) return;

  // Viewport clamping (menu width is 192px / w-48, approximate height ~200px)
  const menuWidth = 200;
  const menuHeight = 200;
  const x = Math.min(mouseEvent.clientX, Math.max(0, window.innerWidth - menuWidth - 8));
  const y = Math.min(mouseEvent.clientY, Math.max(0, window.innerHeight - menuHeight - 8));

  contextMenu.visible = true;
  contextMenu.x = x;
  contextMenu.y = y;
  contextMenu.colName = event.column?.getColId() || '';
  contextMenu.cellValue = event.value;
  contextMenu.rowIndex = event.node?.rowIndex ?? -1;

  function closeMenu() {
    contextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function copyCellValue() {
  if (contextMenu.cellValue !== null && contextMenu.cellValue !== undefined) {
    navigator.clipboard.writeText(String(contextMenu.cellValue));
  } else {
    navigator.clipboard.writeText('NULL');
  }
  contextMenu.visible = false;
}

function copyCurrentRow() {
  if (contextMenu.rowIndex >= 0 && currentSet.value) {
    const row = currentSet.value.rows[contextMenu.rowIndex];
    if (row) {
      const rowStr = row.map(formatCellForExport).join('\t');
      navigator.clipboard.writeText(rowStr);
    }
  }
  contextMenu.visible = false;
}

function togglePinColumn() {
  if (!gridApi.value || !contextMenu.colName) return;
  const col = gridApi.value.getColumn(contextMenu.colName);
  if (!col) return;

  const newPinState = col.isPinned() ? null : 'left';
  gridApi.value.setColumnsPinned([contextMenu.colName], newPinState);
  contextMenu.visible = false;
}

function formatCellForExport(cell: CellValue): string {
  if (cell === null || cell === undefined) return 'NULL';
  if (typeof cell === 'object' && 'type' in cell && cell.type === 'binary') {
    return `[Binary ${cell.length}B]`;
  }
  return String(cell);
}

function copyAsTsv() {
  if (!currentSet.value) return;
  const headers = currentSet.value.columns.map((c) => c.name).join('\t');
  const rows = currentSet.value.rows
    .map((row) => row.map(formatCellForExport).join('\t'))
    .join('\n');
  const fullText = `${headers}\n${rows}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedTsv.value = true;
    setTimeout(() => {
      copiedTsv.value = false;
    }, 2000);
  });
}

function copyAsCsv() {
  if (!currentSet.value) return;
  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headers = currentSet.value.columns.map((c) => escapeCsv(c.name)).join(',');
  const rows = currentSet.value.rows
    .map((row) => row.map((cell) => escapeCsv(formatCellForExport(cell))).join(','))
    .join('\n');
  const fullText = `${headers}\n${rows}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedCsv.value = true;
    setTimeout(() => {
      copiedCsv.value = false;
    }, 2000);
  });
}
</script>
