<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 overflow-hidden font-sans">
    <!-- Top Toolbar Header -->
    <AppHeader
      @run-query="handleRunQuery"
      @open-connection-modal="handleOpenNewConnection"
    />

    <!-- Center Resizable Body (Sidebar + Workspace/Results) -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Resizable Sidebar -->
      <div
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppMain from '@/components/layout/AppMain.vue';
import AppBottomPanel from '@/components/layout/AppBottomPanel.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import ResizableSplitter from '@/components/common/ResizableSplitter.vue';
import ConnectionModal from '@/components/modals/ConnectionModal.vue';
import { useSplitter } from '@/composables/useSplitter';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ConnectionProfile } from '@/types/connection';

const workspaceStore = useWorkspaceStore();
const isConnectionModalOpen = ref(false);
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

function handleRunQuery() {
  mainWorkspaceRef.value?.runQuery();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter to run query
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleRunQuery();
  }

  // Shift + Alt + F to format SQL
  if (e.shiftKey && e.altKey && (e.key === 'F' || e.key === 'f')) {
    e.preventDefault();
    workspaceStore.formatActiveQuery();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
