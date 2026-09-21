<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader toolbar for Table Data -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0 space-x-2">
      <div class="flex items-center space-x-2 min-w-0">
        <i class="pi pi-table text-emerald-400 text-xs flex-shrink-0"></i>
        <span class="font-semibold text-dark-100 truncate">{{ schema }}.{{ tableName }}</span>
        <span class="text-dark-600">|</span>
        <span class="text-dark-400 text-xxs flex-shrink-0">
          <strong class="text-emerald-400">{{ rows.length.toLocaleString() }}</strong> rows
        </span>

        <!-- Quick Filter Input -->
        <IconField class="w-40 sm:w-56 ml-2">
          <InputIcon class="pi pi-search text-dark-500 text-xs" />
          <InputText
            v-model="quickFilter"
            type="text"
            placeholder="Filter table data..."
            size="small"
            class="w-full !bg-dark-900 !border-dark-700 !py-0.5 !pl-7 !pr-6 !text-xs font-mono"
          />
        </IconField>
      </div>

      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <!-- Copy TSV -->
        <Button
          type="button"
          :icon="copiedTsv ? 'pi pi-check text-emerald-400' : 'pi pi-file-excel text-emerald-400'"
          :label="copiedTsv ? 'Copied!' : 'Copy TSV'"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsTsv"
          v-tooltip.top="'複製全部為 TSV (相容 Excel)'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy JSON -->
        <Button
          type="button"
          icon="pi pi-code text-cyan-400"
          label="JSON"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsJson"
          v-tooltip.top="'複製全表為 JSON 物件陣列'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Copy Markdown -->
        <Button
          type="button"
          icon="pi pi-table text-pink-400"
          label="MD"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsMarkdown"
          v-tooltip.top="'複製全表為 Markdown 表格 (貼入 GitHub / Notion)'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Reload Data -->
        <Button
          type="button"
          :icon="isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
          label="Refresh"
          size="small"
          severity="secondary"
          outlined
          @click="loadData"
          v-tooltip.top="'Reload table data'"
          class="!text-xxs !py-0.5 !px-2 ml-1"
        />
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
      @click="onGridClick"
    >
      <AgGridVue
        class="w-full h-full"
        :theme="activeGridTheme"
        :row-data="rows"
        :column-defs="columnDefs"
        :quick-filter-text="quickFilter"
        :enable-cell-text-selection="false"
        :ensure-dom-order="false"
        :column-buffer="4"
        :animate-rows="false"
        :suppress-move-when-column-dragging="true"
        :suppress-row-hover-highlight="true"
        :prevent-default-on-context-menu="true"
        :tooltip-show-mode="'whenTruncated'"
        :tooltip-show-delay="150"
        :tooltip-hide-delay="6000"
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
            <span v-if="selectedColumnsCount > 1" class="text-amber-800 dark:text-amber-300 font-mono">
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
              最小值 (Min): <strong class="font-mono text-amber-700 dark:text-amber-400">{{ formatAggregateNumber(selectionStats.min) }}</strong>
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

          <Button
            type="button"
            label="清除"
            text
            size="small"
            severity="secondary"
            @click="clearCellSelection"
            v-tooltip.top="'清除選取 (Esc)'"
            class="!ml-1 !p-0 !text-[10px] !underline"
          />
        </template>

        <template v-else>
          <div class="flex items-center space-x-2 text-dark-400">
            <span>共 <strong class="font-mono text-dark-200">{{ rows.length.toLocaleString() }}</strong> 列</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-dark-200">{{ columns.length }}</strong> 個欄位</span>
            <span class="text-dark-600">|</span>
            <span class="text-dark-500 italic text-[10px]">提示：支援標題列拖曳多欄選取、Shift 連續多欄、Ctrl 多選、儲存格框選與 Ctrl+A 全選</span>
          </div>
        </template>
      </div>

      <!-- Right: Copy Selection Button -->
      <div v-if="selectionStats" class="flex items-center space-x-1 flex-shrink-0 ml-2">
        <Button
          type="button"
          icon="pi pi-copy"
          label="複製選取"
          size="small"
          severity="primary"
          outlined
          @click="copySelectedCells"
          v-tooltip.top="'複製選取內容 (Ctrl+C)'"
          class="!py-0.5 !px-1.5 !text-[10px]"
        />
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
        <Edit3 class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
        <PinOff v-if="isColPinned" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <Pin v-else class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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
import { ref, computed, reactive, onMounted, watch, markRaw } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import {
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
} from 'ag-grid-community';
import { sqlightDarkGridTheme, sqlightLightGridTheme } from '@/styles/gridTheme';
import { queryService } from '@/services/queryService';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  calculateColumnWidth,
} from '@/composables/useColumnAutoWidth';
import { useGridSelection } from '@/composables/useGridSelection';
import { useGridExport } from '@/composables/useGridExport';
import {
  generateInsertStatement,
  generateUpdateStatement,
  generateDeleteStatement,
  type ColumnInfo,
  type GenerateDmlParams,
} from '@/utils/sqlGenerator';
import type { ColumnDef, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  schema: string;
  tableName: string;
}>();

const settingsStore = useSettingsStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const schemaStore = useSchemaStore();

const activeGridTheme = computed(() => {
  return settingsStore.colorMode === 'light' ? sqlightLightGridTheme : sqlightDarkGridTheme;
});

const isLoading = ref(false);
const error = ref<string | null>(null);
const columns = ref<ColumnDef[]>([]);
const rows = ref<CellValue[][]>([]);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);

