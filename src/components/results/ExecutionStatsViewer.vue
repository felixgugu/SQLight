<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 font-sans select-none overflow-hidden">
    <!-- Empty State -->
    <div
      v-if="!stats"
      class="flex-1 flex flex-col items-center justify-center p-6 text-center text-dark-400 space-y-3"
    >
      <div class="w-12 h-12 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-amber-400/80">
        <Gauge class="w-6 h-6" />
      </div>
      <div class="space-y-1 max-w-md">
        <div class="text-sm font-medium text-dark-200">尚無執行統計與 IO 分析資料</div>
        <div class="text-xs text-dark-500 leading-relaxed">
          請於頂部工具列勾選「<span class="text-amber-400 font-semibold">效能分析</span>」後執行查詢，系統將自動擷取 CPU 耗時、各資料表邏輯/實體讀取量及伺服器等候事件。
        </div>
      </div>
    </div>

    <!-- Active Stats Dashboard -->
    <div v-else class="flex-1 flex flex-col overflow-y-auto p-3 space-y-3 font-sans">
      <!-- Top Bar: Timestamp, SQL info, Actions -->
      <div class="flex items-center justify-between border-b border-dark-750 pb-2 flex-shrink-0 text-xs">
        <div class="flex items-center space-x-2 truncate">
          <span class="flex items-center space-x-1 text-amber-400 font-medium">
            <Gauge class="w-3.5 h-3.5 flex-shrink-0" />
            <span>執行效能分析報告</span>
          </span>
          <span class="text-dark-600">|</span>
          <span class="text-dark-400 font-mono text-xxs">時間: {{ stats.executedAt }}</span>
          <span class="text-dark-600">|</span>
          <span class="text-dark-400 truncate max-w-xs font-mono text-xxs" :title="stats.querySql">
            SQL: {{ stats.querySql.replace(/\s+/g, ' ').slice(0, 60) }}...
          </span>
        </div>

        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <button
            type="button"
            @click="copyStatsMarkdown"
            class="px-2 py-1 rounded bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border border-dark-700 text-xxs transition-colors flex items-center space-x-1"
            title="複製 Markdown 格式統計報表至剪貼簿"
          >
            <Copy class="w-3 h-3 text-brand-400" />
            <span>複製報告</span>
          </button>

          <button
            type="button"
            @click="queryStore.clearExecutionStats()"
            class="p-1 rounded bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-700 text-xxs transition-colors"
            title="清除分析報告"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- 1. KPI Metric Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 flex-shrink-0">
        <!-- CPU Time -->
        <div class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-dark-400 text-xxs">
            <span>CPU 耗時</span>
            <Cpu class="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div class="mt-1 flex items-baseline space-x-1 font-mono">
            <span class="text-lg font-bold text-dark-100">{{ stats.cpuTimeMs }}</span>
            <span class="text-dark-400 text-xxs">ms</span>
          </div>
          <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
            編譯: {{ stats.compileCpuTimeMs ?? 0 }} ms
          </div>
        </div>

        <!-- Elapsed Time -->
        <div class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-dark-400 text-xxs">
            <span>總執行耗時</span>
            <Clock class="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div class="mt-1 flex items-baseline space-x-1 font-mono">
            <span class="text-lg font-bold text-dark-100">{{ stats.elapsedTimeMs }}</span>
            <span class="text-dark-400 text-xxs">ms</span>
          </div>
          <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
            編譯: {{ stats.compileElapsedTimeMs ?? 0 }} ms
          </div>
        </div>

        <!-- Logical Reads -->
        <div class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-dark-400 text-xxs">
            <span>邏輯讀取 (Logical)</span>
            <BookOpen class="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div class="mt-1 flex items-baseline space-x-1 font-mono">
            <span class="text-lg font-bold text-emerald-300">{{ stats.totalLogicalReads.toLocaleString() }}</span>
            <span class="text-dark-400 text-xxs">頁</span>
          </div>
          <div class="text-[10px] text-emerald-400/80 font-mono mt-0.5 truncate">
            容量: {{ extractByteSize(stats.logicalReadsFormatted) }}
          </div>
        </div>

        <!-- Physical Reads -->
        <div class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-dark-400 text-xxs">
            <span>實體讀取 (Physical)</span>
            <HardDrive class="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div class="mt-1 flex items-baseline space-x-1 font-mono">
            <span class="text-lg font-bold text-dark-100">{{ stats.totalPhysicalReads.toLocaleString() }}</span>
            <span class="text-dark-400 text-xxs">頁</span>
          </div>
          <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
            預讀: {{ stats.totalReadAheadReads }} 頁
          </div>
        </div>

        <!-- Physical Writes & LOB -->
        <div class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-dark-400 text-xxs">
            <span>寫入與 LOB 讀取</span>
            <Database class="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div class="mt-1 flex items-baseline space-x-1 font-mono">
            <span class="text-lg font-bold text-dark-100">{{ stats.totalPhysicalWrites.toLocaleString() }}</span>
            <span class="text-dark-400 text-xxs">頁寫入</span>
          </div>
          <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
            LOB 讀取: {{ stats.totalLobReads }} 頁
          </div>
        </div>
      </div>

      <!-- 2. Health Insight Banner -->
      <div
        v-if="hasHighIoAlert"
        class="px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-600/40 text-rose-200 text-xs flex items-center space-x-2 flex-shrink-0"
      >
        <AlertTriangle class="w-4 h-4 text-rose-400 flex-shrink-0" />
        <span class="leading-relaxed">
          <strong>效能警示：</strong>部分資料表邏輯讀取量超過 1,000 頁或存在全表掃描 (Scan count > 0)。建議排查是否有缺失索引或未加入有效過濾條件。
        </span>
      </div>
      <div
        v-else-if="stats.totalLogicalReads > 0"
        class="px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-600/30 text-emerald-200 text-xs flex items-center space-x-2 flex-shrink-0"
      >
        <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        <span class="leading-relaxed">
          查詢資源消耗處於健康水位，快取命中率約 <strong>{{ stats.cacheHitRatio }}%</strong>。
        </span>
      </div>

      <!-- 3. Per-Table IO Breakdown Table -->
      <div class="bg-dark-850 border border-dark-750 rounded-lg flex flex-col overflow-hidden flex-1 min-h-[160px]">
        <!-- Table Header -->
        <div class="h-8 px-3 bg-dark-800/80 border-b border-dark-750 flex items-center justify-between text-xs flex-shrink-0">
          <div class="flex items-center space-x-1.5 font-medium text-dark-200">
            <Layers class="w-3.5 h-3.5 text-brand-400" />
            <span>各資料表 IO 讀取明細 (Per-Table IO Breakdown)</span>
            <span class="text-xxs text-dark-500 font-mono">({{ stats.tableStats.length }})</span>
          </div>

          <!-- Quick Filter Input -->
          <div class="relative flex items-center">
            <Search class="w-3 h-3 text-dark-500 absolute left-2" />
            <input
              v-model="tableFilterQuery"
              type="text"
              placeholder="過濾資料表..."
              class="w-40 bg-dark-900 border border-dark-700 rounded px-2 py-0.5 pl-6 text-xxs text-dark-100 placeholder-dark-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>
        </div>

        <!-- Table Body -->
        <div class="flex-1 overflow-auto font-mono text-xs">
          <div v-if="sortedTableStats.length === 0" class="p-6 text-center text-dark-500 italic text-xs">
            無符合條件之資料表 IO 紀錄
          </div>

          <table v-else class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-dark-800/60 text-dark-400 text-xxs uppercase tracking-wider border-b border-dark-750 select-none">
                <th
                  class="py-1.5 px-3 cursor-pointer hover:text-dark-200 font-medium"
                  @click="toggleSort('tableName')"
                >
                  資料表名稱
                  <span v-if="sortField === 'tableName'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-2 cursor-pointer hover:text-dark-200 font-medium text-right"
                  @click="toggleSort('scanCount')"
                >
                  掃描次數
                  <span v-if="sortField === 'scanCount'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-3 cursor-pointer hover:text-dark-200 font-medium text-right w-44"
                  @click="toggleSort('logicalReads')"
                >
                  邏輯讀取 (佔比)
                  <span v-if="sortField === 'logicalReads'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-2 cursor-pointer hover:text-dark-200 font-medium text-right"
                  @click="toggleSort('physicalReads')"
                >
                  實體讀取
                  <span v-if="sortField === 'physicalReads'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-2 cursor-pointer hover:text-dark-200 font-medium text-right"
                  @click="toggleSort('readAheadReads')"
                >
                  預讀
                  <span v-if="sortField === 'readAheadReads'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-2 cursor-pointer hover:text-dark-200 font-medium text-right"
                  @click="toggleSort('lobLogicalReads')"
                >
                  LOB 讀取
                  <span v-if="sortField === 'lobLogicalReads'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th
                  class="py-1.5 px-2 cursor-pointer hover:text-dark-200 font-medium text-right"
                  @click="toggleSort('totalReads')"
                >
                  總計容量
                  <span v-if="sortField === 'totalReads'">{{ sortAsc ? '▲' : '▼' }}</span>
                </th>
                <th class="py-1.5 px-3 text-center font-medium">狀態</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-800/70">
              <tr
                v-for="row in sortedTableStats"
                :key="row.tableName"
                :class="[
                  'transition-colors hover:bg-dark-800/80',
                  row.isHighIo ? 'bg-rose-950/15' : ''
                ]"
              >
                <!-- Table Name -->
                <td class="py-1.5 px-3 font-sans font-medium text-dark-200 truncate max-w-xs" :title="row.tableName">
                  {{ row.tableName }}
                </td>

                <!-- Scan Count -->
                <td class="py-1.5 px-2 text-right">
                  <span :class="row.scanCount > 1 ? 'text-amber-400 font-bold' : 'text-dark-300'">
                    {{ row.scanCount }}
                  </span>
                </td>

                <!-- Logical Reads with Progress Bar -->
                <td class="py-1.5 px-3 text-right">
                  <div class="flex items-center justify-end space-x-2">
                    <!-- Mini visual bar -->
                    <div class="w-16 bg-dark-750 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="row.isHighIo ? 'bg-rose-500' : 'bg-brand-400'"
                        :style="{ width: `${getLogicalPercent(row.logicalReads)}%` }"
                      />
                    </div>
                    <span :class="row.isHighIo ? 'text-rose-300 font-bold' : 'text-dark-200'">
                      {{ row.logicalReads.toLocaleString() }}
                    </span>
                  </div>
                </td>

                <!-- Physical Reads -->
                <td class="py-1.5 px-2 text-right text-dark-300">
                  {{ row.physicalReads.toLocaleString() }}
                </td>

                <!-- Read-Ahead -->
                <td class="py-1.5 px-2 text-right text-dark-400">
                  {{ row.readAheadReads.toLocaleString() }}
                </td>

                <!-- LOB Reads -->
                <td class="py-1.5 px-2 text-right text-dark-400">
                  {{ row.lobLogicalReads.toLocaleString() }}
                </td>

                <!-- Total formatted -->
                <td class="py-1.5 px-2 text-right font-medium text-dark-300">
                  {{ row.bytesFormatted }}
                </td>

                <!-- Severity Badge -->
                <td class="py-1.5 px-3 text-center">
                  <span
                    v-if="row.isHighIo"
                    class="inline-block px-1.5 py-0.2 rounded text-[10px] font-sans font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40"
                    title="邏輯讀取量偏高或有大量掃描"
                  >
                    High IO
                  </span>
                  <span
                    v-else
                    class="inline-block px-1.5 py-0.2 rounded text-[10px] font-sans font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                  >
                    OK
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Session Wait Stats (If any wait events captured) -->
      <div v-if="stats.waitStats.length > 0" class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col space-y-2 flex-shrink-0">
        <div class="flex items-center space-x-1.5 text-xs font-medium text-dark-200">
          <Activity class="w-3.5 h-3.5 text-amber-400" />
          <span>工作階段等候事件分析 (Session Wait Statistics)</span>
        </div>

        <div class="overflow-x-auto font-mono text-xxs">
          <table class="w-full text-left">
            <thead>
              <tr class="text-dark-500 border-b border-dark-750">
                <th class="py-1 px-2">等候類型 (Wait Type)</th>
                <th class="py-1 px-2 text-right">等候次數</th>
                <th class="py-1 px-2 text-right">總等候時間 (ms)</th>
                <th class="py-1 px-2 text-right">最大單次等候 (ms)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-800">
              <tr v-for="w in stats.waitStats" :key="w.waitType">
                <td class="py-1 px-2 text-dark-300 font-semibold">{{ w.waitType }}</td>
                <td class="py-1 px-2 text-right text-dark-400">{{ w.waitingTasksCount }}</td>
                <td class="py-1 px-2 text-right text-amber-400 font-bold">{{ w.waitTimeMs }} ms</td>
                <td class="py-1 px-2 text-right text-dark-400">{{ w.maxWaitTimeMs }} ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Gauge,
  Cpu,
  Clock,
  BookOpen,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Search,
  Copy,
  Trash2,
  Activity,
} from 'lucide-vue-next';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { TableIoStats } from '@/utils/statsParser';

