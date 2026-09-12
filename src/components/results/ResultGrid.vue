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

        <!-- Estimated Plan Badge -->
        <div
          v-if="queryStore.activeResultTab?.isShowplan"
          class="hidden md:flex items-center space-x-1 bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded text-xxs font-sans truncate shadow-xs"
          title="此結果分頁為 SET SHOWPLAN_ALL ON 預估執行計畫，未實際執行語句"
        >
          <Workflow class="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span>預估執行計畫 (Estimated Plan)</span>
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
import { ref, computed, reactive, watch } from 'vue';
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
  Workflow,
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
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSchemaStore } from '@/stores/schemaStore';
import {
  escapeHtml,
  calculateColumnWidth,
} from '@/composables/useColumnAutoWidth';
import { useGridSelection } from '@/composables/useGridSelection';
import { useGridExport } from '@/composables/useGridExport';
import {
  generateInsertStatement,
  generateUpdateStatement,
  generateDeleteStatement,
  parseTargetTableFromSql,
  extractAllTableNamesFromSql,
  type ColumnInfo,
  type GenerateDmlParams,
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

const currentSet = computed(() => {
  return props.resultSets[activeSetIndex.value] ?? props.resultSets[0] ?? null;
});

// Set of lowercased primary key column names for the active query result
const primaryKeyColumnNames = computed<Set<string>>(() => {
  const tab = queryStore.activeResultTab;
  const connId = tab?.connectionId || connectionStore.activeConnectionId;
  const db = tab?.database || connectionStore.activeDatabase;
  if (!connId || !db) return new Set();

  const sql = tab?.sql || '';
  const parsedTables = extractAllTableNamesFromSql(sql);

  if (parsedTables.length === 0 && tab?.tableName) {
    parsedTables.push({ schema: tab.schema, tableName: tab.tableName });
  }

  const pkNames = new Set<string>();
  for (const t of parsedTables) {
    const tableSchema = schemaStore.getTable(t.tableName, connId, db) ||
      (t.schema ? schemaStore.getTable(`${t.schema}.${t.tableName}`, connId, db) : undefined);
    if (tableSchema) {
      for (const col of tableSchema.columns) {
        if (col.isPrimaryKey) {
          pkNames.add(col.name.toLowerCase());
        }
      }
    }
  }

  return pkNames;
});

// Auto-fetch database schema if not yet loaded so primary keys show up promptly
watch(
  () => [queryStore.activeResultTab?.connectionId, queryStore.activeResultTab?.database] as const,
  ([cId, db]) => {
    const connId = cId || connectionStore.activeConnectionId;
    const database = db || connectionStore.activeDatabase;
    if (connId && database && !schemaStore.isDatabaseLoaded(connId, database)) {
      schemaStore.loadDatabaseSchema(connId, database).catch(() => {});
    }
  },
  { immediate: true }
);

// Selection composable
const selection = useGridSelection({
  getRows: () => currentSet.value?.rows ?? [],
  getColumns: () => currentSet.value?.columns ?? [],
  getGridApi: () => gridApi.value,
  getGridContainer: () => gridContainerRef.value,
  onCopySelected: () => gridExport.copySelectedCells(),
});

const {
  selectionStats,
  hasSelection,
  selectedColumnsCount,
  getColIndex,
  formatAggregateNumber,
  clearCellSelection,
  onGridMouseDown,
  onGridClick,
  onColumnMoved,
  onBodyScroll,
} = selection;

// Clear selection when active result set tab changes
watch(activeSetIndex, () => {
  clearCellSelection();
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
  rowData: CellValue[] | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  colId: '',
  colName: '',
  cellValue: null,
  rowIndex: -1,
  rowData: null,
});

// Export composable
const gridExport = useGridExport({
  getRows: () => currentSet.value?.rows ?? [],
  getColumns: () => currentSet.value?.columns ?? [],
  selection,
  showToast: (msg, type, duration) => workspaceStore.showToast(msg, type, duration),
  onMenuClose: () => {
    contextMenu.visible = false;
  },
});

const {
  copiedTsv,
  copiedCsv,
  copyCellValue: exportCopyCellValue,
  copyCurrentRow: exportCopyCurrentRow,
  copyCurrentRowAsJson: exportCopyCurrentRowAsJson,
  copySelectedCells,
  copySelectedAsJson,
  copyAsTsv,
  copyAsCsv,
  copyAsJson,
  copyAsMarkdown,
} = gridExport;

function copyCellValue() {
  exportCopyCellValue(contextMenu.cellValue);
}

function copyCurrentRow() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && currentSet.value ? currentSet.value.rows[contextMenu.rowIndex] : null);
  exportCopyCurrentRow(row);
}

function copyCurrentRowAsJson() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && currentSet.value ? currentSet.value.rows[contextMenu.rowIndex] : null);
  if (row && currentSet.value) {
    exportCopyCurrentRowAsJson(currentSet.value.columns, row);
  }
}

const isColPinned = computed(() => {
  if (!gridApi.value || !contextMenu.colId) return false;
  const col = gridApi.value.getColumn(contextMenu.colId);
  return col ? col.isPinned() : false;
});

