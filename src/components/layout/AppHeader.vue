<template>
  <Toolbar class="!h-10 !bg-dark-850 !border-b !border-dark-700 !rounded-none !px-2.5 !py-0 select-none flex-shrink-0 relative z-30 font-sans text-xs">
    <!-- Start: Branding & Connection / Database Pickers -->
    <template #start>
      <div class="flex items-center space-x-2">
        <!-- App Brand -->
        <div class="flex items-center space-x-1.5 font-bold text-dark-100 tracking-wide pr-2 border-r border-dark-700">
          <div class="w-5 h-5 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center font-mono text-xs font-black">
            SQL
          </div>
          <span class="text-xs font-bold text-dark-100">SQLight</span>
        </div>

        <!-- Connection Select -->
        <Select
          :model-value="connectionStore.activeConnectionId"
          :options="connectionStore.connections"
          option-value="id"
          option-label="name"
          placeholder="選擇連線..."
          size="small"
          class="!h-7 !text-xs !bg-dark-800 !border-dark-600 hover:!border-dark-500 min-w-[160px] max-w-[220px]"
          :style="activeConnStyle"
          @update:model-value="val => handleSelectConnection(val as string)"
        >
          <template #value="slotProps">
            <div v-if="slotProps.value && connectionStore.activeConnection" class="flex items-center space-x-1.5 min-w-0">
              <i
                class="pi pi-server text-xs flex-shrink-0"
                :class="connectionStore.status === 'connected' ? 'text-emerald-400' : 'text-dark-400'"
                :title="connectionStore.status === 'connected' ? '已連線 (Connected)' : '未連線 (Disconnected)'"
              />
              <span
                class="font-semibold text-xs truncate text-dark-100"
                :style="activeConnNameStyle"
              >
                {{ connectionStore.activeConnection.name }}
              </span>
              <Tag
                v-if="connectionStore.activeConnection.alias"
                severity="info"
                :value="connectionStore.activeConnection.alias"
                class="!text-[10px] !px-1 !py-0 flex-shrink-0"
              />
            </div>
            <span v-else class="text-dark-400 text-xs">選擇連線...</span>
          </template>

          <template #option="slotProps">
            <div class="flex items-center space-x-2 w-full py-0.5">
              <i
                class="pi pi-server text-xs flex-shrink-0"
                :class="isOptionConnected(slotProps.option) ? 'text-emerald-400' : 'text-dark-400'"
                :title="isOptionConnected(slotProps.option) ? '已連線 (Connected)' : '未連線 (Disconnected)'"
              />
              <div class="flex-1 min-w-0 flex flex-col">
                <div class="flex items-center space-x-1.5">
                  <span
                    class="font-medium text-xs truncate"
                    :style="getConnectionLabelStyle(slotProps.option)"
                  >{{ slotProps.option.name }}</span>
                  <Tag
                    v-if="slotProps.option.alias"
                    severity="info"
                    :value="slotProps.option.alias"
                    class="!text-[9px] !px-1 !py-0"
                  />
                </div>
                <span class="text-[10px] text-dark-400 font-mono truncate">
                  {{ slotProps.option.username ? `${slotProps.option.username}@` : '' }}{{ slotProps.option.host }}:{{ slotProps.option.port }}
                </span>
              </div>
              <i
                v-if="connectionStore.activeConnectionId === slotProps.option.id"
                class="pi pi-check text-brand-400 text-xs ml-auto flex-shrink-0"
              />
            </div>
          </template>

          <template #footer>
            <div class="p-1 border-t border-dark-700">
              <Button
                label="建立新連線..."
                icon="pi pi-plus"
                size="small"
                text
                class="w-full !justify-start !text-xs !py-1"
                @click="handleOpenNewConnection"
              />
            </div>
          </template>
        </Select>

        <!-- Database Select -->
        <Select
          :model-value="connectionStore.activeDatabase"
          :options="filteredAvailableDatabases"
          placeholder="選擇資料庫..."
          size="small"
          class="!h-7 !text-xs !bg-dark-800 !border-dark-600 hover:!border-dark-500 min-w-[130px] max-w-[180px]"
          @update:model-value="val => onDatabaseChange(val as string)"
        >
          <template #value="slotProps">
            <div class="flex items-center space-x-1.5 min-w-0">
              <i class="pi pi-database text-amber-600 dark:text-amber-400 text-xs flex-shrink-0" />
              <span class="font-mono text-xs truncate text-amber-800 dark:text-amber-200 font-semibold">
                {{ slotProps.value || '選擇資料庫...' }}
              </span>
            </div>
          </template>

          <template #option="slotProps">
            <div class="flex items-center space-x-1.5 font-mono text-xs py-0.5">
              <i class="pi pi-database text-amber-600 dark:text-amber-400 text-xs flex-shrink-0" />
              <span class="truncate text-dark-200">{{ slotProps.option }}</span>
            </div>
          </template>
        </Select>
      </div>
    </template>

    <!-- End: Actions Toolbar & Settings -->
    <template #end>
      <div class="flex items-center space-x-1">
        <!-- Run / Stop Query Button -->
        <Button
          v-if="!queryStore.isExecuting"
          icon="pi pi-play"
          severity="success"
          size="small"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'執行當前語句或選取內容 (Ctrl + Enter)'"
          @click="$emit('run-query', 'current')"
        />
        <Button
          v-else
          :icon="queryStore.isCancelling ? 'pi pi-spin pi-spinner' : 'pi pi-stop'"
          severity="danger"
          size="small"
          class="!h-7 !w-7 !p-0 animate-pulse"
          :disabled="queryStore.isCancelling"
          v-tooltip.bottom="queryStore.isCancelling ? '正在中斷查詢中...' : '中斷並取消查詢 (Esc)'"
          @click="$emit('cancel-query')"
        />

        <!-- Run All Statements Button -->
        <Button
          icon="pi pi-forward"
          severity="success"
          size="small"
          outlined
          class="!h-7 !w-7 !p-0"
          :disabled="queryStore.isExecuting"
          v-tooltip.bottom="'無條件執行整頁全部內容 (Ctrl + Shift + Enter)'"
          @click="$emit('run-query', 'all')"
        />

        <Divider layout="vertical" class="!my-0 !h-4 !mx-0.5" />

        <!-- SQL Editor Clipboard & Folding Actions -->
        <SqlEditorToolbarActions
          :disabled="workspaceStore.activeTab?.type !== 'sql_editor'"
          @action="handleSqlEditorAction"
        />

        <!-- Format SQL Button -->
        <Button
          icon="pi pi-align-left"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'格式化 SQL (Shift + Alt + F)'"
          @click="$emit('format-sql')"
        />

        <!-- Open SQL File Button -->
        <Button
          icon="pi pi-folder-open"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-sky-400"
          v-tooltip.bottom="'開啟本機 SQL 檔案 (Ctrl + O)'"
          @click="$emit('open-sql-file')"
        />

        <!-- Save SQL File Button -->
        <Button
          icon="pi pi-save"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-amber-400"
          v-tooltip.bottom="'另存當前 SQL 至檔案 (Ctrl + S)'"
          @click="$emit('save-sql-file')"
        />

        <!-- New Query Tab Button -->
        <Button
          icon="pi pi-plus"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-brand-400"
          v-tooltip.bottom="'開啟新查詢分頁 (Ctrl + N)'"
          @click="workspaceStore.addSqlTab()"
        />

        <!-- Quick Object Finder Button (Ctrl + P) -->
        <Button
          icon="pi pi-search"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-cyan-400"
          v-tooltip.bottom="'快速物件檢索器 (Ctrl + P)'"
          @click="$emit('open-quick-finder')"
        />

        <!-- SQL Templates Library Button -->
        <Button
          icon="pi pi-book"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-amber-300"
          v-tooltip.bottom="'常用 SQL 範本庫 (語法、CTE、維護樣板)'"
          @click="$emit('open-sql-templates')"
        />

        <!-- AI SQL Assistant Button -->
        <Button
          icon="pi pi-sparkles"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-purple-400 hover:!text-purple-300"
          v-tooltip.bottom="'AI SQL 智能助手 (Ctrl + I)'"
          @click="$emit('open-ai-chat')"
        />

        <!-- DBA Diagnostics Toolbox Button & Popover -->
        <Button
          icon="pi pi-chart-line"
          severity="secondary"
          size="small"
          text
          class="!h-7 !w-7 !p-0 !text-rose-400"
          v-tooltip.bottom="'DBA 常用診斷維護工具箱'"
          @click="toggleDbaPopover"
        />

        <Popover ref="dbaPopoverRef">
          <div class="w-72 font-sans text-xs select-none">
            <div class="px-2 py-1.5 text-xxs font-semibold uppercase tracking-wider text-dark-400 flex items-center justify-between border-b border-dark-750 mb-1">
              <div class="flex items-center space-x-1.5">
                <i class="pi pi-chart-line text-rose-400 text-xs" />
                <span>DBA 診斷與維護指令庫</span>
              </div>
              <span class="text-dark-500 font-mono">{{ DBA_QUERIES.length }} 項</span>
            </div>
            <div class="max-h-72 overflow-y-auto space-y-0.5">
              <div
                v-for="query in DBA_QUERIES"
                :key="query.id"
                class="px-2.5 py-1.5 rounded hover:bg-dark-750 text-dark-200 transition-colors flex flex-col space-y-0.5 cursor-pointer group"
                @click="openDbaQuery(query)"
              >
                <div class="flex items-center justify-between w-full">
                  <span class="font-medium text-dark-100 group-hover:text-rose-300 transition-colors">
                    {{ query.title }}
                  </span>
                  <span :class="['text-[9px] px-1 py-0.2 rounded border font-mono', query.badgeColor]">
                    {{ query.badge }}
                  </span>
                </div>
                <span class="text-[10px] text-dark-400 leading-tight">
                  {{ query.description }}
                </span>
              </div>
            </div>
          </div>
        </Popover>

        <Divider layout="vertical" class="!my-0 !h-4 !mx-0.5" />

        <!-- Performance Analysis Toggle (SET STATISTICS IO, TIME ON) -->
        <Button
          icon="pi pi-gauge"
          size="small"
          :severity="queryStore.isStatsEnabled ? 'warn' : 'secondary'"
          :text="!queryStore.isStatsEnabled"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'效能分析 (SET STATISTICS IO, TIME ON)'"
          @click="queryStore.toggleStatsEnabled()"
        />

        <!-- Estimated Execution Plan Toggle (SET SHOWPLAN_ALL ON) -->
        <Button
          icon="pi pi-sitemap"
          size="small"
          :severity="queryStore.isShowplanEnabled ? 'info' : 'secondary'"
          :text="!queryStore.isShowplanEnabled"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'預估執行計畫 (SET SHOWPLAN_ALL ON)'"
          @click="queryStore.toggleShowplanEnabled()"
        />

        <!-- Actual Execution Plan Toggle (SET STATISTICS XML ON) -->
        <Button
          icon="pi pi-share-alt"
          size="small"
          :severity="queryStore.isActualPlanEnabled ? 'help' : 'secondary'"
          :text="!queryStore.isActualPlanEnabled"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'實際執行計畫 (SET STATISTICS XML ON)'"
          @click="queryStore.toggleActualPlanEnabled()"
        />

        <!-- Max Rows Limit Selector -->
        <div class="flex items-center space-x-1 pl-1 text-dark-400 text-xxs font-mono">
          <span>Limit:</span>
          <Select
            :model-value="queryStore.maxRows ?? 'none'"
            :options="limitOptions"
            option-value="value"
            option-label="label"
            size="small"
            class="!h-6 !text-[11px] !bg-dark-800 !border-dark-700 min-w-[75px] font-mono"
            @update:model-value="onMaxRowsChange"
          >
            <template #value="slotProps">
              <span class="text-[11px] font-mono leading-none">
                {{ limitOptions.find(o => o.value === slotProps.value)?.label ?? (slotProps.value === 'none' ? 'No Limit' : slotProps.value) }}
              </span>
            </template>
            <template #option="slotProps">
              <span class="text-[11px] font-mono py-0.5">
                {{ slotProps.option.label }}
              </span>
            </template>
          </Select>
        </div>

        <Divider layout="vertical" class="!my-0 !h-4 !mx-0.5" />

        <!-- Toggle Sidebar -->
        <Button
          icon="pi pi-bars"
          size="small"
          :severity="workspaceStore.isSidebarOpen ? 'primary' : 'secondary'"
          :text="!workspaceStore.isSidebarOpen"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'切換左側邊欄'"
          @click="workspaceStore.toggleSidebar()"
        />

        <!-- Toggle Bottom Results Panel -->
        <Button
          icon="pi pi-window-maximize"
          size="small"
          :severity="workspaceStore.isBottomPanelOpen ? 'primary' : 'secondary'"
          :text="!workspaceStore.isBottomPanelOpen"
          :disabled="workspaceStore.activeTab?.type === 'er_diagram'"
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="workspaceStore.activeTab?.type === 'er_diagram' ? 'ER 圖模式下隱藏下方面板' : '切換下方結果面板'"
          @click="workspaceStore.toggleBottomPanel()"
        />

        <!-- Settings Modal Trigger -->
        <Button
          icon="pi pi-cog"
          size="small"
          severity="secondary"
          text
          class="!h-7 !w-7 !p-0"
          v-tooltip.bottom="'系統設定'"
          @click="$emit('open-settings-modal')"
        />
      </div>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Toolbar from 'primevue/toolbar';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import Popover from 'primevue/popover';
