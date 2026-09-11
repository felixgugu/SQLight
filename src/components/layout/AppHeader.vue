<template>
  <header class="h-10 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-3 text-xs select-none flex-shrink-0">
    <!-- Left: App Branding & Connection / DB Pickers -->
    <div class="flex items-center space-x-3">
      <!-- App Brand -->
      <div class="flex items-center space-x-2 font-bold text-dark-100 tracking-wide pr-2 border-r border-dark-700">
        <div class="w-5 h-5 rounded bg-brand-500/20 text-brand-500 flex items-center justify-center font-mono text-xs font-black">
          SQL
        </div>
        <span class="text-sm font-semibold">SQLight</span>
      </div>

      <!-- Active Connection Selector / Open Modal -->
      <div
        @click="$emit('open-connection-modal')"
        class="flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 px-2 py-1 rounded border border-dark-700 cursor-pointer transition-colors"
        title="Manage Connections"
      >
        <Database class="w-3.5 h-3.5 text-emerald-400" />
        <span class="text-dark-200 font-medium max-w-[150px] truncate">
          {{ connectionStore.activeConnection?.name ?? 'Select Connection' }}
        </span>
        <ChevronDown class="w-3 h-3 text-dark-400" />
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

    <!-- Center: Main Action Toolbar (Run, Stop, Format, New Tab) -->
    <div class="flex items-center space-x-1">
      <!-- Run Button -->
      <button
        @click="$emit('run-query')"
        :disabled="queryStore.isExecuting"
        class="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-2.5 py-1 rounded font-medium shadow-xs transition-colors group disabled:opacity-50"
        title="Execute Query (Ctrl + Enter)"
      >
        <RotateCw v-if="queryStore.isExecuting" class="w-3.5 h-3.5 animate-spin" />
        <Play v-else class="w-3.5 h-3.5 fill-current" />
        <span>{{ queryStore.isExecuting ? 'Running...' : 'Run' }}</span>
        <span class="text-xxs text-emerald-200 font-mono bg-emerald-700/60 px-1 py-0.2 rounded">^↵</span>
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
        @click="workspaceStore.formatActiveQuery()"
        class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 px-2 py-1 rounded border border-dark-700 transition-colors"
        title="Format SQL (Shift + Alt + F)"
      >
        <AlignLeft class="w-3.5 h-3.5 text-dark-400" />
        <span>Format</span>
      </button>

      <!-- New Query Tab Button -->
      <button
        @click="workspaceStore.addSqlTab()"
        class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-300 hover:text-dark-100 px-2 py-1 rounded border border-dark-700 transition-colors"
        title="New SQL Query Tab"
      >
        <Plus class="w-3.5 h-3.5 text-brand-500" />
        <span>New Tab</span>
      </button>

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

    <!-- Right: Settings & Window Controls -->
    <div class="flex items-center space-x-2">
      <button
        @click="workspaceStore.toggleBottomPanel()"
        :class="[
          'p-1.5 rounded transition-colors border',
          workspaceStore.isBottomPanelOpen
            ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
            : 'bg-dark-800 text-dark-400 hover:text-dark-200 border-dark-700'
        ]"
        title="Toggle Results Dock"
      >
        <PanelBottom class="w-3.5 h-3.5" />
      </button>

      <button
        @click="$emit('open-connection-modal')"
        class="p-1.5 rounded bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-700 transition-colors"
        title="Connection Settings"
      >
        <Settings class="w-3.5 h-3.5" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import {
  Database,
  ChevronDown,
  Play,
  Square,
  AlignLeft,
  Plus,
  PanelBottom,
  Settings,
  RotateCw,
} from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

defineEmits<{
  (e: 'run-query'): void;
  (e: 'open-connection-modal'): void;
}>();

function onDatabaseChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  connectionStore.switchDatabase(target.value);
}

function onMaxRowsChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  queryStore.maxRows = target.value === 'none' ? null : parseInt(target.value, 10);
}
</script>
