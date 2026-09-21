<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs select-none">
    <!-- Subheader toolbar for Table Structure -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0 space-x-2">
      <div class="flex items-center space-x-2 min-w-0">
        <i class="pi pi-list text-indigo-400 text-xs flex-shrink-0"></i>
        <span class="font-semibold text-dark-100 truncate">{{ schema }}.{{ tableName }}</span>
        <span class="text-dark-600">|</span>
        <Tag :value="`${columns.length} 欄位`" severity="info" class="!font-mono !text-xxs !px-1.5 !py-0.2" />
        <Tag v-if="pkCount > 0" :value="`${pkCount} 主鍵`" severity="warn" class="!font-mono !text-xxs !px-1.5 !py-0.2" />
        <Tag v-if="identityCount > 0" :value="`${identityCount} Identity`" severity="secondary" class="!font-mono !text-xxs !px-1.5 !py-0.2" />

        <!-- Quick Filter Input -->
        <IconField class="w-40 sm:w-56 ml-2">
          <InputIcon class="pi pi-search text-dark-500 text-xs" />
          <InputText
            v-model="quickFilter"
            type="text"
            placeholder="搜尋欄位名稱、型別..."
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
          :label="copiedTsv ? '已複製' : 'Copy TSV'"
          size="small"
          severity="secondary"
          outlined
          @click="copyAsTsv"
          v-tooltip.top="'複製全表結構為 TSV (相容 Excel)'"
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
          v-tooltip.top="'複製全表結構為 JSON 物件陣列'"
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
          v-tooltip.top="'複製全表結構為 Markdown 表格'"
          class="!text-xxs !py-0.5 !px-2"
        />

        <!-- Reload Data -->
        <Button
          type="button"
          :icon="isLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'"
          label="重新整理"
          size="small"
          severity="secondary"
          outlined
          @click="loadStructure"
          v-tooltip.top="'重新載入資料表結構'"
          class="!text-xxs !py-0.5 !px-2 ml-1"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center text-dark-400 space-x-2">
      <RotateCw class="w-4 h-4 animate-spin text-indigo-400" />
      <span>載入資料表結構中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 p-4 text-rose-400">
      <div class="font-semibold mb-1">載入結構失敗:</div>
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
        :style="{ '--ag-font-family': settingsStore.gridFontFamily }"
        :theme="activeGridTheme"
        :row-data="columns"
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
            <span>共 <strong class="font-mono text-indigo-300">{{ columns.length }}</strong> 個欄位</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-amber-800 dark:text-amber-300">{{ pkCount }}</strong> 個主鍵欄位</span>
            <span class="text-dark-600">|</span>
            <span><strong class="font-mono text-sky-300">{{ identityCount }}</strong> 個自動識別欄位</span>
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
      class="fixed z-50 bg-dark-800 border border-dark-700 rounded-md shadow-2xl py-1 w-64 text-xs font-sans text-dark-200 select-none"
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
        <span>複製整列欄位資訊 (Copy Row)</span>
      </button>

      <button
        @click="copyCurrentRowAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-teal-400" />
        <span>複製整列為 JSON (Row JSON)</span>
      </button>

      <div class="my-1 border-t border-dark-750"></div>

      <!-- ALTER TABLE Section Header -->
      <div class="px-2.5 py-1 text-xxs text-indigo-400 font-semibold uppercase tracking-wider flex items-center justify-between">
        <span>產生 ALTER TABLE 語法</span>
        <span v-if="targetColumnName" class="text-dark-500 font-mono text-[10px] truncate max-w-[110px]">
          {{ targetColumnName }}
        </span>
      </div>

      <!-- 1. ALTER COLUMN -->
      <div class="flex items-center hover:bg-dark-750 group transition-colors">
        <button
          type="button"
          @click="handleAlterColumnScript('alter')"
          class="flex-1 text-left px-2.5 py-1.5 hover:text-dark-100 flex items-center space-x-2 transition-colors min-w-0"
          title="在新查詢分頁開啟 ALTER COLUMN 語法"
        >
          <Pencil class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span class="truncate">修改欄位 (ALTER COLUMN...)</span>
        </button>
        <button
          type="button"
          @click.stop="handleCopyAlterColumnScript('alter')"
          class="p-1.5 text-dark-400 hover:text-brand-300 rounded hover:bg-dark-700 mr-1.5 transition-colors flex-shrink-0"
          title="複製 ALTER COLUMN 語法至剪貼簿"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>

      <!-- 2. ADD COLUMN -->
      <div class="flex items-center hover:bg-dark-750 group transition-colors">
        <button
          type="button"
          @click="handleAlterColumnScript('add')"
          class="flex-1 text-left px-2.5 py-1.5 hover:text-dark-100 flex items-center space-x-2 transition-colors min-w-0"
          title="在新查詢分頁開啟 ADD COLUMN 語法"
        >
          <Plus class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span class="truncate">新增欄位 (ADD COLUMN...)</span>
        </button>
        <button
          type="button"
          @click.stop="handleCopyAlterColumnScript('add')"
          class="p-1.5 text-dark-400 hover:text-brand-300 rounded hover:bg-dark-700 mr-1.5 transition-colors flex-shrink-0"
          title="複製 ADD COLUMN 語法至剪貼簿"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>

      <!-- 3. DROP COLUMN -->
      <div class="flex items-center hover:bg-dark-750 group transition-colors">
        <button
          type="button"
          @click="handleAlterColumnScript('drop')"
          class="flex-1 text-left px-2.5 py-1.5 hover:text-rose-300 text-rose-400/90 flex items-center space-x-2 transition-colors min-w-0"
          title="在新查詢分頁開啟 DROP COLUMN 語法"
        >
          <Trash2 class="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span class="truncate">刪除欄位 (DROP COLUMN...)</span>
        </button>
        <button
          type="button"
          @click.stop="handleCopyAlterColumnScript('drop')"
          class="p-1.5 text-dark-400 hover:text-rose-300 rounded hover:bg-dark-700 mr-1.5 transition-colors flex-shrink-0"
          title="複製 DROP COLUMN 語法至剪貼簿"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>

      <!-- 4. ALL ALTER TEMPLATES -->
      <div class="flex items-center hover:bg-dark-750 group transition-colors border-t border-dark-750/50">
        <button
          type="button"
          @click="handleAlterColumnScript('all')"
          class="flex-1 text-left px-2.5 py-1.5 hover:text-dark-100 flex items-center space-x-2 transition-colors min-w-0 text-indigo-300"
          title="在新查詢分頁產生完整 ALTER TABLE 語法樣板"
        >
          <FileCode class="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span class="truncate">完整 ALTER 樣板 (All-in-One)</span>
        </button>
        <button
          type="button"
          @click.stop="handleCopyAlterColumnScript('all')"
          class="p-1.5 text-dark-400 hover:text-indigo-300 rounded hover:bg-dark-700 mr-1.5 transition-colors flex-shrink-0"
          title="複製完整樣板至剪貼簿"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>

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

      <div class="my-1 border-t border-dark-750"></div>

      <button
        @click="copyAsTsv"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <FileSpreadsheet class="w-3.5 h-3.5 text-indigo-400" />
        <span>複製全表結構為 TSV (Excel)</span>
      </button>

      <button
        @click="copyAsJson"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Braces class="w-3.5 h-3.5 text-cyan-400" />
        <span>複製全表結構為 JSON</span>
      </button>

      <button
        @click="copyAsMarkdown"
        class="w-full text-left px-2.5 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 transition-colors"
      >
        <Table class="w-3.5 h-3.5 text-pink-400" />
        <span>複製全表結構為 Markdown 表格</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Tag from 'primevue/tag';
