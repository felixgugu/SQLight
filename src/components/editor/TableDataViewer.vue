<template>
  <div class="w-full h-full flex flex-col bg-dark-900 overflow-hidden font-mono text-xs">
    <!-- Subheader toolbar for Table Data -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-3 text-xs flex-shrink-0">
      <div class="flex items-center space-x-2">
        <Table2 class="w-4 h-4 text-emerald-400" />
        <span class="font-semibold text-dark-100">{{ schema }}.{{ tableName }}</span>
        <span class="text-dark-500">|</span>
        <span class="text-dark-400">Rows: <strong class="text-emerald-400">{{ rows.length }}</strong></span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          @click="loadData"
          class="flex items-center space-x-1 px-2 py-1 bg-dark-800 hover:bg-dark-750 text-dark-200 rounded border border-dark-700 transition-colors"
          title="Reload table data"
        >
          <RotateCw :class="['w-3 h-3', isLoading ? 'animate-spin text-brand-400' : '']" />
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

    <!-- Table Content -->
    <div v-else class="flex-1 overflow-auto">
      <table class="w-full text-left border-collapse font-mono text-xs">
        <thead class="bg-dark-850 sticky top-0 border-b border-dark-700 text-dark-300 text-xxs uppercase tracking-wider select-none">
          <tr>
            <th class="p-2 w-12 text-center text-dark-500 border-r border-dark-750">#</th>
            <th
              v-for="col in columns"
              :key="col.name"
              class="p-2 border-r border-dark-750 font-semibold text-dark-200 truncate max-w-[200px]"
            >
              {{ col.name }}
              <span class="text-dark-500 lowercase ml-1 font-normal font-sans">({{ col.dataType }})</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-800 text-dark-200">
          <tr
            v-for="(row, rIdx) in rows"
            :key="rIdx"
            class="hover:bg-dark-800/60 transition-colors"
          >
            <td class="p-2 text-center text-dark-500 bg-dark-850/40 border-r border-dark-800">{{ rIdx + 1 }}</td>
            <td
              v-for="(cell, cIdx) in row"
              :key="cIdx"
              class="p-2 border-r border-dark-800 truncate max-w-[280px]"
            >
              <span v-if="cell === null" class="italic text-dark-500 font-mono">NULL</span>
              <span v-else-if="typeof cell === 'object' && 'type' in cell" class="bg-indigo-950/60 text-indigo-300 px-1 py-0.5 rounded text-xxs font-sans font-medium border border-indigo-800/50">
                [Binary {{ cell.length }}B]
              </span>
              <span v-else-if="typeof cell === 'boolean'" :class="cell ? 'text-emerald-400' : 'text-rose-400'">
                {{ cell ? 'TRUE' : 'FALSE' }}
              </span>
              <span v-else>{{ cell }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Table2, RotateCw } from 'lucide-vue-next';
import { queryService } from '@/services/queryService';
import { useConnectionStore } from '@/stores/connectionStore';
import type { ColumnDef, CellValue } from '@/types/query';

const props = defineProps<{
  schema: string;
  tableName: string;
}>();

const connectionStore = useConnectionStore();
const isLoading = ref(false);
const error = ref<string | null>(null);
const columns = ref<ColumnDef[]>([]);
const rows = ref<CellValue[][]>([]);

async function loadData() {
  const connId = connectionStore.activeConnectionId;
  if (!connId) {
    error.value = 'No active connection';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const sql = `SELECT TOP 1000 * FROM [${props.schema}].[${props.tableName}];`;
    const res = await queryService.executeQuery(connId, sql);
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
