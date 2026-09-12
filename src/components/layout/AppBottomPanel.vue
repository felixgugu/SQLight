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
            @contextmenu.prevent="openTabContextMenu($event, rtab)"
            :class="[
              'result-tab-item h-5.5 px-2 flex items-center space-x-1.5 text-xxs rounded cursor-grab active:cursor-grabbing transition-all duration-100 group max-w-[220px] border flex-shrink-0 select-none touch-none',
              queryStore.activeResultTabId === rtab.id
                ? 'font-medium shadow-xs border-dark-600'
                : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-transparent hover:bg-dark-800',
              isPointerDragging && dragSourceIndex === idx ? 'opacity-35 border-dashed border-brand-400 scale-95' : '',
              dropHoverIndex === idx && isPointerDragging && dropHoverIndex !== dragSourceIndex ? 'border-brand-400 bg-brand-500/25 ring-1 ring-brand-400 scale-102' : ''
            ]"
            :style="queryStore.activeResultTabId === rtab.id ? {
              backgroundColor: settingsStore.activeResultTabBgColor,
              color: settingsStore.activeResultTabTextColor,
              borderColor: settingsStore.activeResultTabBgColor,
            } : {}"
            :title="`${rtab.title}\n執行時間: ${rtab.executedAt} (${rtab.durationMs}ms)\n筆數: ${rtab.rowCount} rows\n\nSQL 語句:\n${rtab.sql}`"
          >
            <!-- Pin / Unpin Button -->
            <button
              type="button"
              @click.stop="queryStore.togglePinTab(rtab.id)"
              :class="[
                'p-0.5 rounded transition-colors cursor-pointer',
                rtab.isPinned
                  ? 'text-amber-300'
                  : (queryStore.activeResultTabId === rtab.id ? 'text-white/70 hover:text-white' : 'text-dark-500 hover:text-dark-300 opacity-60 group-hover:opacity-100')
              ]"
              :title="rtab.isPinned ? '已釘選（不會被自動清理，點擊解除釘選）' : '釘選此結果（保護不被自動移除）'"
            >
              <Pin class="w-2.5 h-2.5" :class="rtab.isPinned ? 'fill-current' : ''" />
            </button>

            <!-- Tab Title (Normal Span OR Inline Rename Input) -->
            <input
              v-if="editingTabId === rtab.id"
              ref="renameInputRef"
              v-model="editingTabTitle"
              @click.stop
              @pointerdown.stop
              @keydown.enter.stop="saveRenameTab(rtab.id)"
              @keydown.esc.stop="cancelRenameTab"
              @blur="saveRenameTab(rtab.id)"
              class="bg-dark-900 border border-brand-500 text-dark-100 rounded px-1 py-0 text-xxs font-sans focus:outline-none w-20 flex-1 min-w-0"
            />
            <span
              v-else
              @dblclick.stop="startRenameTab(rtab)"
              class="truncate flex-1 cursor-text"
              title="雙擊或右鍵重新命名此結果分頁"
            >
              {{ rtab.title }}
            </span>

            <!-- Status / Row Count Badge (if error or custom title without row count) -->
            <span
              v-if="editingTabId !== rtab.id && (rtab.result.messages.some((m) => m.level === 'error') || !rtab.title.includes('r'))"
              :class="[
                'text-xxs px-1 py-0.2 rounded font-mono flex-shrink-0 pointer-events-none',
                rtab.result.messages.some((m) => m.level === 'error')
                  ? 'bg-rose-900/90 text-rose-200 border border-rose-700/50'
                  : (queryStore.activeResultTabId === rtab.id ? 'bg-black/25 text-white/90' : 'bg-dark-700 text-dark-300')
              ]"
            >
              {{ rtab.result.messages.some((m) => m.level === 'error') ? 'Err' : `${rtab.rowCount}r` }}
            </span>

            <!-- Delete Tab Button (Disabled on the last remaining result tab) -->
            <button
              v-if="editingTabId !== rtab.id"
              type="button"
              @click.stop="queryStore.deleteResultTab(rtab.id)"
              :disabled="queryStore.resultTabs.length <= 1"
              :class="[
                'p-0.5 rounded transition-opacity flex-shrink-0',
                queryStore.resultTabs.length <= 1
                  ? 'opacity-20 cursor-not-allowed text-dark-600'
                  : (queryStore.activeResultTabId === rtab.id ? 'text-white/70 hover:text-white hover:bg-black/30' : 'text-dark-500 hover:text-dark-200 hover:bg-dark-700 opacity-0 group-hover:opacity-100 cursor-pointer')
              ]"
              :title="queryStore.resultTabs.length <= 1 ? '最後一個查詢結果不可刪除' : '關閉此結果'"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <!-- Result Tab Context Menu Backdrop -->
        <div
          v-if="tabContextMenu.visible"
          class="fixed inset-0 z-50"
          @click="closeTabContextMenu"
          @contextmenu.prevent="closeTabContextMenu"
        />

        <!-- Result Tab Context Menu Popup -->
        <div
          v-if="tabContextMenu.visible && tabContextMenu.tab"
          :style="{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }"
          class="fixed z-50 bg-dark-850 border border-dark-700 rounded-md shadow-2xl py-1 text-xs text-dark-200 select-none min-w-[160px] animate-in fade-in zoom-in-95 duration-100 font-sans"
        >
          <div class="px-3 py-1 text-xxs font-mono text-dark-400 border-b border-dark-750 truncate max-w-[180px]">
            {{ tabContextMenu.tab.title }}
          </div>
          <button
            type="button"
            @click="handleContextMenuRename"
            class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Edit2 class="w-3.5 h-3.5 text-dark-400" />
            <span>重新命名 (Rename)</span>
          </button>
          <button
            type="button"
            @click="handleContextMenuPin"
            class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 cursor-pointer transition-colors"
          >
            <Pin class="w-3.5 h-3.5" :class="tabContextMenu.tab.isPinned ? 'fill-current text-amber-400' : 'text-dark-400'" />
            <span>{{ tabContextMenu.tab.isPinned ? '解除釘選 (Unpin)' : '釘選此結果 (Pin)' }}</span>
          </button>
          <button
            type="button"
            @click="handleContextMenuClose"
            :disabled="queryStore.resultTabs.length <= 1"
            :class="[
              'w-full text-left px-3 py-1.5 flex items-center space-x-2 transition-colors',
              queryStore.resultTabs.length <= 1
                ? 'opacity-40 cursor-not-allowed text-dark-500'
                : 'hover:bg-dark-750 hover:text-dark-100 text-dark-300 cursor-pointer'
            ]"
          >
            <X class="w-3.5 h-3.5 text-dark-400" />
            <span>關閉此結果 (Close)</span>
          </button>
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

      <!-- Tab 4: Execution Stats & IO Analyzer -->
      <ExecutionStatsViewer
        v-else-if="workspaceStore.bottomPanelTab === 'stats'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick, onBeforeUnmount } from 'vue';