import SqlEditorToolbarActions from '@/components/layout/SqlEditorToolbarActions.vue';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DBA_QUERIES, type DbaQueryItem } from '@/utils/dbaQueries';
import type { ConnectionProfile } from '@/types/connection';
import type { SqlEditorToolbarAction } from '@/types/editor';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();
const settingsStore = useSettingsStore();
const dbaPopoverRef = ref();

const limitOptions = [
  { label: '1,000', value: 1000 },
  { label: '5,000', value: 5000 },
  { label: '10,000', value: 10000 },
  { label: '50,000', value: 50000 },
  { label: 'No Limit', value: 'none' },
];

const activeConnStyle = computed(() => {
  const conn = connectionStore.activeConnection;
  if (!conn?.color) return {};
  return {
    borderColor: `${conn.color}aa`,
    boxShadow: `0 0 0 1px ${conn.color}44`,
  };
});

/** 連線名稱套用「標籤色彩」設定；未設定時沿用原本文字樣式。 */
function getConnectionLabelStyle(conn: ConnectionProfile | null | undefined): Record<string, string> {
  const color = conn?.color?.trim();
  if (!color) return {};
  return { color };
}

const activeConnNameStyle = computed(() => getConnectionLabelStyle(connectionStore.activeConnection));

/** 該選項是否為「目前工作區使用中且已連線」的連線。 */
function isOptionConnected(option: ConnectionProfile): boolean {
  return connectionStore.activeConnectionId === option.id && connectionStore.status === 'connected';
}

