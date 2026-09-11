<template>
  <header class="h-10 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-3 text-xs select-none flex-shrink-0 relative">
    <!-- Click Outside Backdrop for Connection & DBA Dropdown -->
    <div
      v-if="isConnDropdownOpen || isDbaDropdownOpen"
      class="fixed inset-0 z-40"
      @click="isConnDropdownOpen = false; isDbaDropdownOpen = false"
    />

    <!-- Left: App Branding & Connection / DB Pickers -->
    <div class="flex items-center space-x-2.5 z-50">
      <!-- App Brand -->
      <div class="flex items-center space-x-2 font-bold text-dark-100 tracking-wide pr-2 border-r border-dark-700">
        <div class="w-5 h-5 rounded bg-brand-500/20 text-brand-500 flex items-center justify-center font-mono text-xs font-black">
          SQL
        </div>
        <span class="text-sm font-semibold">SQLight</span>
      </div>

      <!-- Active Connection Selector Dropdown -->
      <div class="relative">
        <!-- Trigger Button -->
        <button
          type="button"
          @click="isConnDropdownOpen = !isConnDropdownOpen"
          :class="[
            'flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 px-2.5 py-1 rounded border transition-colors cursor-pointer text-xs',
            isConnDropdownOpen ? 'border-brand-500 bg-dark-750 text-dark-100' : 'border-dark-700 text-dark-200'
          ]"
          title="切換連線 (Switch Connection)"
        >
          <!-- Connection indicator / server icon -->
          <span
            v-if="connectionStore.status === 'connected' && connectionStore.activeConnection"
            class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 shadow-xs shadow-emerald-500/50"
          />
          <Server v-else class="w-3.5 h-3.5 text-dark-400 flex-shrink-0" />

          <span class="font-medium max-w-[160px] truncate">
            {{ connectionStore.activeConnection?.name ?? 'Select Connection' }}
          </span>
          <ChevronDown :class="['w-3 h-3 text-dark-400 transition-transform duration-150', isConnDropdownOpen ? 'rotate-180 text-brand-400' : '']" />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="isConnDropdownOpen"
          class="absolute top-full left-0 mt-1.5 w-72 bg-dark-850 border border-dark-700 rounded-md shadow-2xl z-50 py-1 font-sans text-xs select-none"
        >
          <!-- Dropdown Header -->
          <div class="px-2.5 py-1 text-xxs font-semibold uppercase tracking-wider text-dark-400 flex items-center justify-between border-b border-dark-750/70 mb-1">
            <span>連線清單 (Connections)</span>
            <span class="font-mono text-dark-500">{{ connectionStore.connections.length }}</span>
          </div>

          <!-- Empty State -->
          <div
            v-if="connectionStore.connections.length === 0"
            class="px-3 py-3 text-center text-dark-500 text-xs italic"
          >
            尚無已儲存的連線
          </div>

          <!-- Connections List -->
          <div v-else class="max-h-64 overflow-y-auto space-y-0.5 px-1">
            <button
              v-for="conn in connectionStore.connections"
              :key="conn.id"
              type="button"
              @click="handleSelectConnection(conn.id)"
              :class="[
                'w-full text-left px-2 py-1.5 rounded flex items-center space-x-2 transition-colors group cursor-pointer',
                connectionStore.activeConnectionId === conn.id
                  ? 'bg-brand-500/15 text-brand-300'
                  : 'hover:bg-dark-750 text-dark-200'
              ]"
            >
              <!-- Icon / Status dot -->
              <span
                v-if="connectionStore.activeConnectionId === conn.id && connectionStore.status === 'connected'"
                class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
              />
              <Server v-else class="w-3.5 h-3.5 text-dark-400 group-hover:text-dark-200 flex-shrink-0" />

              <!-- Connection Name & Info -->
              <div class="flex-1 min-w-0 flex flex-col">
                <span class="font-medium truncate leading-tight">{{ conn.name }}</span>
                <span class="text-xxs text-dark-400 font-mono truncate leading-tight mt-0.5">
                  {{ conn.username ? `${conn.username}@` : '' }}{{ conn.host }}:{{ conn.port }}
                </span>
              </div>

              <!-- Selected Checkmark -->
              <Check
                v-if="connectionStore.activeConnectionId === conn.id"
                class="w-3.5 h-3.5 text-brand-400 flex-shrink-0 ml-1"
              />
            </button>
          </div>

          <!-- Bottom Action: New Connection -->
          <div class="border-t border-dark-750 mt-1 pt-1 px-1">
            <button
              type="button"
              @click="handleOpenNewConnection"
              class="w-full text-left px-2 py-1.5 rounded flex items-center space-x-2 text-brand-400 hover:text-brand-300 hover:bg-dark-750 transition-colors cursor-pointer font-medium"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>建立新連線 (New Connection...)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Active Database Selector Dropdown -->
      <div class="relative">
        <select
          :value="connectionStore.activeDatabase"
          @change="onDatabaseChange"
          class="bg-dark-800 hover:bg-dark-750 text-dark-200 font-mono px-2 py-1 rounded border border-dark-700 text-xs focus:outline-none focus:border-brand-500 cursor-pointer appearance-none pr-6"
        >
          <option
            v-for="db in connectionStore.availableDatabases"
            :key="db"
            :value="db"
          >
            {{ db }}
          </option>
        </select>
        <ChevronDown class="w-3 h-3 text-dark-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>

    <!-- Middle Spacer to push action controls to the right -->
    <div class="flex-1 min-w-4" />

    <!-- Right: Actions Toolbar & Settings -->
    <div class="flex items-center space-x-2 z-10">
      <!-- Main Action Toolbar (Run, Run All, Stop, Format, New Tab, Limit) -->
      <div class="flex items-center space-x-1">
        <!-- Run Current Statement / Selected Button -->
        <button
          @click="$emit('run-query', 'current')"
          :disabled="queryStore.isExecuting"
          class="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-2.5 py-1 rounded font-medium shadow-xs transition-colors group disabled:opacity-50 cursor-pointer"
          title="執行單一語句或選取內容 (Ctrl + Enter)"
        >
          <RotateCw v-if="queryStore.isExecuting" class="w-3.5 h-3.5 animate-spin" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>Run</span>
          <span class="text-xxs text-emerald-200 font-mono bg-emerald-700/60 px-1 py-0.2 rounded">^↵</span>
        </button>

        <!-- Run All Statements Button -->
        <button
          @click="$emit('run-query', 'all')"
          :disabled="queryStore.isExecuting"
          class="flex items-center space-x-1.5 bg-emerald-700/80 hover:bg-emerald-600 active:bg-emerald-800 text-emerald-100 hover:text-white px-2.5 py-1 rounded font-medium shadow-xs transition-colors group disabled:opacity-50 cursor-pointer"
          title="無條件執行整頁全部內容 (Ctrl + Shift + Enter)"
        >
          <PlaySquare class="w-3.5 h-3.5" />
          <span>Run All</span>
          <span class="text-xxs text-emerald-300 font-mono bg-emerald-800/80 px-1 py-0.2 rounded">^+↵</span>
        </button>

        <!-- Stop Button -->
        <button
          class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 px-2 py-1 rounded border border-dark-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!queryStore.isExecuting"
          title="Cancel Execution"
        >
          <Square class="w-3 h-3" />
          <span>Stop</span>
        </button>

        <div class="h-4 w-px bg-dark-700 mx-1"></div>

        <!-- Format SQL Button -->
        <button
          @click="$emit('format-sql')"
          class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 px-2 py-1 rounded border border-dark-700 transition-colors cursor-pointer"
          title="Format SQL (Shift + Alt + F)"
        >
          <AlignLeft class="w-3.5 h-3.5 text-dark-400" />
          <span>Format</span>
        </button>

        <!-- New Query Tab Button -->
        <button
          @click="workspaceStore.addSqlTab()"
          class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 px-2 py-1 rounded border border-dark-700 transition-colors cursor-pointer"
          title="New SQL Query Tab"
        >
          <Plus class="w-3.5 h-3.5 text-brand-500" />
          <span>New Tab</span>
        </button>

        <!-- DBA Diagnostics Toolbox Button & Dropdown -->
        <div class="relative">
          <button
            type="button"
            @click="isDbaDropdownOpen = !isDbaDropdownOpen"
            :class="[
              'flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer text-xs font-medium',
              isDbaDropdownOpen
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 border-dark-700'
            ]"
            title="DBA 常用診斷維護工具箱 (SQL Server 排查與監控指令庫)"
          >
            <Activity class="w-3.5 h-3.5 text-rose-400" />
            <span>DBA 工具箱</span>
            <ChevronDown :class="['w-3 h-3 text-dark-400 transition-transform duration-150', isDbaDropdownOpen ? 'rotate-180 text-rose-400' : '']" />
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="isDbaDropdownOpen"
            class="absolute top-full right-0 mt-1.5 w-80 bg-dark-850 border border-dark-700 rounded-md shadow-2xl z-50 py-1 font-sans text-xs select-none"
          >
            <div class="px-3 py-1.5 text-xxs font-semibold uppercase tracking-wider text-dark-400 flex items-center justify-between border-b border-dark-750 mb-1">
              <div class="flex items-center space-x-1.5">
                <Activity class="w-3 h-3 text-rose-400" />
                <span>DBA 常用診斷與維護指令庫</span>
              </div>
              <span class="text-dark-500 font-mono">{{ DBA_QUERIES.length }} 項</span>
            </div>

            <div class="max-h-96 overflow-y-auto space-y-0.5 px-1">
              <button
                v-for="query in DBA_QUERIES"
                :key="query.id"
                type="button"
                @click="openDbaQuery(query)"
                class="w-full text-left px-2.5 py-2 rounded hover:bg-dark-750 text-dark-200 transition-colors flex flex-col space-y-0.5 cursor-pointer group"
              >
                <div class="flex items-center justify-between w-full">
                  <span class="font-medium text-dark-100 group-hover:text-rose-300 transition-colors">
                    {{ query.title }}
                  </span>
                  <span :class="['text-[9px] px-1.5 py-0.2 rounded border font-mono', query.badgeColor]">
                    {{ query.badge }}
                  </span>
                </div>
                <span class="text-xxs text-dark-400 leading-tight">
                  {{ query.description }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Max Rows Limit Selector -->
        <div class="flex items-center space-x-1 pl-1.5 border-l border-dark-750 text-dark-400 text-xxs font-mono">
          <span title="查詢回傳最大筆數限制 (超過時自動截斷以保護效能)">Limit:</span>
          <select
            :value="queryStore.maxRows ?? 'none'"
            @change="onMaxRowsChange"
            class="bg-dark-800 hover:bg-dark-750 text-dark-200 font-mono px-1.5 py-0.5 rounded border border-dark-700 text-xxs focus:outline-none focus:border-brand-500 cursor-pointer"
            title="Max Rows Limit (預設 10,000 筆，防止大量資料使介面崩潰)"
          >
            <option value="1000">1,000</option>
            <option value="5000">5,000</option>
            <option value="10000">10,000</option>
            <option value="50000">50,000</option>
            <option value="none">No Limit</option>
          </select>
        </div>
      </div>

      <div class="h-4 w-px bg-dark-700 mx-0.5"></div>

      <!-- Right Controls: Toggle Sidebar, Results Dock & Settings Center -->
      <div class="flex items-center space-x-1.5">
        <button
          @click="workspaceStore.toggleSidebar()"
          :class="[
            'p-1.5 rounded transition-colors border cursor-pointer',
            workspaceStore.isSidebarOpen
              ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
              : 'bg-dark-800 text-dark-400 hover:text-dark-200 border-dark-700'
          ]"
          title="切換左側邊欄 (Toggle Sidebar)"
        >
          <PanelLeft class="w-3.5 h-3.5" />
        </button>

        <button
          @click="workspaceStore.toggleBottomPanel()"
          :class="[
            'p-1.5 rounded transition-colors border cursor-pointer',
            workspaceStore.isBottomPanelOpen
              ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
              : 'bg-dark-800 text-dark-400 hover:text-dark-200 border-dark-700'
          ]"
          title="切換下方結果面板 (Toggle Results Dock)"
        >
          <PanelBottom class="w-3.5 h-3.5" />
        </button>

        <!-- Real Settings Modal Trigger -->
        <button
          @click="$emit('open-settings-modal')"
          class="p-1.5 rounded bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-700 transition-colors cursor-pointer"
          title="偏好與系統設定 (Settings)"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  Server,
  ChevronDown,
  Play,
  PlaySquare,
  Square,
  AlignLeft,
  Plus,
  PanelLeft,
  PanelBottom,
  Settings,
  RotateCw,
  Check,
  Activity,
} from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { DBA_QUERIES, type DbaQueryItem } from '@/utils/dbaQueries';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const isConnDropdownOpen = ref(false);
const isDbaDropdownOpen = ref(false);

function openDbaQuery(query: DbaQueryItem) {
  isDbaDropdownOpen.value = false;
  workspaceStore.addSqlTab(query.sql, `${query.title}.sql`);
  workspaceStore.showToast(`已載入「${query.title}」診斷指令，按下 Run 即可執行`, 'info', 2500);
}

const emit = defineEmits<{
  (e: 'run-query', mode?: 'current' | 'all'): void;
  (e: 'format-sql'): void;
  (e: 'open-connection-modal'): void;
  (e: 'open-settings-modal'): void;
}>();

async function handleSelectConnection(connId: string) {
  isConnDropdownOpen.value = false;
  if (connectionStore.activeConnectionId === connId && connectionStore.status === 'connected') {
    return;
  }
  try {
    await connectionStore.connect(connId);
  } catch (err: unknown) {
    console.error('Failed to switch connection:', err);
    alert(`切換連線失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleOpenNewConnection() {
  isConnDropdownOpen.value = false;
  emit('open-connection-modal');
}

function onDatabaseChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  connectionStore.switchDatabase(target.value);
}

function onMaxRowsChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  queryStore.maxRows = target.value === 'none' ? null : parseInt(target.value, 10);
}
</script>