import { TableProperties, MessageSquare, History, Minimize2, Pin, X, Edit2, Gauge } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useQueryStore } from '@/stores/queryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import ResultGrid from '@/components/results/ResultGrid.vue';
import ResultMessages from '@/components/results/ResultMessages.vue';
import QueryHistory from '@/components/results/QueryHistory.vue';
import ExecutionStatsViewer from '@/components/results/ExecutionStatsViewer.vue';
import type { BottomPanelTab } from '@/types/workspace';
import type { QueryResultTab } from '@/types/query';

const workspaceStore = useWorkspaceStore();
const queryStore = useQueryStore();
const settingsStore = useSettingsStore();

const resultsTabsBarRef = ref<HTMLDivElement | null>(null);
const dragSourceIndex = ref<number | null>(null);
const dropHoverIndex = ref<number | null>(null);
const isPointerDragging = ref<boolean>(false);

let startPointerX = 0;
let hasMovedBeyondThreshold = false;

function onTabPointerDown(e: PointerEvent, index: number) {
  // Only respond to left mouse button
  if (e.button !== 0) return;

  // Don't initiate drag if clicking on buttons (Pin / Close) or input (Renaming)
  const target = e.target as HTMLElement | null;
  if (target?.closest('button') || target?.closest('input')) {
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

// ========================
// Inline Tab Renaming
// ========================
const editingTabId = ref<string | null>(null);
const editingTabTitle = ref<string>('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRenameTab(rtab: QueryResultTab) {
  editingTabId.value = rtab.id;
  editingTabTitle.value = rtab.title;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function saveRenameTab(tabId: string) {
  if (!editingTabId.value || editingTabId.value !== tabId) return;
  const trimmed = editingTabTitle.value.trim();
  if (trimmed) {
    queryStore.renameResultTab(tabId, trimmed);
  }
  editingTabId.value = null;
  editingTabTitle.value = '';
}

function cancelRenameTab() {
  editingTabId.value = null;
  editingTabTitle.value = '';
}

// ========================
// Tab Context Menu
// ========================
const tabContextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  tab: QueryResultTab | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  tab: null,
});

function openTabContextMenu(e: MouseEvent, tab: QueryResultTab) {
  tabContextMenu.visible = true;
  tabContextMenu.x = Math.min(e.clientX, window.innerWidth - 180);
  tabContextMenu.y = e.clientY;
  tabContextMenu.tab = tab;
}

function closeTabContextMenu() {
  tabContextMenu.visible = false;
  tabContextMenu.tab = null;
}

function handleContextMenuRename() {
  const tab = tabContextMenu.tab;
  closeTabContextMenu();
  if (tab) {
    startRenameTab(tab);
  }
}

function handleContextMenuPin() {
  const tab = tabContextMenu.tab;
  closeTabContextMenu();
  if (tab) {
    queryStore.togglePinTab(tab.id);
  }
}

function handleContextMenuClose() {
  const tab = tabContextMenu.tab;
  closeTabContextMenu();
  if (tab) {
    queryStore.deleteResultTab(tab.id);
  }
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
  {
    id: 'stats',
    label: 'Stats',
    icon: Gauge,
    badge: queryStore.activeExecutionStats?.tableStats.length,
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