const filteredAvailableDatabases = computed(() => {
  const current = connectionStore.activeDatabase;
  return connectionStore.availableDatabases.filter(
    (db) => db === current || !settingsStore.isDatabaseHidden(db)
  );
});

function toggleDbaPopover(event: Event) {
  dbaPopoverRef.value?.toggle(event);
}

function openDbaQuery(query: DbaQueryItem) {
  dbaPopoverRef.value?.hide();
  workspaceStore.addSqlTab(query.sql, `${query.title}.sql`);
  workspaceStore.showToast(`已載入「${query.title}」診斷指令，按下 Run 即可執行`, 'info', 2500);
}

const emit = defineEmits<{
  (e: 'run-query', mode?: 'current' | 'all'): void;
  (e: 'cancel-query'): void;
  (e: 'sql-editor-action', action: SqlEditorToolbarAction): void;
  (e: 'format-sql'): void;
  (e: 'open-sql-file'): void;
  (e: 'save-sql-file'): void;
  (e: 'open-connection-modal'): void;
  (e: 'open-settings-modal'): void;
  (e: 'open-quick-finder'): void;
  (e: 'open-sql-templates'): void;
  (e: 'open-ai-chat'): void;
}>();

function handleSqlEditorAction(action: SqlEditorToolbarAction) {
  emit('sql-editor-action', action);
}

async function handleSelectConnection(connId: string) {
  if (!connId || (connectionStore.activeConnectionId === connId && connectionStore.status === 'connected')) {
    return;
  }
  try {
    await connectionStore.connect(connId);
    workspaceStore.updateActiveTabConnection(connId, connectionStore.activeDatabase);
  } catch (err: unknown) {
    console.error('Failed to switch connection:', err);
    alert(`切換連線失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleOpenNewConnection() {
  emit('open-connection-modal');
}

async function onDatabaseChange(newDb: string) {
  if (!newDb) return;
  await connectionStore.switchDatabase(newDb);
  workspaceStore.updateActiveTabDatabase(newDb);
}

function onMaxRowsChange(val: string | number) {
  queryStore.maxRows = val === 'none' ? null : Number(val);
}
</script>
