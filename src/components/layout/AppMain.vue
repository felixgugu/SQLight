<template>
  <main class="h-full flex flex-col bg-dark-900 overflow-hidden">
    <!-- Workspace Tab Bar -->
    <div class="h-9 bg-dark-850 border-b border-dark-700 flex items-center px-1 space-x-1 overflow-x-auto select-none flex-shrink-0">
      <!-- Tabs List -->
      <div
        v-for="tab in workspaceStore.tabs"
        :key="tab.id"
        @click="workspaceStore.setActiveTab(tab.id)"
        :class="[
          'h-7 px-2.5 flex items-center space-x-2 text-xs rounded-t border-t border-x cursor-pointer transition-all duration-100 group max-w-[200px]',
          workspaceStore.activeTabId === tab.id
            ? 'bg-dark-900 text-dark-100 border-dark-700 border-b-dark-900 font-medium'
            : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-transparent hover:bg-dark-800'
        ]"
      >
        <FileCode v-if="tab.type === 'sql_editor'" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        <Table2 v-else class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />

        <span class="truncate flex-1">{{ tab.title }}</span>

        <!-- Dirty Indicator -->
        <span
          v-if="tab.isDirty"
          class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
          title="Unsaved changes"
        />

        <!-- Close Tab Button -->
        <button
          @click.stop="workspaceStore.closeTab(tab.id)"
          class="p-0.5 rounded-full hover:bg-dark-700 text-dark-500 hover:text-dark-200 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          title="Close tab"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Add New Query Tab Button -->
      <button
        @click="workspaceStore.addSqlTab()"
        class="p-1 text-dark-500 hover:text-dark-200 hover:bg-dark-750 rounded transition-colors"
        title="Add new SQL tab"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Active Tab Workspace Area (Editor / Table Data) -->
    <div class="flex-1 relative overflow-hidden bg-dark-900 flex flex-col">
      <div v-if="workspaceStore.activeTab?.type === 'sql_editor'" class="w-full h-full flex flex-col">
        <!-- Monaco Editor Placeholder / Code View -->
        <div class="flex-1 flex overflow-hidden font-mono text-xs">
          <!-- Line Numbers Gutter -->
          <div class="w-12 bg-dark-850/50 text-dark-500 select-none py-3 pr-3 text-right flex flex-col space-y-1 border-r border-dark-750 font-mono">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
            <span>6</span>
            <span>7</span>
          </div>

          <!-- Code Text Area / Phase 1 Editor Shell -->
          <div class="flex-1 p-3 overflow-auto">
            <textarea
              :value="currentQuery"
              @input="onQueryInput"
              class="w-full h-full bg-transparent text-dark-100 font-mono text-xs resize-none outline-none leading-relaxed selection:bg-brand-500/30"
              spellcheck="false"
              placeholder="-- Enter your SQL query here...&#10;SELECT * FROM dbo.Users;"
            ></textarea>
          </div>
        </div>

        <!-- Editor Toolbar & Shortcut Hints -->
        <div class="h-6 bg-dark-850 border-t border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400">
          <div class="flex items-center space-x-3">
            <span>Dialect: <strong class="text-brand-400 font-semibold">T-SQL (SQL Server)</strong></span>
            <span>Shortcut: <kbd class="bg-dark-750 px-1 py-0.5 rounded text-dark-300">Ctrl + Enter</kbd> to Execute</span>
            <span>Format: <kbd class="bg-dark-750 px-1 py-0.5 rounded text-dark-300">Shift + Alt + F</kbd></span>
          </div>
          <div class="flex items-center space-x-2 font-mono">
            <span>Ln 1, Col 1</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      <div v-else-if="workspaceStore.activeTab?.type === 'table_data'" class="w-full h-full flex items-center justify-center text-dark-400 text-xs">
        <span>Table Data Browser for: {{ workspaceStore.activeTab.tableName }}</span>
      </div>

      <div v-else class="w-full h-full flex items-center justify-center text-dark-500 text-xs">
        <span>No active workspace tab</span>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FileCode, Table2, Plus, X } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { SqlEditorTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();

const currentQuery = computed(() => {
  if (workspaceStore.activeTab?.type === 'sql_editor') {
    return (workspaceStore.activeTab as SqlEditorTab).query;
  }
  return '';
});

function onQueryInput(event: Event) {
  const target = event.target as HTMLTextAreaElement;
  if (workspaceStore.activeTabId) {
    workspaceStore.updateTabContent(workspaceStore.activeTabId, target.value);
  }
}
</script>
