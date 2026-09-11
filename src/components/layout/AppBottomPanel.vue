<template>
  <div class="h-full bg-dark-850 flex flex-col overflow-hidden select-none border-t border-dark-700">
    <!-- Bottom Panel Header Tabs -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0">
      <!-- Tabs Switcher -->
      <div class="flex items-center space-x-1">
        <button
          v-for="tab in panelTabs"
          :key="tab.id"
          @click="workspaceStore.setBottomPanelTab(tab.id)"
          :class="[
            'h-6 px-2.5 flex items-center space-x-1.5 rounded text-xs font-medium transition-colors',
            workspaceStore.bottomPanelTab === tab.id
              ? 'bg-dark-750 text-dark-100 shadow-sm'
              : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.badge !== undefined && tab.badge > 0"
            :class="[
              'text-xxs px-1 rounded-full font-mono',
              tab.id === 'messages' && hasErrorMessages
                ? 'bg-rose-900/80 text-rose-200'
                : 'bg-dark-700 text-dark-300'
            ]"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>

      <!-- Right Summary & Panel Controls -->
      <div class="flex items-center space-x-3 text-xxs font-mono text-dark-400">
        <span v-if="queryStore.activeResultTab">
          Duration: <strong class="text-brand-400">{{ queryStore.activeResultTab.durationMs }}ms</strong>
        </span>
        <span v-if="queryStore.activeResultTab">
          Rows: <strong class="text-emerald-400">{{ queryStore.activeResultTab.rowCount }}</strong>
        </span>
        <span v-else-if="queryStore.activeResult">
          Duration: <strong class="text-brand-400">{{ queryStore.activeResult.executionTimeMs }}ms</strong>
        </span>
        <span v-if="!queryStore.activeResultTab && queryStore.activeResult">
          Affected: <strong class="text-emerald-400">{{ queryStore.activeResult.affectedRows }}</strong>
        </span>

        <button
          @click="workspaceStore.toggleBottomPanel()"
          class="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-750 rounded transition-colors"
          title="Minimize Panel"
        >
          <Minimize2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Panel Body -->
    <div class="flex-1 overflow-hidden bg-dark-900">
      <!-- Tab 1: Results Grid with Multi-Result Tabs Bar -->
      <div v-if="workspaceStore.bottomPanelTab === 'results'" class="w-full h-full flex flex-col">
        <!-- Results History Tabs Bar (Latest at leftmost, rightwards older) -->
        <div
          v-if="queryStore.resultTabs.length > 0"
          @wheel="handleResultTabsWheel"
          class="h-7 bg-dark-850 border-b border-dark-750 flex items-center px-1.5 space-x-1.5 overflow-x-auto select-none flex-shrink-0"
        >
          <div
            v-for="(rtab, idx) in queryStore.resultTabs"
            :key="rtab.id"
            draggable="true"
            @dragstart="onDragStart($event, idx)"
            @dragover.prevent="onDragOver($event, idx)"
            @dragleave="onDragLeave($event, idx)"
            @drop="onDrop($event, idx)"
            @dragend="onDragEnd"
            @click="queryStore.selectResultTab(rtab.id)"
            :class="[
              'h-5.5 px-2 flex items-center space-x-1.5 text-xxs rounded cursor-pointer transition-all duration-100 group max-w-[220px] border flex-shrink-0 select-none',
              queryStore.activeResultTabId === rtab.id
                ? 'bg-dark-750 text-dark-100 border-dark-600 font-medium shadow-xs'
                : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-transparent hover:bg-dark-800',
              draggedTabIndex === idx ? 'opacity-35 scale-95 border-dashed border-dark-500' : '',
              dragOverTabIndex === idx ? 'border-brand-400 bg-brand-500/20 ring-1 ring-brand-400' : ''
            ]"
            :title="`${rtab.title}\n執行時間: ${rtab.executedAt} (${rtab.durationMs}ms)\n筆數: ${rtab.rowCount} rows\n\nSQL 語句:\n${rtab.sql}`"
          >
            <!-- Pin / Unpin Button -->
            <button
              type="button"
              @click.stop="queryStore.togglePinTab(rtab.id)"
              :class="[
                'p-0.5 rounded transition-colors',
                rtab.isPinned
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-dark-500 hover:text-dark-300 opacity-60 group-hover:opacity-100'
              ]"
              :title="rtab.isPinned ? '已釘選（不會被自動清理，點擊解除釘選）' : '釘選此結果（保護不被自動移除）'"
            >
              <Pin class="w-2.5 h-2.5" :class="rtab.isPinned ? 'fill-current' : ''" />
            </button>

            <!-- Tab Title -->
            <span class="truncate flex-1">{{ rtab.title }}</span>

            <!-- Row Count or Status Badge -->
            <span
              :class="[
                'text-xxs px-1 py-0.2 rounded font-mono flex-shrink-0',
                rtab.result.messages.some((m) => m.level === 'error')
                  ? 'bg-rose-900/80 text-rose-300'
                  : 'bg-dark-700 text-dark-300'
              ]"
            >
              {{ rtab.result.messages.some((m) => m.level === 'error') ? 'Err' : `${rtab.rowCount}r` }}
            </span>

            <!-- Delete Tab Button (Disabled on the last remaining result tab) -->
            <button
              type="button"
              @click.stop="queryStore.deleteResultTab(rtab.id)"
              :disabled="queryStore.resultTabs.length <= 1"
              :class="[
                'p-0.5 rounded transition-opacity flex-shrink-0',
                queryStore.resultTabs.length <= 1
                  ? 'opacity-20 cursor-not-allowed text-dark-600'
                  : 'text-dark-500 hover:text-dark-200 hover:bg-dark-700 opacity-0 group-hover:opacity-100'
              ]"
              :title="queryStore.resultTabs.length <= 1 ? '最後一個查詢結果不可刪除' : '關閉此結果'"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <!-- Result Grid Viewer Area -->
        <div class="flex-1 min-h-0 overflow-hidden">
          <ResultGrid
            :result-sets="queryStore.activeResult?.resultSets ?? []"
          />
        </div>
      </div>

      <!-- Tab 2: Messages -->
      <ResultMessages
        v-else-if="workspaceStore.bottomPanelTab === 'messages'"
        :messages="queryStore.activeResult?.messages ?? []"
      />

      <!-- Tab 3: History -->
      <QueryHistory
        v-else-if="workspaceStore.bottomPanelTab === 'history'"
        :history="queryStore.history"
        @select="onSelectHistory"
        @clear="queryStore.clearHistory()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { TableProperties, MessageSquare, History, Minimize2, Pin, X } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useQueryStore } from '@/stores/queryStore';