const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();

const stats = computed(() => queryStore.activeExecutionStats);
const tableFilterQuery = ref('');
const sortField = ref<keyof TableIoStats>('logicalReads');
const sortAsc = ref(false);

const hasHighIoAlert = computed(() => {
  return stats.value?.tableStats.some((t) => t.isHighIo) ?? false;
});

const sortedTableStats = computed(() => {
  if (!stats.value?.tableStats) return [];
  let list = stats.value.tableStats;

  const q = tableFilterQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((t) => t.tableName.toLowerCase().includes(q));
  }

  return [...list].sort((a, b) => {
    const valA = a[sortField.value];
    const valB = b[sortField.value];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc.value ? valA - valB : valB - valA;
    }
    return sortAsc.value
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });
});

function toggleSort(field: keyof TableIoStats) {
  if (sortField.value === field) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortField.value = field;
    sortAsc.value = false;
  }
}

function getLogicalPercent(reads: number): number {
  if (!stats.value?.totalLogicalReads || stats.value.totalLogicalReads === 0) return 0;
  return Math.min(100, Math.round((reads / stats.value.totalLogicalReads) * 100));
}

function extractByteSize(formatted: string): string {
  const match = formatted.match(/\(([^)]+)\)/);
  return match?.[1] || formatted;
}