import {
  FileSpreadsheet,
  FileText,
  Copy,
  Braces,
  Table,
  Plus,
  Trash2,
  Pencil,
  FileCode,
} from 'lucide-vue-next';
import {
  generateAlterColumnSql,
  generateDropColumnSql,
  generateAddColumnSql,
  generateAllAlterTableTemplateSql,
  type AlterTableColumnOptions,
} from '@/utils/alterTableGenerator';
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
import { sqlightDarkGridTheme, sqlightLightGridTheme } from '@/styles/gridTheme';
import { queryService } from '@/services/queryService';
import { useConnectionStore } from '@/stores/connectionStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { escapeHtml } from '@/composables/useColumnAutoWidth';
import { useGridSelection } from '@/composables/useGridSelection';
import { useGridExport } from '@/composables/useGridExport';
import type { ColumnDef, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  schema: string;
  tableName: string;
}>();

const settingsStore = useSettingsStore();
const connectionStore = useConnectionStore();
const workspaceStore = useWorkspaceStore();

const activeGridTheme = computed(() => {
  return settingsStore.colorMode === 'light' ? sqlightLightGridTheme : sqlightDarkGridTheme;
});

export interface ColumnStructureRow {
  ordinal: number;
  columnName: string;
  dataType: string;
  fullType: string;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  isNullable: string;
  isPrimaryKey: number;
  isIdentity: number;
  defaultValue: string | null;
  collation: string | null;
  [key: string]: unknown;
}