// Set of lowercased primary key column names for this table
const primaryKeyColumnNames = computed<Set<string>>(() => {
  const connId = connectionStore.activeConnectionId;
  const db = connectionStore.activeDatabase;
  if (!connId || !db) return new Set();

  const tableSchema = schemaStore.getTable(props.tableName, connId, db) ||
    schemaStore.getTable(`${props.schema}.${props.tableName}`, connId, db);
  if (!tableSchema) return new Set();

  return new Set(
    tableSchema.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.name.toLowerCase())
  );
});

// Auto-fetch database schema if not yet loaded so primary keys show up promptly
watch(
  () => [connectionStore.activeConnectionId, connectionStore.activeDatabase] as const,
  ([connId, db]) => {
    if (connId && db && !schemaStore.isDatabaseLoaded(connId, db)) {
      schemaStore.loadDatabaseSchema(connId, db).catch(() => {});
    }
  },
  { immediate: true }
);

// Selection composable
const selection = useGridSelection({
  getRows: () => rows.value,
  getColumns: () => columns.value,
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
  getRows: () => rows.value,
  getColumns: () => columns.value,
  selection,
  showToast: (msg, type, duration) => workspaceStore.showToast(msg, type, duration),
  onMenuClose: () => {
    contextMenu.visible = false;
  },
});

const {
  copiedTsv,
  copyCellValue: exportCopyCellValue,
  copyCurrentRow: exportCopyCurrentRow,
  copyCurrentRowAsJson: exportCopyCurrentRowAsJson,
  copySelectedCells,
  copySelectedAsJson,
  copyAsTsv,
  copyAsJson,
  copyAsMarkdown,
} = gridExport;

function copyCellValue() {
  exportCopyCellValue(contextMenu.cellValue);
}

function copyCurrentRow() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && rows.value ? rows.value[contextMenu.rowIndex] : null);
  exportCopyCurrentRow(row);
}

function copyCurrentRowAsJson() {
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && rows.value ? rows.value[contextMenu.rowIndex] : null);
  if (row) {
    exportCopyCurrentRowAsJson(columns.value, row);
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

// Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  if (!columns.value.length) return [];

  const rowCount = rows.value.length;
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

  const firstRow = rows.value[0];

  const dataCols: ColDef[] = columns.value.map((col, colIdx) => {
    const isPk = primaryKeyColumnNames.value.has(col.name.toLowerCase());
    const firstVal = firstRow ? firstRow[colIdx] : undefined;
    const colWidth = calculateColumnWidth(col.name, firstVal, isPk);

    return {
      colId: `col_${colIdx}`,
      field: `col_${colIdx}`,
      headerName: col.name,
      headerClass: isPk ? 'pk-column-header' : '',
      width: colWidth,
      minWidth: 70,
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
      cellClassRules: {
        'sqlight-cell-null': (params) => params.value === null || params.value === undefined,
        'sqlight-cell-bool-true': (params) => params.value === true,
        'sqlight-cell-bool-false': (params) => params.value === false,
        'sqlight-cell-binary': (params) => typeof params.value === 'object' && params.value !== null && 'type' in params.value && (params.value as any).type === 'binary',
      },
      valueFormatter: (params) => {
        const val = params.value;
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'object' && val !== null && 'type' in val && (val as any).type === 'binary') {
          return `[Binary ${(val as any).length} B]`;
        }
        return val != null ? String(val) : '';
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
  const realColName = colIdx !== undefined ? columns.value[colIdx]?.name : cId;

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
  const row = contextMenu.rowData || (contextMenu.rowIndex >= 0 && rows.value ? rows.value[contextMenu.rowIndex] : null);
  if (!row) {
    contextMenu.visible = false;
    return;
  }

  const connId = connectionStore.activeConnectionId || undefined;
  const db = connectionStore.activeDatabase || undefined;
  const tableSchema = connId && db
    ? (schemaStore.getTable(props.tableName, connId, db) || schemaStore.getTable(`${props.schema}.${props.tableName}`, connId, db))
    : undefined;

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

  const cols: ColumnInfo[] = columns.value.map((col) => ({
    name: col.name,
    dataType: col.dataType,
    isPrimaryKey: pkColNames.has(col.name.toLowerCase()),
    isIdentity: identityColNames.has(col.name.toLowerCase()),
  }));

  const dmlParams: GenerateDmlParams = {
    tableName: props.tableName,
    schema: props.schema,
    database: db,
    columns: cols,
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

    workspaceStore.addSqlTab(generated, `${type}: [${props.schema}].[${props.tableName}]`, connId, db);
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
    const db = props.schema ? connectionStore.activeDatabase || 'master' : 'master';
    const sql = `SELECT TOP ${limit} * FROM [${props.schema}].[${props.tableName}];`;
    const res = await queryService.executeQuery(connId, db, sql, limit);
    if (res.resultSets.length > 0 && res.resultSets[0]) {
      columns.value = res.resultSets[0].columns;
      rows.value = markRaw(res.resultSets[0].rows);
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

onMounted(() => {
  loadData();
});
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

/* Zero-overhead CSS styling for NULL, Booleans, and Binary cells (Native text performance) */
:deep(.sqlight-cell-null) {
  color: rgb(var(--color-dark-500)) !important;
  font-style: italic !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-bool-true) {
  color: #34d399 !important;
  font-weight: 600 !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-bool-false) {
  color: #fb7185 !important;
  font-weight: 600 !important;
  font-size: 0.6875rem !important;
}

:deep(.sqlight-cell-binary) {
  color: #93c5fd !important;
  font-weight: 500 !important;
  font-size: 0.6875rem !important;
}
</style>
