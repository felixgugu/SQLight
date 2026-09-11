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

      <!-- Active Connection Selector -->
      <div class="flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 px-2 py-1 rounded border border-dark-700 cursor-pointer transition-colors">
        <Database class="w-3.5 h-3.5 text-emerald-400" />
        <span class="text-dark-200 font-medium max-w-[140px] truncate">
          {{ connectionStore.activeConnection?.name ?? 'No Connection' }}
        </span>
        <ChevronDown class="w-3 h-3 text-dark-400" />
      </div>

      <!-- Active Database Selector -->
      <div class="flex items-center space-x-1.5 bg-dark-800 hover:bg-dark-750 px-2 py-1 rounded border border-dark-700 cursor-pointer transition-colors">
        <span class="text-dark-400">DB:</span>
        <span class="text-dark-200 font-medium font-mono">
          {{ connectionStore.activeDatabase }}
        </span>
        <ChevronDown class="w-3 h-3 text-dark-400" />
      </div>
    </div>

    <!-- Center: Main Action Toolbar (Run, Stop, Format, New Tab) -->
    <div class="flex items-center space-x-1">
      <!-- Run Button -->
      <button
        class="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-2.5 py-1 rounded font-medium shadow-sm transition-colors group"
        title="Execute Query (Ctrl + Enter)"
      >
        <Play class="w-3.5 h-3.5 fill-current" />
        <span>Run</span>
        <span class="text-xxs text-emerald-200 font-mono bg-emerald-700/60 px-1 py-0.2 rounded">^↵</span>
      </button>

      <!-- Stop Button -->
      <button
        class="flex items-center space-x-1 bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 px-2 py-1 rounded border border-dark-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        disabled
        title="Cancel Execution"
      >
        <Square class="w-3 h-3" />
        <span>Stop</span>
      </button>

      <div class="h-4 w-px bg-dark-700 mx-1"></div>

      <!-- Format SQL Button -->
      <button
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
        class="p-1.5 rounded bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-dark-200 border border-dark-700 transition-colors"
        title="Application Settings"
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
} from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
</script>
