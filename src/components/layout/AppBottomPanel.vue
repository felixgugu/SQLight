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
          ref="resultsTabsBarRef"
          @wheel="handleResultTabsWheel"
          class="h-7 bg-dark-850 border-b border-dark-750 flex items-center px-1.5 space-x-1.5 overflow-x-auto select-none flex-shrink-0"
        >
          <div
            v-for="(rtab, idx) in queryStore.resultTabs"
            :key="rtab.id"
            @pointerdown="onTabPointerDown($event, idx)"
            @click="handleTabClick(rtab.id)"
            :class="[
              'result-tab-item h-5.5 px-2 flex items-center space-x-1.5 text-xxs rounded cursor-grab active:cursor-grabbing transition-all duration-100 group max-w-[220px] border flex-shrink-0 select-none touch-none',
              queryStore.activeResultTabId === rtab.id
                ? 'bg-dark-750 text-dark-100 border-dark-600 font-medium shadow-xs'
                : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-transparent hover:bg-dark-800',
              isPointerDragging && dragSourceIndex === idx ? 'opacity-35 border-dashed border-brand-400 scale-95' : '',
              dropHoverIndex === idx && isPointerDragging && dropHoverIndex !== dragSourceIndex ? 'border-brand-400 bg-brand-500/25 ring-1 ring-brand-400 scale-102' : ''
            ]"
            :title="`${rtab.title}\n執行時間: ${rtab.executedAt} (${rtab.durationMs}ms)\n筆數: ${rtab.rowCount} rows\n\nSQL 語句:\n${rtab.sql}`"
          >
            <!-- Pin / Unpin Button -->
            <button
              type="button"
              @click.stop="queryStore.togglePinTab(rtab.id)"
              :class="[
                'p-0.5 rounded transition-colors cursor-pointer',
                rtab.isPinned
                  ? 'text-amber-400 hover:text-amber-300'
                  : 'text-dark-500 hover:text-dark-300 opacity-60 group-hover:opacity-100'
              ]"
              :title="rtab.isPinned ? '已釘選（不會被自動清理，點擊解除釘選）' : '釘選此結果（保護不被自動移除）'"
            >
              <Pin class="w-2.5 h-2.5" :class="rtab.isPinned ? 'fill-current' : ''" />
            </button>

            <!-- Tab Title -->
            <span class="truncate flex-1 pointer-events-none">{{ rtab.title }}</span>

            <!-- Row Count or Status Badge -->
            <span
              :class="[
                'text-xxs px-1 py-0.2 rounded font-mono flex-shrink-0 pointer-events-none',
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
                  : 'text-dark-500 hover:text-dark-200 hover:bg-dark-700 opacity-0 group-hover:opacity-100 cursor-pointer'
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
import { ref, computed, onBeforeUnmount } from 'vue';
import { TableProperties, MessageSquare, History, Minimize2, Pin, X } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useQueryStore } from '@/stores/queryStore';
import ResultGrid from '@/components/results/ResultGrid.vue';
import ResultMessages from '@/components/results/ResultMessages.vue';
import QueryHistory from '@/components/results/QueryHistory.vue';
import type { BottomPanelTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();
const queryStore = useQueryStore();

const resultsTabsBarRef = ref<HTMLDivElement | null>(null);
const dragSourceIndex = ref<number | null>(null);
const dropHoverIndex = ref<number | null>(null);
const isPointerDragging = ref<boolean>(false);

let startPointerX = 0;
let hasMovedBeyondThreshold = false;

function onTabPointerDown(e: PointerEvent, index: number) {
  // Only respond to left mouse button
  if (e.button !== 0) return;

  // Don't initiate drag if clicking on buttons (Pin / Close)
  const target = e.target as HTMLElement | null;
  if (target?.closest('button')) {
    return;
  }

  dragSourceIndex.value = index;
  dropHoverIndex.value = index;
  startPointerX = e.clientX;
  hasMovedBeyondThreshold = false;

  window.addEventListener('pointermove', onDocumentPointerMove);
  window.addEventListener('pointerup', onDocumentPointerUp);
  window.addEventListener('pointercancel', onDocumentPointerUp);
}

function onDocumentPointerMove(e: PointerEvent) {
  if (dragSourceIndex.value === null) return;

  const dx = Math.abs(e.clientX - startPointerX);
  if (!hasMovedBeyondThreshold && dx > 4) {
    hasMovedBeyondThreshold = true;
    isPointerDragging.value = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  if (!isPointerDragging.value) return;

  // Find which tab is hovered
  if (!resultsTabsBarRef.value) return;
  const tabElements = resultsTabsBarRef.value.querySelectorAll('.result-tab-item');
  let targetIndex: number | null = null;

  for (let i = 0; i < tabElements.length; i++) {
    const el = tabElements[i];
    if (el) {
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        targetIndex = i;
        break;
      }
    }
  }

  if (targetIndex === null && tabElements.length > 0) {
    const firstEl = tabElements[0];
    const lastEl = tabElements[tabElements.length - 1];
    if (firstEl && e.clientX < firstEl.getBoundingClientRect().left) {
      targetIndex = 0;
    } else if (lastEl && e.clientX > lastEl.getBoundingClientRect().right) {
      targetIndex = tabElements.length - 1;
    }
  }

  if (targetIndex !== null) {
    dropHoverIndex.value = targetIndex;
  }
}

function onDocumentPointerUp() {
  window.removeEventListener('pointermove', onDocumentPointerMove);
  window.removeEventListener('pointerup', onDocumentPointerUp);
  window.removeEventListener('pointercancel', onDocumentPointerUp);

  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  if (
    isPointerDragging.value &&
    dragSourceIndex.value !== null &&
    dropHoverIndex.value !== null &&
    dragSourceIndex.value !== dropHoverIndex.value
  ) {
    queryStore.reorderResultTabs(dragSourceIndex.value, dropHoverIndex.value);
  }

  dragSourceIndex.value = null;
  dropHoverIndex.value = null;

  setTimeout(() => {
    isPointerDragging.value = false;
    hasMovedBeyondThreshold = false;
  }, 50);
}

function handleTabClick(tabId: string) {
  if (hasMovedBeyondThreshold || isPointerDragging.value) {
    return;
  }
  queryStore.selectResultTab(tabId);
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDocumentPointerMove);
  window.removeEventListener('pointerup', onDocumentPointerUp);
  window.removeEventListener('pointercancel', onDocumentPointerUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

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