function copyStatsMarkdown() {
  if (!stats.value) return;
  const s = stats.value;

  let md = `### 📊 SQLight 執行效能分析報告\n\n`;
  md += `- **執行時間**: ${s.executedAt}\n`;
  md += `- **CPU 耗時**: ${s.cpuTimeMs} ms (編譯: ${s.compileCpuTimeMs ?? 0} ms)\n`;
  md += `- **總執行耗時**: ${s.elapsedTimeMs} ms\n`;
  md += `- **總邏輯讀取**: ${s.totalLogicalReads.toLocaleString()} 頁 (${s.logicalReadsFormatted})\n`;
  md += `- **總實體讀取**: ${s.totalPhysicalReads.toLocaleString()} 頁\n`;
  md += `- **快取命中率**: ${s.cacheHitRatio}%\n\n`;

  if (s.tableStats.length > 0) {
    md += `| 資料表名稱 | 掃描次數 | 邏輯讀取 | 實體讀取 | 預讀 | 總計容量 |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;
    for (const t of s.tableStats) {
      md += `| ${t.tableName} | ${t.scanCount} | ${t.logicalReads} | ${t.physicalReads} | ${t.readAheadReads} | ${t.bytesFormatted} |\n`;
    }
    md += `\n`;
  }

  if (s.waitStats.length > 0) {
    md += `#### 等候事件 (Wait Stats)\n\n`;
    md += `| 等候類型 | 等候次數 | 總等候時間 (ms) | 最大單次 (ms) |\n`;
    md += `| :--- | :---: | :---: | :---: |\n`;
    for (const w of s.waitStats) {
      md += `| ${w.waitType} | ${w.waitingTasksCount} | ${w.waitTimeMs} | ${w.maxWaitTimeMs} |\n`;
    }
    md += `\n`;
  }

  md += `\`\`\`sql\n${s.querySql}\n\`\`\`\n`;

  try {
    navigator.clipboard?.writeText(md);
    workspaceStore.showToast('已複製效能分析 Markdown 報表至剪貼簿', 'success', 2500);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}
</script>
