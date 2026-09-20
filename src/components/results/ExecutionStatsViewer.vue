<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 font-sans select-none overflow-hidden">
    <!-- Empty State -->
    <div
      v-if="!stats"
      class="flex-1 flex flex-col items-center justify-center p-6 text-center text-dark-400 space-y-3"
    >
      <div class="w-12 h-12 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-amber-600 dark:text-amber-400/80">
        <i class="pi pi-chart-bar text-xl"></i>
      </div>
      <div class="space-y-1 max-w-md">
        <div class="text-sm font-medium text-dark-200">尚無執行統計與 IO 分析資料</div>
        <div class="text-xs text-dark-500 leading-relaxed">
          請於頂部工具列勾選「<span class="text-amber-700 dark:text-amber-400 font-semibold">效能分析</span>」後執行查詢，系統將自動擷取 CPU 耗時、各資料表邏輯/實體讀取量及伺服器等候事件。
        </div>
      </div>
    </div>

    <!-- Active Stats Dashboard -->
    <div v-else class="flex-1 flex flex-col overflow-y-auto p-3 space-y-3 font-sans">
      <!-- Top Bar: Timestamp, SQL info, Actions -->
      <div class="flex items-center justify-between border-b border-dark-750 pb-2 flex-shrink-0 text-xs">
        <div class="flex items-center space-x-2 truncate">
          <span class="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400 font-medium">
            <i class="pi pi-chart-bar text-xs"></i>
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
          <Button
            type="button"
            icon="pi pi-sparkles"
            label="AI 調校建議"
            size="small"
            severity="help"
            outlined
            @click="requestAiStatsTuning"
            v-tooltip.top="'使用 AI 智能分析 IO 讀取瓶頸、等候事件與調校建言'"
            class="!text-xxs !py-1 !px-2 text-purple-400 border-purple-500/40 hover:bg-purple-950/30"
          />

          <Button
            type="button"
            icon="pi pi-copy"
            label="複製報告"
            size="small"
            severity="secondary"
            outlined
            @click="copyStatsMarkdown"
            v-tooltip.top="'複製 Markdown 格式統計報表至剪貼簿'"
            class="!text-xxs !py-1 !px-2"
          />

          <Button
            type="button"
            icon="pi pi-trash"
            text
            rounded
            size="small"
            severity="danger"
            @click="queryStore.clearExecutionStats()"
            v-tooltip.top="'清除分析報告'"
            class="!w-7 !h-7 !p-0"
          />
        </div>
      </div>

      <!-- 1. KPI Metric Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 flex-shrink-0">
        <!-- CPU Time -->
        <Card class="!bg-dark-850 !border !border-dark-750 !rounded-lg" :pt="{ body: { class: '!p-2.5 flex flex-col justify-between h-full' } }">
          <template #content>
            <div class="flex items-center justify-between text-dark-400 text-xxs">
              <span>CPU 耗時</span>
              <i class="pi pi-microchip text-amber-600 dark:text-amber-400 text-xs"></i>
            </div>
            <div class="mt-1 flex items-baseline space-x-1 font-mono">
              <span class="text-lg font-bold text-dark-100">{{ stats.cpuTimeMs }}</span>
              <span class="text-dark-400 text-xxs">ms</span>
            </div>
            <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
              編譯: {{ stats.compileCpuTimeMs ?? 0 }} ms
            </div>
          </template>
        </Card>

        <!-- Elapsed Time -->
        <Card class="!bg-dark-850 !border !border-dark-750 !rounded-lg" :pt="{ body: { class: '!p-2.5 flex flex-col justify-between h-full' } }">
          <template #content>
            <div class="flex items-center justify-between text-dark-400 text-xxs">
              <span>總執行耗時</span>
              <i class="pi pi-clock text-sky-400 text-xs"></i>
            </div>
            <div class="mt-1 flex items-baseline space-x-1 font-mono">
              <span class="text-lg font-bold text-dark-100">{{ stats.elapsedTimeMs }}</span>
              <span class="text-dark-400 text-xxs">ms</span>
            </div>
            <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
              編譯: {{ stats.compileElapsedTimeMs ?? 0 }} ms
            </div>
          </template>
        </Card>

        <!-- Logical Reads -->
        <Card class="!bg-dark-850 !border !border-dark-750 !rounded-lg" :pt="{ body: { class: '!p-2.5 flex flex-col justify-between h-full' } }">
          <template #content>
            <div class="flex items-center justify-between text-dark-400 text-xxs">
              <span>邏輯讀取 (Logical)</span>
              <i class="pi pi-book text-emerald-400 text-xs"></i>
            </div>
            <div class="mt-1 flex items-baseline space-x-1 font-mono">
              <span class="text-lg font-bold text-emerald-300">{{ stats.totalLogicalReads.toLocaleString() }}</span>
              <span class="text-dark-400 text-xxs">頁</span>
            </div>
            <div class="text-[10px] text-emerald-400/80 font-mono mt-0.5 truncate">
              容量: {{ extractByteSize(stats.logicalReadsFormatted) }}
            </div>
          </template>
        </Card>

        <!-- Physical Reads -->
        <Card class="!bg-dark-850 !border !border-dark-750 !rounded-lg" :pt="{ body: { class: '!p-2.5 flex flex-col justify-between h-full' } }">
          <template #content>
            <div class="flex items-center justify-between text-dark-400 text-xxs">
              <span>實體讀取 (Physical)</span>
              <i class="pi pi-server text-purple-400 text-xs"></i>
            </div>
            <div class="mt-1 flex items-baseline space-x-1 font-mono">
              <span class="text-lg font-bold text-dark-100">{{ stats.totalPhysicalReads.toLocaleString() }}</span>
              <span class="text-dark-400 text-xxs">頁</span>
            </div>
            <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
              預讀: {{ stats.totalReadAheadReads }} 頁
            </div>
          </template>
        </Card>

        <!-- Physical Writes & LOB -->
        <Card class="!bg-dark-850 !border !border-dark-750 !rounded-lg" :pt="{ body: { class: '!p-2.5 flex flex-col justify-between h-full' } }">
          <template #content>
            <div class="flex items-center justify-between text-dark-400 text-xxs">
              <span>寫入與 LOB 讀取</span>
              <i class="pi pi-database text-indigo-400 text-xs"></i>
            </div>
            <div class="mt-1 flex items-baseline space-x-1 font-mono">
              <span class="text-lg font-bold text-dark-100">{{ stats.totalPhysicalWrites.toLocaleString() }}</span>
              <span class="text-dark-400 text-xxs">頁寫入</span>
            </div>
            <div class="text-[10px] text-dark-500 font-mono mt-0.5 truncate">
              LOB 讀取: {{ stats.totalLobReads }} 頁
            </div>
          </template>
        </Card>
      </div>

      <!-- 2. Health Insight Banner -->
      <Message
        v-if="hasHighIoAlert"
        severity="error"
        :closable="false"
        class="!text-xs"
      >
        <strong>效能警示：</strong>部分資料表邏輯讀取量超過 1,000 頁或存在全表掃描 (Scan count > 0)。建議排查是否有缺失索引或未加入有效過濾條件。
      </Message>
      <Message
        v-else-if="stats.totalLogicalReads > 0"
        severity="success"
        :closable="false"
        class="!text-xs"
      >
        查詢資源消耗處於健康水位，快取命中率約 <strong>{{ stats.cacheHitRatio }}%</strong>。
      </Message>

      <!-- 3. Per-Table IO Breakdown Table -->
      <div class="bg-dark-850 border border-dark-750 rounded-lg flex flex-col overflow-hidden flex-1 min-h-[160px]">
        <!-- Table Header -->
        <div class="h-8 px-3 bg-dark-800/80 border-b border-dark-750 flex items-center justify-between text-xs flex-shrink-0">
          <div class="flex items-center space-x-1.5 font-medium text-dark-200">
            <i class="pi pi-table text-brand-400 text-xs"></i>
            <span>各資料表 IO 讀取明細 (Per-Table IO Breakdown)</span>
            <Tag :value="stats.tableStats.length" severity="secondary" class="!font-mono !text-xxs !px-1.5 !py-0" />
          </div>

          <!-- Quick Filter Input -->
          <IconField>
            <InputIcon class="pi pi-search text-dark-500" />
            <InputText
              v-model="tableFilterQuery"
              placeholder="過濾資料表..."
              size="small"
              class="w-40 font-mono !text-xxs !py-0.5 !pl-6"
            />
          </IconField>
        </div>

        <!-- DataTable -->
        <div class="flex-1 overflow-auto font-mono text-xs">
          <DataTable
            :value="sortedTableStats"
            size="small"
            class="p-datatable-sm w-full"
            :rowClass="() => '!bg-dark-900 hover:!bg-dark-800/80 transition-colors'"
          >
            <template #empty>
              <div class="p-6 text-center text-dark-500 italic text-xs">
                無符合條件之資料表 IO 紀錄
              </div>
            </template>
            <Column field="tableName" header="資料表名稱" sortable class="!py-1.5 !px-3 font-sans font-medium text-dark-200" />
            <Column field="scanCount" header="掃描次數" sortable class="!py-1.5 !px-2 text-right">
              <template #body="{ data }">
                <span :class="data.scanCount > 1 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-dark-300'">
                  {{ data.scanCount }}
                </span>
              </template>
            </Column>
            <Column field="logicalReads" header="邏輯讀取 (佔比)" sortable class="!py-1.5 !px-3 text-right w-44">
              <template #body="{ data }">
                <div class="flex items-center justify-end space-x-2">
                  <div class="w-16 bg-dark-750 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="data.isHighIo ? 'bg-rose-500' : 'bg-brand-400'"
                      :style="{ width: `${getLogicalPercent(data.logicalReads)}%` }"
                    />
                  </div>
                  <span :class="data.isHighIo ? 'text-rose-300 font-bold' : 'text-dark-200'">
                    {{ data.logicalReads.toLocaleString() }}
                  </span>
                </div>
              </template>
            </Column>
            <Column field="physicalReads" header="實體讀取" sortable class="!py-1.5 !px-2 text-right text-dark-300">
              <template #body="{ data }">
                {{ data.physicalReads.toLocaleString() }}
              </template>
            </Column>
            <Column field="readAheadReads" header="預讀" sortable class="!py-1.5 !px-2 text-right text-dark-400">
              <template #body="{ data }">
                {{ data.readAheadReads.toLocaleString() }}
              </template>
            </Column>
            <Column field="lobLogicalReads" header="LOB 讀取" sortable class="!py-1.5 !px-2 text-right text-dark-400">
              <template #body="{ data }">
                {{ data.lobLogicalReads.toLocaleString() }}
              </template>
            </Column>
            <Column field="bytesFormatted" header="總計容量" sortable class="!py-1.5 !px-2 text-right font-medium text-dark-300" />
            <Column header="狀態" class="!py-1.5 !px-3 text-center">
              <template #body="{ data }">
                <Tag
                  :severity="data.isHighIo ? 'danger' : 'success'"
                  :value="data.isHighIo ? 'High IO' : 'OK'"
                  class="!text-[10px] !px-1.5 !py-0.2"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>

      <!-- 4. Session Wait Stats (If any wait events captured) -->
      <div v-if="stats.waitStats.length > 0" class="bg-dark-850 border border-dark-750 rounded-lg p-2.5 flex flex-col space-y-2 flex-shrink-0">
        <div class="flex items-center space-x-1.5 text-xs font-medium text-dark-200">
          <i class="pi pi-bolt text-amber-600 dark:text-amber-400 text-xs"></i>
          <span>工作階段等候事件分析 (Session Wait Statistics)</span>
        </div>

        <DataTable
          :value="stats.waitStats"
          size="small"
          class="p-datatable-sm w-full font-mono text-xxs"
          :rowClass="() => '!bg-dark-900'"
        >
          <Column field="waitType" header="等候類型 (Wait Type)" class="!py-1 !px-2 text-dark-300 font-semibold" />
          <Column field="waitingTasksCount" header="等候次數" class="!py-1 !px-2 text-right text-dark-400" />
          <Column field="waitTimeMs" header="總等候時間 (ms)" class="!py-1 !px-2 text-right text-amber-700 dark:text-amber-400 font-bold">
            <template #body="{ data }">
              {{ data.waitTimeMs }} ms
            </template>
          </Column>
          <Column field="maxWaitTimeMs" header="最大單次等候 (ms)" class="!py-1 !px-2 text-right text-dark-400">
            <template #body="{ data }">
              {{ data.maxWaitTimeMs }} ms
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Message from 'primevue/message';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { useQueryStore } from '@/stores/queryStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAiChatStore } from '@/stores/aiChatStore';

const queryStore = useQueryStore();
const workspaceStore = useWorkspaceStore();
const aiChatStore = useAiChatStore();

const stats = computed(() => queryStore.activeExecutionStats);
const tableFilterQuery = ref('');

function requestAiStatsTuning() {
  if (!stats.value) return;
  const s = stats.value;
  const db = workspaceStore.activeTab?.database || queryStore.activeResultTab?.database;
  aiChatStore.requestStatsAdvice({
    sql: s.querySql,
    cpuTimeMs: s.cpuTimeMs,
    elapsedTimeMs: s.elapsedTimeMs,
    compileCpuTimeMs: s.compileCpuTimeMs,
    compileElapsedTimeMs: s.compileElapsedTimeMs,
    totalLogicalReads: s.totalLogicalReads,
    logicalReadsFormatted: s.logicalReadsFormatted,
    totalPhysicalReads: s.totalPhysicalReads,
    cacheHitRatio: s.cacheHitRatio,
    tableStats: s.tableStats,
    waitStats: s.waitStats,
    database: db,
  });
}

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
  return list;
});

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