const isLoading = ref(false);
const error = ref<string | null>(null);
const columns = ref<ColumnStructureRow[]>([]);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const gridContainerRef = ref<HTMLDivElement | null>(null);

const pkCount = computed(() => columns.value.filter((c) => c.isPrimaryKey === 1).length);
const identityCount = computed(() => columns.value.filter((c) => c.isIdentity === 1).length);

// Cell Context Menu State
const contextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  colName: string;
  cellValue: unknown;
  rowIndex: number;
  selectedRow: ColumnStructureRow | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  colName: '',
  cellValue: null,
  rowIndex: -1,
  selectedRow: null,
});

const targetColumnName = computed(() => {
  return contextMenu.selectedRow?.columnName || contextMenu.colName || '';
});

// Adapter columns for export & selection
const exportColumns = computed<ColumnDef[]>(() => [
  { name: 'ordinal', dataType: 'int', nullable: false, ordinal: 1 },
  { name: 'isPrimaryKey', dataType: 'bit', nullable: false, ordinal: 2 },
  { name: 'columnName', dataType: 'nvarchar', nullable: false, ordinal: 3 },
  { name: 'dataType', dataType: 'nvarchar', nullable: false, ordinal: 4 },
  { name: 'fullType', dataType: 'nvarchar', nullable: false, ordinal: 5 },
  { name: 'isNullable', dataType: 'varchar', nullable: false, ordinal: 6 },
  { name: 'isIdentity', dataType: 'bit', nullable: false, ordinal: 7 },
  { name: 'defaultValue', dataType: 'nvarchar', nullable: true, ordinal: 8 },
  { name: 'maxLength', dataType: 'int', nullable: true, ordinal: 9 },
  { name: 'numericPrecision', dataType: 'int', nullable: true, ordinal: 10 },
  { name: 'numericScale', dataType: 'int', nullable: true, ordinal: 11 },
  { name: 'collation', dataType: 'nvarchar', nullable: true, ordinal: 12 },
]);

// Adapter rows for export & selection (array of arrays)
const exportRows = computed<CellValue[][]>(() => {
  return columns.value.map((col) => [
    col.ordinal,
    col.isPrimaryKey ? 'PK' : '',
    col.columnName,
    col.dataType,
    col.fullType,
    col.isNullable,
    col.isIdentity ? 'YES' : 'NO',
    col.defaultValue,
    col.maxLength,
    col.numericPrecision,
    col.numericScale,
    col.collation,
  ]);
});

// Selection composable
const selection = useGridSelection({
  getRows: () => exportRows.value,
  getColumns: () => exportColumns.value,
  getGridApi: () => gridApi.value,
  getGridContainer: () => gridContainerRef.value,
  onCopySelected: () => gridExport.copySelectedCells(),
});

const {
  selectionStats,
  hasSelection,
  selectedColumnsCount,
  formatAggregateNumber,
  clearCellSelection,
  onGridMouseDown,
  onGridClick,
  onColumnMoved,
  onBodyScroll,
} = selection;

