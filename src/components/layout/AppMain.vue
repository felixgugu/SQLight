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

    <!-- Active Tab Workspace Area (Monaco Editor / Table Data) -->
    <div class="flex-1 relative overflow-hidden bg-dark-900 flex flex-col">
      <div v-if="workspaceStore.activeTab?.type === 'sql_editor'" class="w-full h-full flex flex-col">
        <!-- Monaco SQL Editor Component -->
        <div class="flex-1 relative overflow-hidden">
          <MonacoEditor
            ref="monacoRef"
            :key="workspaceStore.activeTab.id"
            v-model="(workspaceStore.activeTab as SqlEditorTab).query"
            @execute="(sql, mode) => runQuery(mode || 'current', sql)"
            @format="workspaceStore.formatActiveQuery()"
          />
        </div>

        <!-- Editor Toolbar & Shortcut Hints -->
        <div class="h-6 bg-dark-850 border-t border-dark-750 flex items-center justify-between px-3 text-xxs text-dark-400 select-none">
          <div class="flex items-center space-x-3">
            <span>Dialect: <strong class="text-brand-400 font-semibold">T-SQL</strong></span>
            <span>Run: <kbd class="bg-dark-750 px-1 py-0.5 rounded text-dark-300 font-mono">Ctrl + Enter</kbd></span>
            <span>Run All: <kbd class="bg-dark-750 px-1 py-0.5 rounded text-dark-300 font-mono">Ctrl + Shift + Enter</kbd></span>
            <span>Format: <kbd class="bg-dark-750 px-1 py-0.5 rounded text-dark-300 font-mono">Shift + Alt + F</kbd></span>
          </div>
          <div class="flex items-center space-x-3 font-mono">
            <span v-if="queryStore.isExecuting" class="text-amber-400 animate-pulse font-medium">Executing...</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      <!-- Table Data Browser Tab -->
      <TableDataViewer
        v-else-if="workspaceStore.activeTab?.type === 'table_data'"
        :schema="(workspaceStore.activeTab as TableDataTab).schema"
        :table-name="(workspaceStore.activeTab as TableDataTab).tableName"
      />

      <div v-else class="w-full h-full flex items-center justify-center text-dark-500 text-xs">
        <span>No active workspace tab</span>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FileCode, Table2, Plus, X } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import MonacoEditor from '@/components/editor/MonacoEditor.vue';
import TableDataViewer from '@/components/editor/TableDataViewer.vue';
import type { SqlEditorTab, TableDataTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null);

async function runQuery(mode: 'current' | 'all' = 'current', queryOverride?: string) {
  let targetSql = queryOverride;
  if (!targetSql && monacoRef.value) {
    targetSql = monacoRef.value.getExecutableQuery(mode);
  }
  if (!targetSql && workspaceStore.activeTab?.type === 'sql_editor') {
    targetSql = (workspaceStore.activeTab as SqlEditorTab).query;
  }

  if (!targetSql || !targetSql.trim()) return;

  const connId = connectionStore.activeConnectionId || 'default';
  const db = connectionStore.activeDatabase || 'master';

  const result = await queryStore.execute(connId, db, targetSql);

  // Auto-switch to Results or Messages
  if (result && result.messages.some((m) => m.level === 'error')) {
    workspaceStore.setBottomPanelTab('messages');
  } else {
    workspaceStore.setBottomPanelTab('results');
  }
}

defineExpose({
  runQuery,
});
</script>
