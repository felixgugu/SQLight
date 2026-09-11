<template>
  <div class="w-full h-full flex flex-col bg-dark-900 text-dark-100 overflow-hidden font-sans">
    <!-- Top Toolbar Header -->
    <AppHeader />

    <!-- Center Resizable Body (Sidebar + Workspace/Results) -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Resizable Sidebar -->
      <div
        :style="{ width: `${sidebarSplitter.size.value}px` }"
        class="h-full flex-shrink-0 overflow-hidden"
      >
        <AppSidebar />
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
          <AppMain />
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
  </div>
</template>

<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import AppMain from '@/components/layout/AppMain.vue';
import AppBottomPanel from '@/components/layout/AppBottomPanel.vue';
import AppStatusBar from '@/components/layout/AppStatusBar.vue';
import ResizableSplitter from '@/components/common/ResizableSplitter.vue';
import { useSplitter } from '@/composables/useSplitter';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const workspaceStore = useWorkspaceStore();

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
</script>