import ResultGrid from '@/components/results/ResultGrid.vue';
import ResultMessages from '@/components/results/ResultMessages.vue';
import QueryHistory from '@/components/results/QueryHistory.vue';
import type { BottomPanelTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();
const queryStore = useQueryStore();

const draggedTabIndex = ref<number | null>(null);
const dragOverTabIndex = ref<number | null>(null);

function onDragStart(e: DragEvent, index: number) {
  draggedTabIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
}

function onDragOver(_e: DragEvent, index: number) {
  if (draggedTabIndex.value !== null && draggedTabIndex.value !== index) {
    dragOverTabIndex.value = index;
  }
}

function onDragLeave(_e: DragEvent, index: number) {
  if (dragOverTabIndex.value === index) {
    dragOverTabIndex.value = null;
  }
}

function onDrop(e: DragEvent, index: number) {
  e.preventDefault();
  if (draggedTabIndex.value !== null && draggedTabIndex.value !== index) {
    queryStore.reorderResultTabs(draggedTabIndex.value, index);
  }
  draggedTabIndex.value = null;
  dragOverTabIndex.value = null;
}

function onDragEnd() {
  draggedTabIndex.value = null;
  dragOverTabIndex.value = null;
}

const hasErrorMessages = computed(() => {
  return queryStore.activeResult?.messages.some((m) => m.level === 'error') ?? false;
});

const panelTabs = computed<{ id: BottomPanelTab; label: string; icon: typeof TableProperties; badge?: number }[]>(() => [
  {
    id: 'results',
    label: 'Results',
    icon: TableProperties,
    badge: queryStore.resultTabs.length > 0 ? queryStore.resultTabs.length : (queryStore.activeResult?.resultSets[0]?.rowCount ?? 0),
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    badge: queryStore.activeResult?.messages.length ?? 0,
  },
  {
    id: 'history',
    label: 'History',
    icon: History,
    badge: queryStore.history.length,
  },
]);

function handleResultTabsWheel(e: WheelEvent) {
  const container = e.currentTarget as HTMLElement;
  if (!container) return;
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    container.scrollLeft += e.deltaY;
  }
}

function onSelectHistory(sql: string) {
  workspaceStore.addSqlTab(sql);
}
</script>
