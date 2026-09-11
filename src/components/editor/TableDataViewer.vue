<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader toolbar for Table Data -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0 space-x-2">
      <div class="flex items-center space-x-2 min-w-0">
        <Table2 class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span class="font-semibold text-dark-100 truncate">{{ schema }}.{{ tableName }}</span>
        <span class="text-dark-600">|</span>
        <span class="text-dark-400 text-xxs flex-shrink-0">
          <strong class="text-emerald-400">{{ rows.length.toLocaleString() }}</strong> rows
        </span>

        <!-- Quick Filter Input -->
        <div class="relative flex items-center w-40 sm:w-56 ml-2">
          <Search class="w-3 h-3 text-dark-500 absolute left-2 pointer-events-none" />
          <input
            v-model="quickFilter"
            type="text"
            placeholder="Filter table data..."
            class="w-full bg-dark-900 border border-dark-700 rounded px-2 py-0.5 pl-7 pr-5 text-xs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 font-mono transition-colors"
          />
          <button
            v-if="quickFilter"
            @click="quickFilter = ''"
            class="absolute right-1 text-dark-400 hover:text-dark-200 p-0.5"
            title="Clear filter"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Copy TSV -->
        <button
          @click="copyAsTsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全部為 TSV (相容 Excel)"
        >
          <Check v-if="copiedTsv" class="w-2.5 h-2.5 text-emerald-400" />
          <FileSpreadsheet v-else class="w-2.5 h-2.5 text-emerald-400" />
          <span>{{ copiedTsv ? 'Copied!' : 'Copy TSV' }}</span>
        </button>

        <!-- Copy JSON -->
        <button
          @click="copyAsJson"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 JSON 物件陣列"
        >
          <Braces class="w-2.5 h-2.5 text-cyan-400" />
          <span>JSON</span>
        </button>

        <!-- Copy Markdown -->
        <button
          @click="copyAsMarkdown"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 Markdown 表格 (貼入 GitHub / Notion)"
        >
          <Table class="w-2.5 h-2.5 text-pink-400" />
          <span>MD</span>
        </button>

        <!-- Reload Data -->
        <button
          @click="loadData"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 text-xxs transition-colors cursor-pointer ml-1"
          title="Reload table data"
        >
          <RotateCw :class="['w-2.5 h-2.5', isLoading ? 'animate-spin text-brand-400' : '']" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center text-dark-400 space-x-2">
      <RotateCw class="w-4 h-4 animate-spin text-brand-400" />
      <span>Loading table data...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 p-4 text-rose-400">
      <div class="font-semibold mb-1">Error querying table:</div>
      <div class="font-mono text-xs bg-rose-950/30 p-3 rounded border border-rose-900/50">{{ error }}</div>
    </div>

    <!-- AG Grid Content -->
    <div
      v-else
      ref="gridContainerRef"
      class="flex-1 w-full overflow-hidden relative"
      @contextmenu.prevent
      @mousedown="onGridMouseDown"
    >
      <AgGridVue
        class="w-full h-full"
        :theme="sqlightGridTheme"
        :row-data="rows"
        :column-defs="columnDefs"
        :quick-filter-text="quickFilter"
        :enable-cell-text-selection="false"
        :ensure-dom-order="true"
        :prevent-default-on-context-menu="true"
        :tooltip-show-mode="'whenTruncated'"
        :tooltip-show-delay="150"
        :tooltip-hide-delay="6000"
        :suppress-row-hover-highlight="false"
        @grid-ready="onGridReady"
        @cell-context-menu="onCellContextMenu"
        @body-scroll="onBodyScroll"
      />
    </div>

    <!-- Excel-Grade Live Aggregate Bar -->
    <div class="h-6 bg-dark-850 border-t border-dark-700 flex items-center justify-between px-3 text-xxs font-sans text-dark-300 flex-shrink-0 select-none">
      <!-- Left: Statistics or Default Summary -->
      <div class="flex items-center space-x-2.5 overflow-x-auto min-w-0">
        <template v-if="selectionStats">
          <div class="flex items-center space-x-1 font-semibold text-brand-300 flex-shrink-0">
            <span>選取:</span>
            <span class="font-mono text-dark-100">{{ selectionStats.totalCells.toLocaleString() }} 格</span>
            <span v-if="selectionStats.numericCount > 0" class="text-dark-400 font-mono text-[10px]">
              ({{ selectionStats.numericCount.toLocaleString() }} 數值)
            </span>
          </div>

          <template v-if="selectionStats.numericCount > 0">
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              總和 (Sum): <strong class="font-mono text-emerald-400">{{ formatAggregateNumber(selectionStats.sum) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              平均 (Avg): <strong class="font-mono text-sky-400">{{ formatAggregateNumber(selectionStats.avg) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              最小值 (Min): <strong class="font-mono text-amber-400">{{ formatAggregateNumber(selectionStats.min) }}</strong>
            </div>
            <span class="text-dark-600 flex-shrink-0">|</span>
            <div class="flex-shrink-0">
              最大值 (Max): <strong class="font-mono text-purple-400">{{ formatAggregateNumber(selectionStats.max) }}</strong>
            </div>
          </template>

          <span class="text-dark-600 flex-shrink-0">|</span>
          <div class="flex-shrink-0">
            非重複計數: <strong class="font-mono text-dark-100">{{ selectionStats.distinctCount.toLocaleString() }}</strong>
          </div>

          <button
            type="button"
            @click="clearCellSelection"
            class="ml-1 text-dark-400 hover:text-dark-200 underline text-[10px] cursor-pointer flex-shrink-0"
            title="清除選取 (Esc)"
          >
            清除
          </button>
        </template>

        <template v-else>
          <div class="flex items-center space-x-2 text-dark-400">
            <span>共 <strong class="font-mono text-dark-200">{{ rows.length.toLocaleString() }}</strong> 列</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-dark-200">{{ columns.length }}</strong> 個欄位</span>
            <span class="text-dark-600">|</span>
            <span class="text-dark-500 italic text-[10px]">提示：滑鼠框選儲存格可查看即時統計 (Sum / Avg / Min / Max)</span>
          </div>
        </template>
      </div>

      <!-- Right: Copy Selection Button -->
      <div v-if="selectionStats" class="flex items-center space-x-1 flex-shrink-0 ml-2">
        <button
          type="button"
          @click="copySelectedCells"
          class="flex items-center space-x-1 px-1.5 py-0.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded border border-brand-500/40 text-[10px] transition-colors cursor-pointer"
          title="複製選取區域內容 (Ctrl+C)"
        >
          <Copy class="w-2.5 h-2.5" />
          <span>複製選取</span>
        </button>
      </div>
    </div>

    <!-- Custom Cell Context Menu -->
    <div
      v-if="contextMenu.visible"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded shadow-xl py-1 w-52 text-xs font-sans text-dark-200 select-none"
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

      <button
        @click="copyCurrentRowAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-teal-400" />
        <span>複製整列為 JSON (Row JSON)</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <!-- Selection Copy (if range active) -->
      <button
        v-if="selectionRange"
        @click="copySelectedCells"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Copy class="w-3.5 h-3.5 text-brand-300" />
        <span>複製選取區域 ({{ selectionStats?.totalCells }} 格)</span>
      </button>

      <button
        v-if="selectionRange"
        @click="copySelectedAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-cyan-400" />
        <span>複製選取為 JSON 物件陣列</span>
      </button>

      <!-- DML SQL Generation Options -->
      <button
        @click="handleGenerateDml('INSERT')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <PlusCircle class="w-3.5 h-3.5 text-sky-400" />
        <span>建立 INSERT 語法</span>
      </button>

      <button
        @click="handleGenerateDml('UPDATE')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Edit3 class="w-3.5 h-3.5 text-amber-400" />
        <span>建立 UPDATE 語法</span>
      </button>

      <button
        @click="handleGenerateDml('DELETE')"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Trash2 class="w-3.5 h-3.5 text-rose-400" />
        <span>建立 DELETE 語法</span>
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

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="copyAsTsv"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileSpreadsheet class="w-3.5 h-3.5 text-indigo-400" />
        <span>複製全表為 TSV (Excel)</span>
      </button>

      <button
        @click="copyAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-cyan-400" />
        <span>複製全表為 JSON</span>
      </button>

      <button
        @click="copyAsMarkdown"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Table class="w-3.5 h-3.5 text-pink-400" />
        <span>複製全表為 Markdown 表格</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import {
  Table2,
  RotateCw,
  Search,
  X,
  Check,
  FileSpreadsheet,
  FileText,
  Copy,
  Pin,
  PinOff,
  PlusCircle,
  Edit3,
  Trash2,
  Braces,
  Table,
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
import { queryService } from '@/services/queryService';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSchemaStore } from '@/stores/schemaStore';
import {
  exportRowAsJson,
  exportRowsAsJson,
  exportRowsAsMarkdown,
} from '@/utils/exportFormatters';
import {
  generateInsertStatement,
  generateUpdateStatement,
  generateDeleteStatement,
  type ColumnInfo,
} from '@/utils/sqlGenerator';
import type { ColumnDef, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  schema: string;
  tableName: string;
}>();

const connectionStore = useConnectionStore();
const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const schemaStore = useSchemaStore();
const isLoading = ref(false);
const error = ref<string | null>(null);
const columns = ref<ColumnDef[]>([]);
const rows = ref<CellValue[][]>([]);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);
const copiedTsv = ref(false);

// Mapping column name to index
const colNameToIndex = computed(() => {
  const map = new Map<string, number>();
  columns.value.forEach((c, idx) => {
    map.set(c.name, idx);
  });
  return map;
});

// Cell Selection & Aggregates State
interface CellCoord {
  rowIndex: number;
  colIndex: number;
}

interface SelectionRange {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

interface SelectionStats {
  totalCells: number;
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  distinctCount: number;
}

const isSelecting = ref(false);
const dragStart = ref<CellCoord | null>(null);
const dragEnd = ref<CellCoord | null>(null);
const selectionRange = ref<SelectionRange | null>(null);
const selectionStats = ref<SelectionStats | null>(null);

function formatAggregateNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function computeSelectionStats() {
  if (!dragStart.value || !dragEnd.value || !rows.value.length) {
    selectionRange.value = null;
    selectionStats.value = null;
    return;
  }

  const minRow = Math.max(0, Math.min(dragStart.value.rowIndex, dragEnd.value.rowIndex));
  const maxRow = Math.min(rows.value.length - 1, Math.max(dragStart.value.rowIndex, dragEnd.value.rowIndex));
  const minCol = Math.max(0, Math.min(dragStart.value.colIndex, dragEnd.value.colIndex));
  const maxCol = Math.min(columns.value.length - 1, Math.max(dragStart.value.colIndex, dragEnd.value.colIndex));

  selectionRange.value = { minRow, maxRow, minCol, maxCol };

  const totalCells = (maxRow - minRow + 1) * (maxCol - minCol + 1);
  const distinctValues = new Set<string>();
  const numericValues: number[] = [];

  for (let r = minRow; r <= maxRow; r++) {
    const row = rows.value[r];
    if (!row) continue;
    for (let c = minCol; c <= maxCol; c++) {
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
  const container = gridContainerRef.value;
  if (!container) return;

  const range = selectionRange.value;
  const cells = container.querySelectorAll('.ag-cell');

  cells.forEach((cell) => {
    if (!range) {
      cell.classList.remove('sqlight-cell-selected');
      return;
    }
    const rStr = cell.getAttribute('row-index');
    const cId = cell.getAttribute('col-id');
    if (rStr == null || !cId) {
      cell.classList.remove('sqlight-cell-selected');
      return;
    }
    const r = parseInt(rStr, 10);
    const c = colNameToIndex.value.get(cId);
    if (c != null && r >= range.minRow && r <= range.maxRow && c >= range.minCol && c <= range.maxCol) {
      cell.classList.add('sqlight-cell-selected');
    } else {
      cell.classList.remove('sqlight-cell-selected');
    }
  });
}

function clearCellSelection() {
  dragStart.value = null;
  dragEnd.value = null;
  selectionRange.value = null;
  selectionStats.value = null;
  isSelecting.value = false;
  updateSelectionHighlight();
}

function onGridMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;

  // Check if clicked inside column header -> Select whole column
  const headerCell = target.closest('.ag-header-cell');
  if (headerCell && rows.value.length > 0) {
    const cId = headerCell.getAttribute('col-id');
    if (cId && colNameToIndex.value.has(cId)) {
      const colIdx = colNameToIndex.value.get(cId)!;
      dragStart.value = { rowIndex: 0, colIndex: colIdx };
      dragEnd.value = { rowIndex: rows.value.length - 1, colIndex: colIdx };
      computeSelectionStats();
      updateSelectionHighlight();
      return;
    }
  }

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

  // If clicked on '#' index column -> Select whole row
  if (!cId || cId === '#') {
    if (rows.value.length > 0) {
      dragStart.value = { rowIndex: r, colIndex: 0 };
      dragEnd.value = { rowIndex: r, colIndex: columns.value.length - 1 };
      computeSelectionStats();
      updateSelectionHighlight();
    }
    return;
  }

  const colIdx = colNameToIndex.value.get(cId);
  if (colIdx === undefined) return;

  e.preventDefault();

  isSelecting.value = true;
  dragStart.value = { rowIndex: r, colIndex: colIdx };
  dragEnd.value = { rowIndex: r, colIndex: colIdx };
  computeSelectionStats();
  updateSelectionHighlight();
}

function handleGlobalMouseMove(e: MouseEvent) {
  if (!isSelecting.value || !gridContainerRef.value) return;

  const target = e.target as HTMLElement;
  const cellEl = target.closest('.ag-cell');
  if (!cellEl) return;

  const rStr = cellEl.getAttribute('row-index');
  const cId = cellEl.getAttribute('col-id');
  if (rStr == null || !cId) return;

  const r = parseInt(rStr, 10);
  const colIdx = colNameToIndex.value.get(cId);
  if (isNaN(r) || colIdx === undefined) return;

  if (dragEnd.value?.rowIndex !== r || dragEnd.value?.colIndex !== colIdx) {
    dragEnd.value = { rowIndex: r, colIndex: colIdx };
    computeSelectionStats();
    updateSelectionHighlight();
  }
}

function handleGlobalMouseUp() {
  if (isSelecting.value) {
    isSelecting.value = false;
  }
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    clearCellSelection();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectionRange.value) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return;
    }
    copySelectedCells();
  }
}

function onBodyScroll() {
  updateSelectionHighlight();
}

onMounted(() => {
  loadData();
  window.addEventListener('mousemove', handleGlobalMouseMove);
  window.addEventListener('mouseup', handleGlobalMouseUp);
  window.addEventListener('keydown', handleGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove);
  window.removeEventListener('mouseup', handleGlobalMouseUp);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});

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
  
  const headerWidth = Math.ceil(estimateTextWidth(headerName, false) + 48);
  const firstRowWidth = firstRowVal !== undefined && firstRowStr.length > 0
    ? Math.ceil(estimateTextWidth(firstRowStr, true) + 28)
    : 0;

  const calculated = Math.max(headerWidth, firstRowWidth);
  return Math.min(Math.max(calculated, 75), 600);
}

// Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  if (!columns.value.length) return [];

  const rowCount = rows.value.length;
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
    headerClass: 'text-center !px-1 cursor-pointer',
  };

  const firstRow = rows.value[0];

  const dataCols: ColDef[] = columns.value.map((col, colIdx) => {
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const colWidth = calculateColumnWidth(col.name, firstVal);

    return {
      colId: col.name,
      field: `col_${colIdx}`,
      headerName: col.name,
      width: colWidth,
      minWidth: 70,
      tooltipShowMode: 'whenTruncated',
      headerTooltip: `型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'} (點選標題選取整欄)`,
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

  const menuWidth = 220;
  const menuHeight = 360;
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

function handleGenerateDml(type: 'INSERT' | 'UPDATE' | 'DELETE') {
  if (contextMenu.rowIndex < 0 || rows.value.length <= contextMenu.rowIndex) {
    contextMenu.visible = false;
    return;
  }
  const row = rows.value[contextMenu.rowIndex];
  if (!row) {
    contextMenu.visible = false;
    return;
  }

  const tableName = props.tableName;
  const schema = props.schema;
  const connId = connectionStore.activeConnectionId || undefined;
  const db = connectionStore.activeDatabase || undefined;

  // Resolve PKs from schemaStore
  const tableSchema = connId && db ? schemaStore.getTable(tableName, connId, db) : undefined;
  const pkColNames = new Set(
    tableSchema?.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.name.toLowerCase()) ?? []
  );

  const columnInfos: ColumnInfo[] = columns.value.map((col) => ({
    name: col.name,
    dataType: col.dataType,
    isPrimaryKey: pkColNames.has(col.name.toLowerCase()),
  }));

  let generated = '';
  if (type === 'INSERT') {
    generated = generateInsertStatement({
      tableName,
      schema,
      columns: columnInfos,
      row,
    });
  } else if (type === 'UPDATE') {
    generated = generateUpdateStatement({
      tableName,
      schema,
      columns: columnInfos,
      row,
    });
  } else if (type === 'DELETE') {
    generated = generateDeleteStatement({
      tableName,
      schema,
      columns: columnInfos,
      row,
    });
  }

  try {
    navigator.clipboard?.writeText(generated);
  } catch (err) {
    // Ignore clipboard error
  }

  workspaceStore.addSqlTab(generated, `${type}: ${tableName}`);
  workspaceStore.showToast(`已建立 ${type} 語法並開啟新分頁（已複製至剪貼簿）`, 'success', 2500);

  contextMenu.visible = false;
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
  if (contextMenu.rowIndex >= 0 && rows.value.length > contextMenu.rowIndex) {
    const row = rows.value[contextMenu.rowIndex];
    if (row) {
      const rowStr = row.map(formatCellForExport).join('\t');
      navigator.clipboard.writeText(rowStr);
      workspaceStore.showToast('已複製整列資料至剪貼簿 (TSV)', 'success', 2000);
    }
  }
  contextMenu.visible = false;
}

function copyCurrentRowAsJson() {
  if (contextMenu.rowIndex >= 0 && rows.value.length > contextMenu.rowIndex) {
    const row = rows.value[contextMenu.rowIndex];
    if (row) {
      const jsonStr = exportRowAsJson(columns.value, row);
      navigator.clipboard.writeText(jsonStr);
      workspaceStore.showToast('已複製目前列為 JSON 物件', 'success', 2000);
    }
  }
  contextMenu.visible = false;
}

function copySelectedCells() {
  if (!selectionRange.value || !rows.value.length) return;
  const { minRow, maxRow, minCol, maxCol } = selectionRange.value;

  const lines: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const row = rows.value[r];
    if (!row) continue;
    const rowCells: string[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      rowCells.push(formatCellForExport(row[c]));
    }
    lines.push(rowCells.join('\t'));
  }

  navigator.clipboard.writeText(lines.join('\n'));
  workspaceStore.showToast(`已複製選取區域 (${selectionStats.value?.totalCells} 格) 至剪貼簿`, 'success', 2000);
  contextMenu.visible = false;
}

function copySelectedAsJson() {
  if (!selectionRange.value || !rows.value.length) return;
  const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
  const cols = columns.value.slice(minCol, maxCol + 1);
  const rowsSlice = rows.value
    .slice(minRow, maxRow + 1)
    .map((r) => r.slice(minCol, maxCol + 1));

  const jsonStr = exportRowsAsJson(cols, rowsSlice);
  navigator.clipboard.writeText(jsonStr);
  workspaceStore.showToast(`已複製選取區域為 JSON 物件陣列 (${rowsSlice.length} 筆)`, 'success', 2000);
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

function formatCellForExport(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return 'NULL';
  if (typeof cell === 'object' && 'type' in cell && cell.type === 'binary') {
    return `[Binary ${cell.length}B]`;
  }
  return String(cell);
}

function copyAsTsv() {
  if (!rows.value.length) return;
  const headers = columns.value.map((c) => c.name).join('\t');
  const rowsText = rows.value
    .map((row) => row.map(formatCellForExport).join('\t'))
    .join('\n');
  const fullText = `${headers}\n${rowsText}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedTsv.value = true;
    workspaceStore.showToast(`已複製全表為 TSV (${rows.value.length} 筆)`, 'success', 2000);
    setTimeout(() => {
      copiedTsv.value = false;
    }, 2000);
  });
  contextMenu.visible = false;
}

function copyAsJson() {
  if (!rows.value.length) return;
  const jsonStr = exportRowsAsJson(columns.value, rows.value);
  navigator.clipboard.writeText(jsonStr).then(() => {
    workspaceStore.showToast(`已複製全表為 JSON 物件陣列 (${rows.value.length} 筆)`, 'success', 2000);
  });
  contextMenu.visible = false;
}

function copyAsMarkdown() {
  if (!rows.value.length) return;
  const mdStr = exportRowsAsMarkdown(columns.value, rows.value);
  navigator.clipboard.writeText(mdStr).then(() => {
    workspaceStore.showToast(`已複製全表為 Markdown 表格`, 'success', 2000);
  });
  contextMenu.visible = false;
}

async function loadData() {
  const connId = connectionStore.activeConnectionId;
  if (!connId) {
    error.value = 'No active connection';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const limit = queryStore.maxRows ?? 10000;
    const sql = `SELECT TOP ${limit} * FROM [${props.schema}].[${props.tableName}];`;
    const res = await queryService.executeQuery(connId, sql, limit);
    if (res.resultSets.length > 0 && res.resultSets[0]) {
      columns.value = res.resultSets[0].columns;
      rows.value = res.resultSets[0].rows;
    } else {
      columns.value = [];
      rows.value = [];
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
    clearCellSelection();
  }
}
</script>

<style scoped>
:deep(.sqlight-cell-selected) {
  background-color: rgba(59, 130, 246, 0.22) !important;
  box-shadow: inset 0 0 0 1px #3b82f6 !important;
}
</style>
