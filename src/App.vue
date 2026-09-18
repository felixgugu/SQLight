<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 overflow-hidden font-sans">
    <!-- Top Toolbar Header -->
    <AppHeader
      @run-query="handleRunQuery"
      @cancel-query="handleCancelQuery"
      @format-sql="handleFormatSql"
      @open-sql-file="handleOpenSqlFile"
      @save-sql-file="handleSaveSqlFile"
      @open-connection-modal="handleOpenNewConnection"
      @open-settings-modal="isSettingsModalOpen = true"
      @open-quick-finder="isQuickFinderOpen = true"
      @open-sql-templates="isSqlTemplatesOpen = true"
    />


    <!-- Center Resizable Body (Sidebar + Workspace/Results) -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Resizable Sidebar -->
      <div
        v-if="workspaceStore.isSidebarOpen"
        :style="{ width: `${sidebarSplitter.size.value}px` }"
        class="h-full flex-shrink-0 overflow-hidden"
      >
        <AppSidebar
          ref="sidebarRef"
          @open-connection-modal="handleOpenNewConnection"
          @edit-connection="handleEditConnection"
          @duplicate-connection="handleDuplicateConnection"
          @request-locate-table="handleLocateTableRequest"
        />
      </div>

      <!-- Horizontal Splitter Handle (Resize Sidebar Width) -->
      <ResizableSplitter
        v-if="workspaceStore.isSidebarOpen"
        direction="horizontal"
        :is-dragging="sidebarSplitter.isDragging.value"
        @pointerdown="sidebarSplitter.onPointerDown"
        @dragover.prevent
      />

      <!-- Right Area: Main Editor & Bottom Results Panel -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- Main SQL Workspace Area -->
        <div class="flex-1 overflow-hidden min-h-0">
          <AppMain ref="mainWorkspaceRef" />
        </div>

        <!-- Vertical Splitter & Bottom Results Dock -->
        <template v-if="workspaceStore.isBottomPanelOpen && workspaceStore.activeTab?.type !== 'er_diagram'">
          <ResizableSplitter
            direction="vertical"
            :is-dragging="bottomSplitter.isDragging.value"
            @pointerdown="bottomSplitter.onPointerDown"
            @dblclick="toggleMaximizeBottomPanel"
          />

          <div
            :style="{ height: `${bottomSplitter.size.value}px` }"
            class="w-full flex-shrink-0 overflow-hidden"
          >
            <AppBottomPanel />
          </div>
        </template>
      </div>
    </div>

    <!-- Bottom Status Bar -->
    <AppStatusBar />

    <!-- Connection Management Modal -->
    <ConnectionModal
      :is-open="isConnectionModalOpen"
      :edit-profile="editingProfile"
      :initial-profile="initialConnectionProfile"
      @close="handleCloseConnectionModal"
    />

    <!-- Settings Management Modal -->
    <SettingsModal
      :is-open="isSettingsModalOpen"
      @close="isSettingsModalOpen = false"
    />

    <!-- Quick Object Finder (Spotlight Ctrl+P) -->
    <QuickObjectFinderModal
      :is-open="isQuickFinderOpen"
      @close="isQuickFinderOpen = false"
    />

    <!-- Common SQL Templates Modal (常用 SQL 範本庫與同層自訂文件) -->
    <SqlTemplateModal
      :is-open="isSqlTemplatesOpen"
      @close="isSqlTemplatesOpen = false"
      @insert="handleInsertTemplate"
      @open-in-new-tab="handleOpenTemplateInNewTab"
    />


    <!-- Global Floating Toast Notification -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="workspaceStore.activeToast"
        class="fixed bottom-8 right-6 z-50 flex items-center space-x-2.5 px-3.5 py-2 rounded-lg shadow-2xl border text-xs font-sans backdrop-blur-md pointer-events-none select-none max-w-md"
        :class="[
          workspaceStore.activeToast.type === 'success' ? 'bg-emerald-950/90 border-emerald-600/70 text-emerald-200' :
          workspaceStore.activeToast.type === 'warning' ? 'bg-amber-950/90 border-amber-600/70 text-amber-200' :
          workspaceStore.activeToast.type === 'error' ? 'bg-rose-950/90 border-rose-600/70 text-rose-200' :
          'bg-dark-800/95 border-dark-650 text-dark-100 shadow-black/60'
        ]"
      >
        <CheckCircle2 v-if="workspaceStore.activeToast.type === 'success'" class="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <AlertTriangle v-else-if="workspaceStore.activeToast.type === 'warning'" class="w-4 h-4 text-amber-400 flex-shrink-0" />
        <XCircle v-else-if="workspaceStore.activeToast.type === 'error'" class="w-4 h-4 text-rose-400 flex-shrink-0" />
        <Info v-else class="w-4 h-4 text-brand-400 flex-shrink-0" />
        <span class="font-medium leading-relaxed">{{ workspaceStore.activeToast.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-vue-next';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppMain from '@/components/layout/AppMain.vue';
import AppBottomPanel from '@/components/layout/AppBottomPanel.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import ResizableSplitter from '@/components/common/ResizableSplitter.vue';
import ConnectionModal from '@/components/modals/ConnectionModal.vue';
import SettingsModal from '@/components/modals/SettingsModal.vue';
import QuickObjectFinderModal from '@/components/modals/QuickObjectFinderModal.vue';
import SqlTemplateModal from '@/components/modals/SqlTemplateModal.vue';
import { useSplitter } from '@/composables/useSplitter';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useQueryStore } from '@/stores/queryStore';
import type { ConnectionProfile } from '@/types/connection';
import type { SqlTemplate } from '@/types/sqlTemplate';

const workspaceStore = useWorkspaceStore();
const queryStore = useQueryStore();
const isConnectionModalOpen = ref(false);
const isSettingsModalOpen = ref(false);
const isQuickFinderOpen = ref(false);
const isSqlTemplatesOpen = ref(false);
const editingProfile = ref<ConnectionProfile | null>(null);
const initialConnectionProfile = ref<ConnectionProfile | null>(null);
const mainWorkspaceRef = ref<InstanceType<typeof AppMain> | null>(null);
const sidebarRef = ref<InstanceType<typeof AppSidebar> | null>(null);

async function handleLocateTableRequest() {
  if (!workspaceStore.isSidebarOpen) {
    workspaceStore.toggleSidebar();
  }

  const target = mainWorkspaceRef.value?.getTableNameAtCursor();
  if (!target || !target.table) {
    workspaceStore.showToast(
      '游標處未偵測到資料表名稱，請將游標移至資料表或反白選取名稱',
      'info',
      2500
    );
    return;
  }

  if (sidebarRef.value) {
    await sidebarRef.value.locateTable(target);
  }
}

function handleInsertTemplate(template: SqlTemplate) {
  isSqlTemplatesOpen.value = false;
  mainWorkspaceRef.value?.insertTextAtCursor(template.code, template.title);
}

function handleOpenTemplateInNewTab(template: SqlTemplate) {
  isSqlTemplatesOpen.value = false;
  workspaceStore.addSqlTab(template.code, `${template.title}.sql`);
  workspaceStore.showToast(`已在新分頁開啟「${template.title}」`, 'info', 2200);
}


function handleOpenNewConnection() {
  editingProfile.value = null;
  initialConnectionProfile.value = null;
  isConnectionModalOpen.value = true;
}

function handleEditConnection(profile: ConnectionProfile) {
  editingProfile.value = profile;
  initialConnectionProfile.value = null;
  isConnectionModalOpen.value = true;
}

function handleDuplicateConnection(profile: ConnectionProfile) {
  editingProfile.value = null;
  initialConnectionProfile.value = profile;
  isConnectionModalOpen.value = true;
}

function handleCloseConnectionModal() {
  isConnectionModalOpen.value = false;
  editingProfile.value = null;
  initialConnectionProfile.value = null;
}

// Resizable sidebar (width: min 180px, max 500px, initial 260px)
const sidebarSplitter = useSplitter({
  direction: 'horizontal',
  initialSize: 260,
  minSize: 180,
  maxSize: 500,
});

// Resizable bottom dock (height: min 100px, dynamic max up to window height - 100px, initial 240px, reverse dragging)
const bottomSplitter = useSplitter({
  direction: 'vertical',
  initialSize: 240,
  minSize: 100,
  maxSize: () => Math.max(200, window.innerHeight - 100),
  reverse: true,
});

let preMaximizedBottomHeight = 240;

function toggleMaximizeBottomPanel() {
  const maxH = Math.max(200, window.innerHeight - 100);
  if (bottomSplitter.size.value >= maxH - 40) {
    // Already maximized, restore to previous size or default 240px
    bottomSplitter.size.value = Math.max(100, preMaximizedBottomHeight || 240);
  } else {
    // Save current size and maximize
    preMaximizedBottomHeight = bottomSplitter.size.value;
    bottomSplitter.size.value = maxH;
  }
}

function handleRunQuery(mode: 'current' | 'all' = 'current') {
  mainWorkspaceRef.value?.runQuery(mode);
}

function handleCancelQuery() {
  queryStore.cancelQuery();
}

function handleFormatSql() {
  if (mainWorkspaceRef.value) {
    mainWorkspaceRef.value.formatCode();
  } else {
    workspaceStore.formatActiveQuery();
  }
}

function handleOpenSqlFile() {
  mainWorkspaceRef.value?.openSqlFile();
}

function handleSaveSqlFile() {
  mainWorkspaceRef.value?.saveActiveTab();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  // Alt + Break / Pause -> Cancel Running Query
  if (e.altKey && (e.key === 'Pause' || e.key === 'Cancel' || e.code === 'Pause')) {
    e.preventDefault();
    handleCancelQuery();
    return;
  }

  // Escape -> Cancel Query if executing and no modal is open
  if (e.key === 'Escape' && queryStore.isExecuting) {
    if (!isQuickFinderOpen.value && !isConnectionModalOpen.value && !isSettingsModalOpen.value) {
      e.preventDefault();
      handleCancelQuery();
      return;
    }
  }
  // Ctrl/Cmd + Shift + Enter -> Run All
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    handleRunQuery('all');
    return;
  }

  // Ctrl/Cmd + Enter -> Run Current Statement / Selected
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'Enter') {
    e.preventDefault();
    handleRunQuery('current');
    return;
  }

  // Ctrl/Cmd + S -> Save SQL File
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    handleSaveSqlFile();
    return;
  }

  // Ctrl/Cmd + O -> Open SQL File
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault();
    handleOpenSqlFile();
    return;
  }

  // Shift + Alt + F to format SQL
  if (e.shiftKey && e.altKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault();
    handleFormatSql();
    return;
  }

  // Ctrl/Cmd + N -> Add New Query Tab
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    handleNewQueryTab();
    return;
  }

  // Ctrl/Cmd + P -> Quick Object Finder (Spotlight)
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    isQuickFinderOpen.value = !isQuickFinderOpen.value;
    return;
  }
}

function handleNewQueryTab() {
  workspaceStore.addSqlTab();
  nextTick(() => {
    mainWorkspaceRef.value?.scrollToStart();
    mainWorkspaceRef.value?.focusEditor();
  });
}

function handleOpenQuickFinder() {
  isQuickFinderOpen.value = true;
}

function handleOpenSqlTemplates() {
  isSqlTemplatesOpen.value = true;
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('sqlight:new-query-tab', handleNewQueryTab);
  window.addEventListener('sqlight:open-quick-finder', handleOpenQuickFinder);
  window.addEventListener('sqlight:open-sql-templates', handleOpenSqlTemplates);
  window.addEventListener('sqlight:locate-table-at-cursor', handleLocateTableRequest);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('sqlight:new-query-tab', handleNewQueryTab);
  window.removeEventListener('sqlight:open-quick-finder', handleOpenQuickFinder);
  window.removeEventListener('sqlight:open-sql-templates', handleOpenSqlTemplates);
  window.removeEventListener('sqlight:locate-table-at-cursor', handleLocateTableRequest);
});
</script>

