<template>
  <div
    class="w-full h-full bg-dark-850/95 backdrop-blur border border-dark-700 hover:border-brand-500/70 rounded-lg shadow-xl shadow-black/40 overflow-hidden flex flex-col font-sans transition-all select-none group"
    :class="isSelected ? 'ring-2 ring-brand-400 border-brand-400 shadow-brand-500/20' : ''"
  >
    <!-- Table Header -->
    <div
      class="h-8 bg-dark-800 border-b border-dark-700/80 px-2.5 flex items-center justify-between flex-shrink-0 cursor-move"
    >
      <div class="flex items-center space-x-1.5 min-w-0 flex-1">
        <Table2 class="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
        <span class="text-xxs text-dark-400 font-mono truncate flex-shrink-0">{{ nodeData.schema }}.</span>
        <span class="text-xs font-semibold text-dark-100 truncate flex-1 font-mono" :title="`${nodeData.schema}.${nodeData.table}`">
          {{ nodeData.table }}
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-0.5 ml-1 flex-shrink-0">
        <button
          type="button"
          @click.stop="removeTable"
          class="p-1 rounded text-dark-400 hover:text-rose-400 hover:bg-dark-750 transition-colors"
          title="從畫布移除此表"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Columns List Body -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-dark-800/60 text-xxs font-mono">
      <div
        v-for="col in visibleColumns"
        :key="col.name"
        class="h-6 px-2 flex items-center justify-between hover:bg-dark-750/70 transition-colors relative"
        :class="[
          col.isPrimaryKey ? 'bg-amber-500/5' : (col.isForeignKey ? 'bg-sky-500/5' : ''),
          nodeData.isEditMode && !isColumnChecked(col.name) ? 'bg-dark-950/40' : ''
        ]"
        :title="`${col.name} (${col.dataType}${col.maxLength ? `(${col.maxLength})` : ''}) ${col.isNullable ? 'NULL' : 'NOT NULL'}`"
      >
        <!-- Left Column Info: Checkbox, Icons & Name -->
        <div class="flex items-center space-x-1.5 min-w-0 flex-1 mr-2">
          <!-- Checkbox in Edit Mode -->
          <input
            v-if="nodeData.isEditMode"
            type="checkbox"
            :checked="isColumnChecked(col.name)"
            :disabled="isColumnConnected(col.name)"
            @click.stop="toggleColumn(col.name)"
            class="w-3 h-3 rounded bg-dark-900 border border-dark-600 text-amber-500 focus:ring-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            :title="
              isColumnConnected(col.name)
                ? '此欄位已有外鍵或關聯連線，不可隱藏'
                : isColumnChecked(col.name)
                ? '已勾選 (點擊取消以隱藏)'
                : '未勾選 (檢視模式下將隱藏，不可連線)'
            "
          />

          <!-- PK / FK / Default Icon -->
          <Key v-if="col.isPrimaryKey" class="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
          <Link2 v-else-if="col.isForeignKey" class="w-2.5 h-2.5 text-sky-400 flex-shrink-0" />
          <div v-else class="w-2.5 h-2.5 flex items-center justify-center flex-shrink-0">
            <span class="w-1 h-1 rounded-full bg-dark-500"></span>
          </div>

          <span
            class="truncate"
            :class="[
              nodeData.isEditMode && !isColumnChecked(col.name)
                ? 'text-[#cccccc]'
                : col.isPrimaryKey
                ? 'text-amber-200 font-semibold'
                : col.isForeignKey
                ? 'text-sky-200'
                : 'text-dark-200'
            ]"
          >
            {{ col.name }}
          </span>
        </div>

        <!-- Right Column Info: Data Type -->
        <div
          class="flex items-center space-x-1 flex-shrink-0 text-[10px]"
          :class="nodeData.isEditMode && !isColumnChecked(col.name) ? 'text-[#cccccc]/70' : 'text-dark-400'"
        >
          <span class="truncate max-w-[80px]" :title="col.dataType">
            {{ formatDataType(col) }}
          </span>
        </div>
      </div>

    </div>

    <!-- Edit Mode Sub-Toolbar (Column Selection Controls) -->
    <div
      v-if="nodeData.isEditMode"
      class="h-6 px-2 bg-dark-900/90 border-t border-dark-750 flex items-center justify-between text-xxs select-none font-sans flex-shrink-0"
    >
      <div class="flex items-center space-x-1 text-dark-400">
        <CheckSquare class="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span class="text-[10px]">欄位 ({{ checkedCount }}/{{ nodeData.columns.length }})</span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          type="button"
          @click.stop="checkAllColumns"
          class="px-1.5 py-0.5 rounded text-[10px] bg-dark-800 hover:bg-dark-750 text-dark-200 hover:text-white transition-colors cursor-pointer border border-dark-700"
          title="全部勾選顯示"
        >
          全選
        </button>
        <button
          type="button"
          @click.stop="uncheckAllColumns"
          class="px-1.5 py-0.5 rounded text-[10px] bg-dark-800 hover:bg-dark-750 text-dark-200 hover:text-white transition-colors cursor-pointer border border-dark-700"
          title="全部取消 (已有連線的欄位將自動保留)"
        >
          全取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, onMounted } from 'vue';