// Export composable
const gridExport = useGridExport({
  getRows: () => exportRows.value,
  getColumns: () => exportColumns.value,
  selection,
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number) =>
    workspaceStore.showToast(msg, type, duration),
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

// AG Grid Column Definitions
const columnDefs = computed<ColDef[]>(() => {
  return [
    {
      field: 'ordinal',
      headerName: '#',
      width: 55,
      pinned: 'left',
      sortable: true,
      filter: 'agNumberColumnFilter',
      cellClass: 'text-center font-mono text-dark-400 text-xxs',
    },
    {
      field: 'isPrimaryKey',
      headerName: 'PK',
      width: 60,
      pinned: 'left',
      sortable: true,
      cellClass: 'text-center flex items-center justify-center',
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value === 1) {
          return `<span class="px-1 py-0.2 rounded font-bold font-mono text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">PK</span>`;
        }
        return '';
      },
    },
    {
      field: 'columnName',
      headerName: '欄位名稱 (Column Name)',
      width: 180,
      pinned: 'left',
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        const isPk = params.data?.isPrimaryKey === 1;
        const colorClass = isPk ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-dark-100 font-medium';
        return `<span class="font-mono text-xs ${colorClass}">${escapeHtml(String(params.value ?? ''))}</span>`;
      },
    },
    {
      field: 'dataType',
      headerName: '基礎型別 (Data Type)',
      width: 125,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellClass: 'font-mono text-sky-300 text-xs',
    },
    {
      field: 'fullType',
      headerName: '完整型別與長度 (Full Type)',
      width: 160,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellClass: 'font-mono text-emerald-300 font-semibold text-xs',
    },
    {
      field: 'isNullable',
      headerName: '可為 NULL',
      width: 95,
      sortable: true,
      cellClass: 'text-center flex items-center justify-center',
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value === 'YES') {
          return `<span class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">YES</span>`;
        }
        return `<span class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-rose-950/60 text-rose-400 border border-rose-800/50">NO</span>`;
      },
    },
    {
      field: 'isIdentity',
      headerName: '自動識別 (Identity)',
      width: 120,
      sortable: true,
      cellClass: 'text-center flex items-center justify-center',
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value === 1) {
          return `<span class="px-1.5 py-0.2 rounded font-mono text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">YES</span>`;
        }
        return `<span class="text-dark-600 font-mono text-xxs">-</span>`;
      },
    },
    {
      field: 'defaultValue',
      headerName: '預設值 (Default)',
      width: 160,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value != null && String(params.value).trim()) {
          return `<span class="font-mono text-dark-200 text-xxs">${escapeHtml(String(params.value))}</span>`;
        }
        return `<span class="text-dark-600 font-mono text-xxs italic">NULL</span>`;
      },
    },
    {
      field: 'maxLength',
      headerName: '最大長度 (Bytes)',
      width: 115,
      sortable: true,
      cellClass: 'font-mono text-dark-400 text-right text-xs',
      valueFormatter: (params) => {
        if (params.value === -1) return 'MAX (-1)';
        return params.value != null ? String(params.value) : '-';
      },
    },
    {
      field: 'numericPrecision',
      headerName: '精確度 (Precision)',
      width: 110,
      sortable: true,
      cellClass: 'font-mono text-dark-400 text-right text-xs',
      valueFormatter: (params) => (params.value != null ? String(params.value) : '-'),
    },
    {
      field: 'numericScale',
      headerName: '小數位數 (Scale)',
      width: 100,
      sortable: true,
      cellClass: 'font-mono text-dark-400 text-right text-xs',
      valueFormatter: (params) => (params.value != null ? String(params.value) : '-'),
    },
    {
      field: 'collation',
      headerName: '定序 (Collation)',
      width: 180,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value != null && String(params.value).trim()) {
          return `<span class="font-mono text-dark-400 text-xxs truncate">${escapeHtml(String(params.value))}</span>`;
        }
        return `<span class="text-dark-600 font-mono text-xxs">-</span>`;
      },
    },
  ];
});

function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
}

