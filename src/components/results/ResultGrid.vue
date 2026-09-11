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
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全部為 TSV (相容 Excel 貼上)"
        >
          <Check v-if="copiedTsv" class="w-2.5 h-2.5 text-emerald-400" />
          <FileSpreadsheet v-else class="w-2.5 h-2.5 text-emerald-400" />
          <span>{{ copiedTsv ? 'Copied!' : 'Copy TSV' }}</span>
        </button>

        <!-- Copy to CSV -->
        <button
          @click="copyAsCsv"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製為 CSV 格式"
        >
          <Check v-if="copiedCsv" class="w-2.5 h-2.5 text-brand-400" />
          <FileText v-else class="w-2.5 h-2.5 text-brand-400" />
          <span>{{ copiedCsv ? 'Copied!' : 'CSV' }}</span>
        </button>

        <!-- Copy as JSON -->
        <button
          @click="copyAsJson"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 JSON 物件陣列"
        >
          <Braces class="w-2.5 h-2.5 text-cyan-400" />
          <span>JSON</span>
        </button>

        <!-- Copy as Markdown -->
        <button
          @click="copyAsMarkdown"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors cursor-pointer"
          title="複製全表為 Markdown 表格 (貼入 GitHub / Notion)"
        >
          <Table class="w-2.5 h-2.5 text-pink-400" />
          <span>MD</span>
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
    <div
      v-else
      ref="gridContainerRef"
      class="flex-1 w-full overflow-hidden relative"
      @contextmenu.prevent
      @mousedown="onGridMouseDown"
      @click="onGridClick"
    >
      <AgGridVue
        class="w-full h-full"
        :theme="sqlightGridTheme"
        :row-data="currentSet.rows"
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
        @column-moved="onColumnMoved"
      />
    </div>

    <!-- Excel-Grade Live Aggregate Bar -->
    <div class="h-6 bg-dark-850 border-t border-dark-700 flex items-center justify-between px-3 text-xxs font-sans text-dark-300 flex-shrink-0 select-none">
      <!-- Left: Statistics or Default Summary -->
      <div class="flex items-center space-x-2.5 overflow-x-auto min-w-0">
        <template v-if="selectionStats">
          <div class="flex items-center space-x-1 font-semibold text-brand-300 flex-shrink-0">
            <span>選取:</span>
            <span v-if="selectedColumnsCount > 1" class="text-amber-300 font-mono">
              {{ selectedColumnsCount }} 欄
            </span>
            <span class="font-mono text-dark-100">
              {{ selectedColumnsCount > 1 ? `(${selectionStats.totalCells.toLocaleString()} 格)` : `${selectionStats.totalCells.toLocaleString()} 格` }}
            </span>
            <span v-if="selectionStats.numericCount > 0" class="text-dark-400 font-mono text-[10px]">
              [{{ selectionStats.numericCount.toLocaleString() }} 數值]
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
            <span>共 <strong class="font-mono text-dark-200">{{ currentSet?.rows.length.toLocaleString() ?? 0 }}</strong> 列</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-dark-200">{{ currentSet?.columns.length ?? 0 }}</strong> 個欄位</span>
            <span class="text-dark-600">|</span>
            <span class="text-dark-500 italic text-[10px]">提示：支援標題列拖曳多欄選取、Shift 連續多欄、Ctrl 多選、儲存格框選與 Ctrl+A 全選</span>
          </div>
        </template>
      </div>

      <!-- Right: Copy Selection Button -->
      <div v-if="selectionStats" class="flex items-center space-x-1 flex-shrink-0 ml-2">
        <button
          type="button"
          @click="copySelectedCells"
          class="flex items-center space-x-1 px-1.5 py-0.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded border border-brand-500/40 text-[10px] transition-colors cursor-pointer"
          title="複製選取內容 (Ctrl+C)"
        >
          <Copy class="w-2.5 h-2.5" />
          <span>複製選取</span>
        </button>
      </div>
    </div>

    <!-- Custom Context Menu for Cells & Column Pinning -->
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

      <!-- Selection Copy (if selection active) -->
      <button
        v-if="hasSelection"
        @click="copySelectedCells"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Copy class="w-3.5 h-3.5 text-brand-300" />
        <span>複製選取內容 ({{ selectionStats?.totalCells }} 格)</span>
      </button>

      <button
        v-if="hasSelection"
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
  type ColumnMovedEvent,
} from 'ag-grid-community';
import { sqlightGridTheme } from '@/styles/gridTheme';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
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
  parseTargetTableFromSql,
  type ColumnInfo,
} from '@/utils/sqlGenerator';
import type { ResultSet, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  resultSets: ResultSet[];
}>();