import { Table2, Key, Link2, X, CheckSquare } from 'lucide-vue-next';
import type { Node } from '@antv/x6';
import type { ColumnItem } from '@/types/schema';

export interface ErTableColumn extends ColumnItem {
  isForeignKey?: boolean;
}

export interface ErTableNodeData {
  schema: string;
  table: string;
  isRoot?: boolean;
  isKeysOnly?: boolean;
  columns: ErTableColumn[];
  checkedColumns?: string[];
  isEditMode?: boolean;
}

const getNode = inject<() => Node>('getNode');
const node = getNode ? getNode() : null;

const nodeData = ref<ErTableNodeData>({
  schema: 'dbo',
  table: 'Table',
  isRoot: false,
  isKeysOnly: false,
  columns: [],
  checkedColumns: undefined,
  isEditMode: false,
});

const isSelected = ref(false);
const connectedCols = ref<Set<string>>(new Set());

function getConnectedColumnNames(): Set<string> {
  const set = new Set<string>();
  if (!node) return set;
  const graph = node.model?.graph;
  if (!graph) return set;
  try {
    const edges = graph.getConnectedEdges(node) || [];
    for (const edge of edges) {
      const srcCell = edge.getSourceCell();
      const tgtCell = edge.getTargetCell();
      if (srcCell === node) {
        const p = edge.getSourcePortId() || '';
        const col = p.replace(/-(in|out)$/, '');
        if (col) set.add(col);
      }
      if (tgtCell === node) {
        const p = edge.getTargetPortId() || '';
        const col = p.replace(/-(in|out)$/, '');
        if (col) set.add(col);
      }
    }
  } catch (e) {
    console.warn('Failed to get connected edges:', e);
  }
  return set;
}

function refreshConnectedCols() {
  connectedCols.value = getConnectedColumnNames();
}

onMounted(() => {
  if (node) {
    const d = node.getData<ErTableNodeData>();
    if (d) {
      nodeData.value = { ...d };
    }
    node.on('change:data', ({ current }) => {
      if (current) {
        nodeData.value = { ...current };
        refreshConnectedCols();
      }
    });

    // Selection & Edge tracking
    const graph = node.model?.graph;
    if (graph) {
      graph.on('cell:selected', ({ cell }) => {
        if (cell === node) isSelected.value = true;
      });
      graph.on('cell:unselected', ({ cell }) => {
        if (cell === node) isSelected.value = false;
      });
      graph.on('edge:connected', refreshConnectedCols);
      graph.on('edge:removed', refreshConnectedCols);
      graph.on('edge:added', refreshConnectedCols);
      refreshConnectedCols();
    }
  }
});

const isColumnChecked = (colName: string): boolean => {
  if (nodeData.value.checkedColumns === undefined) return true;
  return nodeData.value.checkedColumns.includes(colName);
};

const isColumnConnected = (colName: string): boolean => {
  return connectedCols.value.has(colName);
};

const checkedCount = computed(() => {
  if (nodeData.value.checkedColumns === undefined) return nodeData.value.columns.length;
  return nodeData.value.columns.filter((c) => nodeData.value.checkedColumns?.includes(c.name)).length;
});

const visibleColumns = computed(() => {
  // In edit mode: show ALL columns so user can check/uncheck them
  if (nodeData.value.isEditMode) {
    return nodeData.value.columns;
  }
  // In view mode: show ONLY checked columns
  return nodeData.value.columns.filter((c) => isColumnChecked(c.name));
});

function formatDataType(col: ErTableColumn): string {
  if (col.maxLength && col.maxLength > 0) {
    return `${col.dataType}(${col.maxLength})`;
  }
  return col.dataType;
}

function checkAllColumns() {
  if (!node) return;
  const allNames = nodeData.value.columns.map((c) => c.name);
  nodeData.value.checkedColumns = allNames;
  node.setData({ ...nodeData.value, checkedColumns: allNames }, { overwrite: true });
}

function uncheckAllColumns() {
  if (!node) return;
  refreshConnectedCols();
  // Keep connected columns checked, uncheck all others
  const remaining = nodeData.value.columns
    .map((c) => c.name)
    .filter((name) => connectedCols.value.has(name));
  nodeData.value.checkedColumns = remaining;
  node.setData({ ...nodeData.value, checkedColumns: remaining }, { overwrite: true });
}

function toggleColumn(colName: string) {
  if (!node) return;
  if (isColumnConnected(colName)) return; // Protected

  const currentList = nodeData.value.checkedColumns !== undefined
    ? [...nodeData.value.checkedColumns]
    : nodeData.value.columns.map((c) => c.name);

  const idx = currentList.indexOf(colName);
  if (idx > -1) {
    currentList.splice(idx, 1);
  } else {
    currentList.push(colName);
  }

  nodeData.value.checkedColumns = currentList;
  node.setData({ ...nodeData.value, checkedColumns: currentList }, { overwrite: true });
}


function removeTable() {
  if (node) {
    node.remove();
  }
}
</script>