function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
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
    const isPk = primaryKeyColumnNames.value.has(col.name.toLowerCase());
    const isStmtText = col.name === 'StmtText';
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const baseWidth = calculateColumnWidth(col.name, firstVal, isPk);
    const colWidth = isStmtText ? Math.max(baseWidth, 360) : baseWidth;

    return {
      colId: `col_${colIdx}`,
      field: `col_${colIdx}`,
      headerName: col.name,
      headerClass: isPk ? 'pk-column-header' : '',
      cellClass: isStmtText ? '!whitespace-pre font-mono text-dark-100' : '',
      width: colWidth,
      minWidth: isStmtText ? 200 : 70,
      suppressMovable: false, // Allows dragging column headers to reorder
      tooltipShowMode: 'whenTruncated',
      headerTooltip: isPk
        ? `🔑 [主鍵 / Primary Key] 型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'} (拖曳表頭調整順序，點擊或 Shift 點選)`
        : `型別 (Type): ${col.dataType}${col.nullable ? ' | 可為 NULL' : ' | NOT NULL'} (拖曳表頭調整順序，點擊或 Shift 點選)`,
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
        if (isStmtText) {
          return `<span class="whitespace-pre font-mono text-dark-100">${escapeHtml(String(val))}</span>`;
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
  contextMenu.rowData = (event.data as CellValue[]) || (event.node?.data as CellValue[]) || null;

  function closeMenu() {
    contextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function handleGenerateDml(type: 'INSERT' | 'UPDATE' | 'DELETE') {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && currentSet.value ? currentSet.value.rows[contextMenu.rowIndex] : null);
  if (!row || !currentSet.value) {
    contextMenu.visible = false;
    return;
  }

  const tab = queryStore.activeResultTab;
  const sql = tab?.sql || '';
  const parsedTarget = parseTargetTableFromSql(sql);

  const tableName = parsedTarget?.tableName || tab?.tableName || tab?.title || 'TargetTable';
  let schema = parsedTarget?.schema || tab?.schema;

  const connId = tab?.connectionId || connectionStore.activeConnectionId || undefined;
  const db = tab?.database || connectionStore.activeDatabase || undefined;

  // Resolve PKs & schema from schemaStore if available
  const tableSchema = connId && db
    ? (schemaStore.getTable(tableName, connId, db) || (schema ? schemaStore.getTable(`${schema}.${tableName}`, connId, db) : undefined))
    : undefined;

  if (!schema && tableSchema?.schema) {
    schema = tableSchema.schema;
  }
  if (!schema) {
    schema = 'dbo';
  }

  const primaryKeyColumns = tableSchema?.columns
    .filter((c) => c.isPrimaryKey)
    .map((c) => c.name);

  const pkColNames = new Set(
    primaryKeyColumns?.map((c) => c.toLowerCase()) ?? []
  );

  const identityColNames = new Set(
    tableSchema?.columns
      .filter((c) => c.isIdentity)
      .map((c) => c.name.toLowerCase()) ?? []
  );

  const columns: ColumnInfo[] = currentSet.value.columns.map((col) => ({
    name: col.name,
    dataType: col.dataType,
    isPrimaryKey: pkColNames.has(col.name.toLowerCase()),
    isIdentity: identityColNames.has(col.name.toLowerCase()),
  }));

  const dmlParams: GenerateDmlParams = {
    tableName,
    schema,
    database: db,
    columns,
    row,
    primaryKeyColumns,
  };

  let generated = '';
  try {
    if (type === 'INSERT') {
      generated = generateInsertStatement(dmlParams);
    } else if (type === 'UPDATE') {
      generated = generateUpdateStatement(dmlParams);
    } else if (type === 'DELETE') {
      generated = generateDeleteStatement(dmlParams);
    }

    try {
      navigator.clipboard?.writeText(generated);
    } catch (err) {
      // Ignore clipboard error
    }

    workspaceStore.addSqlTab(generated, `${type}: [${schema}].[${tableName}]`, connId, db);
    workspaceStore.showToast(`已建立 ${type} 語法並開啟新分頁（已複製至剪貼簿）`, 'success', 2500);
  } catch (err: any) {
    workspaceStore.showToast(`產生 ${type} 語法失敗: ${err?.message || err}`, 'error', 3500);
  }

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

/* Primary Key Column Header Styling with Lucide Key vector icon */
:deep(.pk-column-header .ag-header-cell-text) {
  color: #fbbf24 !important; /* amber-400 */
  font-weight: 600 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
}

:deep(.pk-column-header .ag-header-cell-text::before) {
  content: '' !important;
  display: inline-block !important;
  width: 12px !important;
  height: 12px !important;
  flex-shrink: 0 !important;
  background-color: #fbbf24 !important; /* amber-400 */
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='7.5' cy='15.5' r='5.5'/%3E%3Cpath d='m21 2-9.6 9.6'/%3E%3Cpath d='m15.5 7.5 3 3L22 7l-3-3'/%3E%3C/svg%3E") no-repeat center / contain !important;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='7.5' cy='15.5' r='5.5'/%3E%3Cpath d='m21 2-9.6 9.6'/%3E%3Cpath d='m15.5 7.5 3 3L22 7l-3-3'/%3E%3C/svg%3E") no-repeat center / contain !important;
}

:deep(.sqlight-header-selected.pk-column-header .ag-header-cell-text) {
  color: #fef08a !important; /* amber-200 */
}

:deep(.sqlight-header-selected.pk-column-header .ag-header-cell-text::before) {
  background-color: #fef08a !important;
}
</style>
