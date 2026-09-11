<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 overflow-hidden font-sans">
    <!-- Top Toolbar Header -->
    <AppHeader
      @run-query="handleRunQuery"
      @format-sql="handleFormatSql"
      @open-connection-modal="handleOpenNewConnection"
      @open-settings-modal="isSettingsModalOpen = true"
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
          @open-connection-modal="handleOpenNewConnection"
          @edit-connection="handleEditConnection"
        />
      </div>

      <!-- Horizontal Splitter Handle (Resize Sidebar Width) -->
      <ResizableSplitter
        v-if="workspaceStore.isSidebarOpen"
        direction="horizontal"
        :is-dragging="sidebarSplitter.isDragging.value"
        @pointerdown="sidebarSplitter.onPointerDown"
      />

      <!-- Right Area: Main Editor & Bottom Results Panel -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- Main SQL Workspace Area -->
        <div class="flex-1 overflow-hidden min-h-0">
          <AppMain ref="mainWorkspaceRef" />
        </div>

        <!-- Vertical Splitter & Bottom Results Dock -->
        <template v-if="workspaceStore.isBottomPanelOpen">
          <ResizableSplitter
            direction="vertical"
            :is-dragging="bottomSplitter.isDragging.value"
            @pointerdown="bottomSplitter.onPointerDown"
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
      @close="handleCloseConnectionModal"
    />

    <!-- Settings Management Modal -->
    <SettingsModal
      :is-open="isSettingsModalOpen"
      @close="isSettingsModalOpen = false"
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
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-vue-next';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppMain from '@/components/layout/AppMain.vue';
import AppBottomPanel from '@/components/layout/AppBottomPanel.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import ResizableSplitter from '@/components/common/ResizableSplitter.vue';
import ConnectionModal from '@/components/modals/ConnectionModal.vue';
import SettingsModal from '@/components/modals/SettingsModal.vue';
import { useSplitter } from '@/composables/useSplitter';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ConnectionProfile } from '@/types/connection';

const workspaceStore = useWorkspaceStore();
const isConnectionModalOpen = ref(false);
const isSettingsModalOpen = ref(false);
const editingProfile = ref<ConnectionProfile | null>(null);
const mainWorkspaceRef = ref<InstanceType<typeof AppMain> | null>(null);

function handleOpenNewConnection() {
  editingProfile.value = null;
  isConnectionModalOpen.value = true;
}

function handleEditConnection(profile: ConnectionProfile) {
  editingProfile.value = profile;
  isConnectionModalOpen.value = true;
}

function handleCloseConnectionModal() {
  isConnectionModalOpen.value = false;
  editingProfile.value = null;
}

// Resizable sidebar (width: min 180px, max 500px, initial 260px)
const sidebarSplitter = useSplitter({
  direction: 'horizontal',
  initialSize: 260,
  minSize: 180,
  maxSize: 500,
});

// Resizable bottom dock (height: min 120px, max 550px, initial 240px, reverse dragging)
const bottomSplitter = useSplitter({
  direction: 'vertical',
  initialSize: 240,
  minSize: 120,
  maxSize: 550,
  reverse: true,
});

function handleRunQuery(mode: 'current' | 'all' = 'current') {
  mainWorkspaceRef.value?.runQuery(mode);
}

function handleFormatSql() {
  if (mainWorkspaceRef.value) {
    mainWorkspaceRef.value.formatCode();
  } else {
    workspaceStore.formatActiveQuery();
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
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

  // Shift + Alt + F to format SQL
  if (e.shiftKey && e.altKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault();
    handleFormatSql();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