const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const schemaStore = useSchemaStore();

const activeSetIndex = ref(0);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);
const copiedTsv = ref(false);
const copiedCsv = ref(false);

const currentSet = computed(() => {
  return props.resultSets[activeSetIndex.value] ?? props.resultSets[0] ?? null;
});

// Helper to extract 0-based column index from standard colId `col_N`
function getColIndex(colId: string | null | undefined): number | undefined {
  if (!colId) return undefined;
  if (colId.startsWith('col_')) {
    const idx = parseInt(colId.substring(4), 10);
    return isNaN(idx) ? undefined : idx;
  }
  return undefined;
}

// Helper to get visual display column data indices (reflecting user column drag-reordering)
function getVisualDataColIndices(): number[] {
  if (!gridApi.value) {
    return currentSet.value?.columns.map((_, i) => i) ?? [];
  }
  const cols = gridApi.value.getAllGridColumns();
  if (!cols || !cols.length) {
    return currentSet.value?.columns.map((_, i) => i) ?? [];
  }
  return cols
    .map((c) => c.getColId())
    .filter((id) => id && id !== 'row_index' && id !== '#')
    .map((id) => getColIndex(id))
    .filter((idx): idx is number => idx !== undefined);
}

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

// Selection states
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

// Tracks mousedown on column header to distinguish drag (column move) from click (column select)
let headerMouseDownInfo: {
  x: number;
  y: number;
  time: number;
  colId: string;
} | null = null;

const hasSelection = computed(() => {
  return selectedColSet.value.size > 0 || selectionRange.value !== null;
});