async function loadStructure() {
  const connId = connectionStore.activeConnectionId;
  const db = connectionStore.activeDatabase;
  if (!connId || !db) {
    error.value = '未連線或未選擇資料庫';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const escapedSchema = props.schema.replace(/'/g, "''");
    const escapedTable = props.tableName.replace(/'/g, "''");

    const sql = `
SELECT 
    c.ORDINAL_POSITION AS Ordinal,
    c.COLUMN_NAME AS ColumnName,
    c.DATA_TYPE AS DataType,
    CASE 
        WHEN c.DATA_TYPE IN ('nchar', 'nvarchar') THEN 
            c.DATA_TYPE + '(' + CASE WHEN c.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX' ELSE CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10)) END + ')'
        WHEN c.DATA_TYPE IN ('char', 'varchar', 'binary', 'varbinary') THEN 
            c.DATA_TYPE + '(' + CASE WHEN c.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX' ELSE CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10)) END + ')'
        WHEN c.DATA_TYPE IN ('decimal', 'numeric') THEN 
            c.DATA_TYPE + '(' + CAST(c.NUMERIC_PRECISION AS VARCHAR(10)) + ', ' + CAST(c.NUMERIC_SCALE AS VARCHAR(10)) + ')'
        WHEN c.DATA_TYPE IN ('datetime2', 'time', 'datetimeoffset') THEN 
            c.DATA_TYPE + '(' + CAST(c.DATETIME_PRECISION AS VARCHAR(10)) + ')'
        ELSE c.DATA_TYPE
    END AS FullType,
    c.CHARACTER_MAXIMUM_LENGTH AS MaxLength,
    c.NUMERIC_PRECISION AS NumericPrecision,
    c.NUMERIC_SCALE AS NumericScale,
    CASE WHEN c.IS_NULLABLE = 'YES' THEN 'YES' ELSE 'NO' END AS IsNullable,
    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey,
    ISNULL(COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity'), 0) AS IsIdentity,
    c.COLUMN_DEFAULT AS DefaultValue,
    c.COLLATION_NAME AS Collation
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (
    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
    AND c.TABLE_NAME = pk.TABLE_NAME 
    AND c.COLUMN_NAME = pk.COLUMN_NAME
WHERE c.TABLE_SCHEMA = '${escapedSchema}' AND c.TABLE_NAME = '${escapedTable}'
ORDER BY c.ORDINAL_POSITION;
    `.trim();

    const res = await queryService.executeQuery(connId, db, sql, null);
    if (res.messages.some((m) => m.level === 'error')) {
      throw new Error(res.messages.find((m) => m.level === 'error')?.message || '查詢失敗');
    }

    const firstSet = res.resultSets[0];
    if (!firstSet) {
      columns.value = [];
      return;
    }

    const colIndexMap = new Map<string, number>();
    firstSet.columns.forEach((col, idx) => {
      colIndexMap.set(col.name.toLowerCase(), idx);
    });

    columns.value = firstSet.rows.map((row) => ({
      ordinal: Number(row[colIndexMap.get('ordinal') ?? 0] ?? 0),
      columnName: String(row[colIndexMap.get('columnname') ?? 1] ?? ''),
      dataType: String(row[colIndexMap.get('datatype') ?? 2] ?? ''),
      fullType: String(row[colIndexMap.get('fulltype') ?? 3] ?? ''),
      maxLength: row[colIndexMap.get('maxlength') ?? 4] != null ? Number(row[colIndexMap.get('maxlength') ?? 4]) : null,
      numericPrecision: row[colIndexMap.get('numericprecision') ?? 5] != null ? Number(row[colIndexMap.get('numericprecision') ?? 5]) : null,
      numericScale: row[colIndexMap.get('numericscale') ?? 6] != null ? Number(row[colIndexMap.get('numericscale') ?? 6]) : null,
      isNullable: String(row[colIndexMap.get('isnullable') ?? 7] ?? 'NO'),
      isPrimaryKey: Number(row[colIndexMap.get('isprimarykey') ?? 8] ?? 0),
      isIdentity: Number(row[colIndexMap.get('isidentity') ?? 9] ?? 0),
      defaultValue: row[colIndexMap.get('defaultvalue') ?? 10] != null ? String(row[colIndexMap.get('defaultvalue') ?? 10]) : null,
      collation: row[colIndexMap.get('collation') ?? 11] != null ? String(row[colIndexMap.get('collation') ?? 11]) : null,
    }));
  } catch (err: unknown) {
    console.error('Failed to load table structure:', err);
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
}

function onCellContextMenu(event: CellContextMenuEvent) {
  const mouseEvent = event.event as MouseEvent;
  if (!mouseEvent) return;

  const colId = event.column.getColId();
  contextMenu.x = Math.min(mouseEvent.clientX, window.innerWidth - 275);
  contextMenu.y = Math.min(mouseEvent.clientY, window.innerHeight - 440);
  contextMenu.colName = colId;
  contextMenu.cellValue = event.value;
  contextMenu.rowIndex = event.rowIndex ?? -1;
  contextMenu.selectedRow =
    (event.data as ColumnStructureRow) ||
    (event.rowIndex != null && columns.value[event.rowIndex]) ||
    null;
  contextMenu.visible = true;

  function closeMenu() {
    contextMenu.visible = false;
    document.removeEventListener('click', closeMenu);
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

function getAlterTableOptions(): AlterTableColumnOptions {
  const row = contextMenu.selectedRow;
  const colName = row?.columnName || contextMenu.colName || 'ColumnName';
  return {
    schema: props.schema,
    tableName: props.tableName,
    columnName: colName,
    dataType: row?.dataType,
    fullType: row?.fullType,
    isNullable: row?.isNullable,
    defaultValue: row?.defaultValue,
    database: connectionStore.activeDatabase,
  };
}

function handleAlterColumnScript(action: 'alter' | 'drop' | 'add' | 'all') {
  const opts = getAlterTableOptions();
  let sql = '';
  let title = '';
  let toastMsg = '';

  switch (action) {
    case 'alter':
      sql = generateAlterColumnSql(opts);
      title = `ALTER_${props.tableName}_${opts.columnName}.sql`;
      toastMsg = `已產生修改欄位 [${opts.columnName}] 語法`;
      break;
    case 'drop':
      sql = generateDropColumnSql(opts);
      title = `DROP_${props.tableName}_${opts.columnName}.sql`;
      toastMsg = `已產生刪除欄位 [${opts.columnName}] 語法`;
      break;
    case 'add':
      sql = generateAddColumnSql(opts);
      title = `ADD_${props.tableName}.sql`;
      toastMsg = `已產生新增欄位語法`;
      break;
    case 'all':
      sql = generateAllAlterTableTemplateSql(opts);
      title = `ALTER_${props.tableName}_Template.sql`;
      toastMsg = `已產生 ALTER TABLE 綜合樣板`;
      break;
  }

  workspaceStore.addSqlTab(
    sql,
    title,
    connectionStore.activeConnectionId || undefined,
    connectionStore.activeDatabase || undefined
  );
  workspaceStore.showToast(toastMsg, 'success', 2500);
  contextMenu.visible = false;
}

function handleCopyAlterColumnScript(action: 'alter' | 'drop' | 'add' | 'all') {
  const opts = getAlterTableOptions();
  let sql = '';
  let actionName = '';

  switch (action) {
    case 'alter':
      sql = generateAlterColumnSql(opts);
      actionName = `ALTER COLUMN [${opts.columnName}]`;
      break;
    case 'drop':
      sql = generateDropColumnSql(opts);
      actionName = `DROP COLUMN [${opts.columnName}]`;
      break;
    case 'add':
      sql = generateAddColumnSql(opts);
      actionName = 'ADD COLUMN';
      break;
    case 'all':
      sql = generateAllAlterTableTemplateSql(opts);
      actionName = 'ALTER TABLE 樣板';
      break;
  }

  try {
    navigator.clipboard?.writeText(sql);
    workspaceStore.showToast(`已複製 ${actionName} 語法至剪貼簿`, 'success', 2500);
  } catch (err) {
    console.warn('Failed to copy to clipboard:', err);
  }
  contextMenu.visible = false;
}

function copyCellValue() {
  exportCopyCellValue(contextMenu.cellValue);
}

function copyCurrentRow() {
  const row = contextMenu.rowIndex >= 0 && exportRows.value ? exportRows.value[contextMenu.rowIndex] : null;
  if (row) {
    exportCopyCurrentRow(row);
  }
}

function copyCurrentRowAsJson() {
  const row = contextMenu.rowIndex >= 0 && exportRows.value ? exportRows.value[contextMenu.rowIndex] : null;
  if (row) {
    exportCopyCurrentRowAsJson(exportColumns.value, row);
  }
}

onMounted(() => {
  loadStructure();
});

watch(
  () => [props.schema, props.tableName, connectionStore.activeConnectionId, connectionStore.activeDatabase],
  () => {
    loadStructure();
  }
);
</script>
