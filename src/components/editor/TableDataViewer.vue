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
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 rounded border border-dark-700 text-xxs transition-colors"
          title="複製全部為 TSV (相容 Excel)"
        >
          <Check v-if="copiedTsv" class="w-2.5 h-2.5 text-emerald-400" />
          <FileSpreadsheet v-else class="w-2.5 h-2.5 text-emerald-400" />
          <span>{{ copiedTsv ? 'Copied!' : 'Copy TSV' }}</span>
        </button>

        <!-- Reload Data -->
        <button
          @click="loadData"
          class="flex items-center space-x-1 px-2 py-0.5 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 text-xxs transition-colors"
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
    <div v-else class="flex-1 w-full overflow-hidden relative" @contextmenu.prevent>
      <AgGridVue
        class="w-full h-full"
        :theme="sqlightGridTheme"
        :row-data="rows"
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

    <!-- Custom Cell Context Menu -->
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
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
import type { ColumnDef, CellValue } from '@/types/query';

// Register AG Grid Community Modules
ModuleRegistry.registerModules([AllCommunityModule]);

const props = defineProps<{
  schema: string;
  tableName: string;
}>();

const connectionStore = useConnectionStore();
const queryStore = useQueryStore();
const isLoading = ref(false);
const error = ref<string | null>(null);
const columns = ref<ColumnDef[]>([]);
const rows = ref<CellValue[][]>([]);
const quickFilter = ref('');
const gridApi = ref<GridApi | null>(null);
const copiedTsv = ref(false);

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
    headerClass: 'text-center !px-1',
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
  if (contextMenu.rowIndex >= 0 && rows.value.length > contextMenu.rowIndex) {
    const row = rows.value[contextMenu.rowIndex];
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
  if (!rows.value.length) return;
  const headers = columns.value.map((c) => c.name).join('\t');
  const rowsText = rows.value
    .map((row) => row.map(formatCellForExport).join('\t'))
    .join('\n');
  const fullText = `${headers}\n${rowsText}`;

  navigator.clipboard.writeText(fullText).then(() => {
    copiedTsv.value = true;
    setTimeout(() => {
      copiedTsv.value = false;
    }, 2000);
  });
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
  }
}

onMounted(() => {
  loadData();
});
</script>