const selectedColumnsCount = computed(() => {
  if (selectedColSet.value.size > 0) {
    return selectedColSet.value.size;
  }
  if (selectionRange.value && currentSet.value) {
    const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
    if (minRow === 0 && maxRow === currentSet.value.rows.length - 1) {
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
  if (selectionRange.value && currentSet.value) {
    const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
    const colPosition = vColIdx !== undefined ? vColIdx : c;
    return (
      minRow === 0 &&
      maxRow === currentSet.value.rows.length - 1 &&
      colPosition >= minCol &&
      colPosition <= maxCol
    );
  }
  return false;
}

function formatAggregateNumber(num: number): string {
  if (Number.isInteger(num)) {
    return num.toLocaleString();
  }
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function computeSelectionStats() {
  if (!currentSet.value || !hasSelection.value) {
    selectionStats.value = null;
    return;
  }

  const distinctValues = new Set<string>();
  const numericValues: number[] = [];
  let totalCells = 0;

  if (selectedColSet.value.size > 0) {
    const colIndices = Array.from(selectedColSet.value);
    const rowCount = currentSet.value.rows.length;
    totalCells = colIndices.length * rowCount;

    for (let r = 0; r < rowCount; r++) {
      const row = currentSet.value.rows[r];
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
      const row = currentSet.value.rows[r];
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
  const container = gridContainerRef.value;
  if (!container) return;

  const visualIndices = getVisualDataColIndices();

  const cells = container.querySelectorAll('.ag-cell');
  cells.forEach((cell) => {
    if (!hasSelection.value) {
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
    const c = getColIndex(cId);
    if (c !== undefined) {
      const vIdx = visualIndices.indexOf(c);
      if (isCellInSelection(r, c, vIdx >= 0 ? vIdx : undefined)) {
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
      const vIdx = visualIndices.indexOf(c);
      if (isColumnSelected(c, vIdx >= 0 ? vIdx : undefined)) {
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
  if (!currentSet.value || currentSet.value.rows.length === 0) return;
  selectedColSet.value.clear();
  const visualIndices = getVisualDataColIndices();
  selectionRange.value = {
    minRow: 0,
    maxRow: currentSet.value.rows.length - 1,
    minCol: 0,
    maxCol: visualIndices.length - 1,
  };
  computeSelectionStats();
  updateSelectionHighlight();
}

function onGridMouseDown(e: MouseEvent) {
  if (e.button !== 0 || !currentSet.value) return; // Only handle left clicks
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

  const colCount = currentSet.value.columns.length;
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
  if (e.button !== 0 || !currentSet.value) return;
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

  const rowCount = currentSet.value.rows.length;
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
  if (!gridContainerRef.value || !currentSet.value) return;

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
          maxCol: visualIndices.length > 0 ? visualIndices.length - 1 : currentSet.value.columns.length - 1,
        };
        computeSelectionStats();
        updateSelectionHighlight();
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

    const visualIndices = getVisualDataColIndices();
    const vIdx = visualIndices.indexOf(c);
    if (vIdx === -1) return;

    if (cellDragEnd.value?.rowIndex !== r || cellDragEnd.value?.colIndex !== vIdx) {
      cellDragEnd.value = { rowIndex: r, colIndex: vIdx };
      const minRow = Math.min(cellDragStart.value.rowIndex, r);
      const maxRow = Math.max(cellDragStart.value.rowIndex, r);
      const minCol = Math.min(cellDragStart.value.colIndex, vIdx);
      const maxCol = Math.max(cellDragStart.value.colIndex, vIdx);
      selectionRange.value = { minRow, maxRow, minCol, maxCol };
      computeSelectionStats();
      updateSelectionHighlight();
    }
  }
}

function handleGlobalMouseUp() {
  if (isCellDragging.value) isCellDragging.value = false;
  if (isRowDragging.value) isRowDragging.value = false;
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
    if (gridContainerRef.value && gridContainerRef.value.contains(document.activeElement || null)) {
      e.preventDefault();
      selectAll();
      return;
    }
  }

  // Ctrl+C / Cmd+C: Copy Selected Cells / Columns
  if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && hasSelection.value) {
    e.preventDefault();
    copySelectedCells();
  }
}

function onBodyScroll() {
  updateSelectionHighlight();
}

onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove);
  window.addEventListener('mouseup', handleGlobalMouseUp);
  window.addEventListener('keydown', handleGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove);
  window.removeEventListener('mouseup', handleGlobalMouseUp);
  window.removeEventListener('keydown', handleGlobalKeyDown);
});

// Custom cell context menu state
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  colId: string;
  colName: string;
  cellValue: unknown;
  rowIndex: number;
}>({
  visible: false,
  x: 0,
  y: 0,
  colId: '',
  colName: '',
  cellValue: null,
  rowIndex: -1,
});

const isColPinned = computed(() => {
  if (!gridApi.value || !contextMenu.colId) return false;
  const col = gridApi.value.getColumn(contextMenu.colId);
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

// AG Grid Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  if (!currentSet.value) return [];

  // 1. Pinned Row Index Column (#)
  const rowCount = currentSet.value.rows.length;
  const digits = Math.max(2, String(rowCount).length);
  const indexWidth = Math.max(60, digits * 10 + 36);

  const indexCol: ColDef = {
    colId: 'row_index',
    headerName: '#',
    pinned: 'left',
    width: indexWidth,
    minWidth: 48,
    suppressMovable: true,
    lockPosition: 'left',
    sortable: false,
    filter: false,
    resizable: true,
    valueGetter: (params) => (params.node?.rowIndex != null ? params.node.rowIndex + 1 : ''),
    cellClass: 'text-dark-500 bg-dark-850/40 text-center font-mono text-xxs select-none !px-1 cursor-pointer',
    headerClass: 'text-center !px-1 cursor-pointer select-none',
    headerTooltip: '點選此處全選表格 (Select All)',
  };

  const firstRow = currentSet.value.rows[0];

  // 2. Dynamic Data Columns with standardized colId: `col_${colIdx}`
  const dataCols: ColDef[] = currentSet.value.columns.map((col, colIdx) => {
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const colWidth = calculateColumnWidth(col.name, firstVal);

    return {
      colId: `col_${colIdx}`,
      field: `col_${colIdx}`,
      headerName: col.name,
      width: colWidth,
      minWidth: 70,
      suppressMovable: false, // Allows dragging column headers to reorder
      tooltipShowMode: 'whenTruncated',
      headerTooltip: `型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'} (拖曳表頭調整順序，點擊或 Shift 點選)`,
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

  const cId = event.column?.getColId() || '';
  const colIdx = getColIndex(cId);
  const realColName = colIdx !== undefined && currentSet.value ? currentSet.value.columns[colIdx]?.name : cId;

  contextMenu.visible = true;
  contextMenu.x = x;
  contextMenu.y = y;
  contextMenu.colId = cId;
  contextMenu.colName = realColName || '';
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
  if (contextMenu.rowIndex < 0 || !currentSet.value) {
    contextMenu.visible = false;
    return;
  }
  const row = currentSet.value.rows[contextMenu.rowIndex];
  if (!row) {
    contextMenu.visible = false;
    return;
  }

  const tab = queryStore.activeResultTab;
  const sql = tab?.sql || '';
  const parsedTarget = parseTargetTableFromSql(sql);

  const tableName = parsedTarget?.tableName || tab?.tableName || tab?.title || 'TargetTable';
  const schema = parsedTarget?.schema;

  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;

  // Resolve PKs from schemaStore if available
  const tableSchema = connId && db ? schemaStore.getTable(tableName, connId, db) : undefined;
  const pkColNames = new Set(
    tableSchema?.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.name.toLowerCase()) ?? []
  );

  const columns: ColumnInfo[] = currentSet.value.columns.map((col) => ({
    name: col.name,
    dataType: col.dataType,
    isPrimaryKey: pkColNames.has(col.name.toLowerCase()),
  }));

  let generated = '';
  if (type === 'INSERT') {
    generated = generateInsertStatement({
      tableName,
      schema,
      columns,
      row,
    });
  } else if (type === 'UPDATE') {
    generated = generateUpdateStatement({
      tableName,
      schema,
      columns,
      row,
    });
  } else if (type === 'DELETE') {
    generated = generateDeleteStatement({
      tableName,
      schema,
      columns,
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
  if (contextMenu.rowIndex >= 0 && currentSet.value) {
    const row = currentSet.value.rows[contextMenu.rowIndex];
    if (row) {
      const rowStr = row.map(formatCellForExport).join('\t');
      navigator.clipboard.writeText(rowStr);
      workspaceStore.showToast('已複製整列資料至剪貼簿 (TSV)', 'success', 2000);
    }
  }
  contextMenu.visible = false;
}

function copyCurrentRowAsJson() {
  if (contextMenu.rowIndex >= 0 && currentSet.value) {
    const row = currentSet.value.rows[contextMenu.rowIndex];
    if (row) {
      const jsonStr = exportRowAsJson(currentSet.value.columns, row);
      navigator.clipboard.writeText(jsonStr);
      workspaceStore.showToast('已複製目前列為 JSON 物件', 'success', 2000);
    }
  }
  contextMenu.visible = false;
}

function copySelectedCells() {
  if (!currentSet.value || !hasSelection.value) return;

  const lines: string[] = [];
  const visualIndices = getVisualDataColIndices();

  if (selectedColSet.value.size > 0) {
    const activeIndices = visualIndices.filter((cIdx) => selectedColSet.value.has(cIdx));
    lines.push(activeIndices.map((cIdx) => currentSet.value!.columns[cIdx]?.name || '').join('\t'));
    for (let r = 0; r < currentSet.value.rows.length; r++) {
      const row = currentSet.value.rows[r];
      if (!row) continue;
      lines.push(activeIndices.map((cIdx) => formatCellForExport(row[cIdx])).join('\t'));
    }
  } else if (selectionRange.value) {
    const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
    const rangeIndices = visualIndices.filter((_, vIdx) => vIdx >= minCol && vIdx <= maxCol);
    if (minRow === 0 && maxRow === currentSet.value.rows.length - 1) {
      lines.push(rangeIndices.map((cIdx) => currentSet.value!.columns[cIdx]?.name || '').join('\t'));
    }
    for (let r = minRow; r <= maxRow; r++) {
      const row = currentSet.value.rows[r];
      if (!row) continue;
      const rowCells: string[] = [];
      for (const cIdx of rangeIndices) {
        rowCells.push(formatCellForExport(row[cIdx]));
      }
      lines.push(rowCells.join('\t'));
    }
  }

  navigator.clipboard.writeText(lines.join('\n'));
  workspaceStore.showToast(`已複製選取內容 (${selectionStats.value?.totalCells} 格) 至剪貼簿`, 'success', 2000);
  contextMenu.visible = false;
}

function copySelectedAsJson() {
  if (!currentSet.value || !hasSelection.value) return;

  let cols: { name: string }[] = [];
  let rowsData: unknown[][] = [];
  const visualIndices = getVisualDataColIndices();

  if (selectedColSet.value.size > 0) {
    const activeIndices = visualIndices.filter((cIdx) => selectedColSet.value.has(cIdx));
    cols = activeIndices.map((cIdx) => ({ name: currentSet.value!.columns[cIdx]?.name || '' }));
    rowsData = currentSet.value.rows.map((r) => activeIndices.map((cIdx) => r[cIdx]));
  } else if (selectionRange.value) {
    const { minRow, maxRow, minCol, maxCol } = selectionRange.value;
    const rangeIndices = visualIndices.filter((_, vIdx) => vIdx >= minCol && vIdx <= maxCol);
    cols = rangeIndices.map((cIdx) => ({ name: currentSet.value!.columns[cIdx]?.name || '' }));
    rowsData = currentSet.value.rows
      .slice(minRow, maxRow + 1)
      .map((r) => rangeIndices.map((cIdx) => r[cIdx]));
  }

  const jsonStr = exportRowsAsJson(cols, rowsData);
  navigator.clipboard.writeText(jsonStr);
  workspaceStore.showToast(`已複製選取為 JSON (${rowsData.length} 列 x ${cols.length} 欄)`, 'success', 2000);
  contextMenu.visible = false;
}

function togglePinColumn() {
  if (!gridApi.value || !contextMenu.colId) return;
  const col = gridApi.value.getColumn(contextMenu.colId);
  if (!col) return;

  const newPinState = col.isPinned() ? null : 'left';
  gridApi.value.setColumnsPinned([contextMenu.colId], newPinState);
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
  if (!currentSet.value) return;
  const visualIndices = getVisualDataColIndices();
  const headers = visualIndices.map((cIdx) => currentSet.value!.columns[cIdx]?.name || '').join('\t');
  const rows = currentSet.value.rows
    .map((row) => visualIndices.map((cIdx) => formatCellForExport(row[cIdx])).join('\t'))
    .join('\n');
  const fullText = `${headers}\n${rows}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedTsv.value = true;
    workspaceStore.showToast(`已複製全表為 TSV (${currentSet.value?.rows.length} 筆)`, 'success', 2000);
    setTimeout(() => {
      copiedTsv.value = false;
    }, 2000);
  });
  contextMenu.visible = false;
}

function copyAsCsv() {
  if (!currentSet.value) return;
  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const visualIndices = getVisualDataColIndices();
  const headers = visualIndices.map((cIdx) => escapeCsv(currentSet.value!.columns[cIdx]?.name || '')).join(',');
  const rows = currentSet.value.rows
    .map((row) => visualIndices.map((cIdx) => escapeCsv(formatCellForExport(row[cIdx]))).join(','))
    .join('\n');
  const fullText = `${headers}\n${rows}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedCsv.value = true;
    workspaceStore.showToast(`已複製全表為 CSV (${currentSet.value?.rows.length} 筆)`, 'success', 2000);
    setTimeout(() => {
      copiedCsv.value = false;
    }, 2000);
  });
  contextMenu.visible = false;
}

function copyAsJson() {
  if (!currentSet.value) return;
  const visualIndices = getVisualDataColIndices();
  const cols = visualIndices.map((cIdx) => ({ name: currentSet.value!.columns[cIdx]?.name || '' }));
  const rowsData = currentSet.value.rows.map((r) => visualIndices.map((cIdx) => r[cIdx]));
  const jsonStr = exportRowsAsJson(cols, rowsData);
  navigator.clipboard.writeText(jsonStr).then(() => {
    workspaceStore.showToast(`已複製全表為 JSON 物件陣列 (${currentSet.value?.rows.length} 筆)`, 'success', 2000);
  });
  contextMenu.visible = false;
}

function copyAsMarkdown() {
  if (!currentSet.value) return;
  const visualIndices = getVisualDataColIndices();
  const cols = visualIndices.map((cIdx) => ({ name: currentSet.value!.columns[cIdx]?.name || '' }));
  const rowsData = currentSet.value.rows.map((r) => visualIndices.map((cIdx) => r[cIdx]));
  const mdStr = exportRowsAsMarkdown(cols, rowsData);
  navigator.clipboard.writeText(mdStr).then(() => {
    workspaceStore.showToast(`已複製全表為 Markdown 表格`, 'success', 2000);
  });
  contextMenu.visible = false;
}
</script>

<style scoped>
:deep(.sqlight-cell-selected) {
  background-color: rgba(59, 130, 246, 0.22) !important;
  box-shadow: inset 0 0 0 1px #3b82f6 !important;
}

:deep(.sqlight-header-selected) {
  background-color: rgba(59, 130, 246, 0.28) !important;
  color: #93c5fd !important;
  font-weight: 700 !important;
}
</style>
