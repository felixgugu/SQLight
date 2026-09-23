<template>
  <div class="h-full bg-dark-850 flex flex-col overflow-hidden select-none border-t border-dark-700">
    <!-- Bottom Panel Header Tabs -->
    <div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0">
      <!-- Tabs Switcher -->
      <div class="flex items-center space-x-1">
        <Button
          v-for="tab in panelTabs"
          :key="tab.id"
          :severity="workspaceStore.bottomPanelTab === tab.id ? 'primary' : 'secondary'"
          :text="workspaceStore.bottomPanelTab !== tab.id"
          size="small"
          class="!h-6 !px-2 !py-0 !text-xs"
          :class="workspaceStore.bottomPanelTab === tab.id ? '!font-medium' : '!font-normal'"
          @click="workspaceStore.setBottomPanelTab(tab.id)"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          <span>{{ tab.label }}</span>
          <Badge
            v-if="tab.badge !== undefined && tab.badge > 0"
            :value="String(tab.badge)"
            :severity="tab.id === 'messages' && hasErrorMessages ? 'danger' : 'secondary'"
            class="!text-[10px] !px-1 !py-0 !min-w-4 !h-4"
          />
        </Button>
      </div>

      <!-- Right Summary & Panel Controls -->
      <div class="flex items-center space-x-3 text-xxs font-mono text-dark-400">
        <span v-if="queryStore.activeResultTab">
          Duration: <strong class="text-accent">{{ queryStore.activeResultTab.durationMs }}ms</strong>
        </span>
        <span v-if="queryStore.activeResultTab">
          Rows: <strong class="text-ok">{{ queryStore.activeResultTab.rowCount }}</strong>
          <span
            v-if="queryStore.activeResultTab.result.resultSets.length > 1"
            class="text-dark-400 font-normal ml-1"
          >
            ({{ queryStore.activeResultTab.result.resultSets.map(r => r.rowCount ?? r.rows?.length ?? 0).join(' + ') }})
          </span>
        </span>
        <span v-else-if="queryStore.activeResult">
          Duration: <strong class="text-accent">{{ queryStore.activeResult.executionTimeMs }}ms</strong>
        </span>
        <span v-if="!queryStore.activeResultTab && queryStore.activeResult">
          Affected: <strong class="text-ok">{{ queryStore.activeResult.affectedRows }}</strong>
        </span>

        <Button
          icon="pi pi-minus"
          severity="secondary"
          size="small"
          text
          rounded
          class="!h-6 !w-6 !p-0"
          v-tooltip.bottom="'縮小面板 (Minimize)'"
          @click="workspaceStore.toggleBottomPanel()"
        />
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
          class="h-9 bg-dark-850 border-b border-dark-750 flex items-end px-1.5 space-x-1.5 overflow-x-auto overflow-y-hidden select-none flex-shrink-0"
        >
          <div
            v-for="(rtab, idx) in queryStore.resultTabs"
            :key="rtab.id"
            @pointerdown="onTabPointerDown($event, idx)"
            @click="handleTabClick(rtab.id)"
            @contextmenu.prevent="openTabContextMenu($event, rtab)"
            :class="[
              'result-tab-item h-7 px-2 flex items-center space-x-1.5 text-xxs rounded-t cursor-grab active:cursor-grabbing transition-all duration-100 group max-w-[220px] border flex-shrink-0 select-none touch-none',
              queryStore.activeResultTabId === rtab.id
                ? 'font-medium shadow-xs border-dark-600'
                : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-dark-700 hover:border-dark-600 hover:bg-dark-800',
              isPointerDragging && dragSourceIndex === idx ? 'opacity-35 border-dashed border-brand-400 scale-95' : '',
              dropHoverIndex === idx && isPointerDragging && dropHoverIndex !== dragSourceIndex ? 'border-brand-400 bg-brand-500/25 ring-1 ring-brand-400 scale-102' : ''
            ]"
            :style="getResultTabStyle(rtab)"
            :title="`${rtab.title}\n執行時間: ${rtab.executedAt} (${rtab.durationMs}ms)\n筆數: ${rtab.rowCount} rows\n\nSQL 語句:\n${rtab.sql}`"
          >
            <!-- Pin / Unpin Button -->
            <button
              type="button"
              @click.stop="queryStore.togglePinTab(rtab.id)"
              :class="[
                'p-0.5 rounded transition-colors cursor-pointer',
                rtab.isPinned
                  ? 'text-warn'
                  : (queryStore.activeResultTabId === rtab.id ? 'text-dark-400 hover:text-dark-100' : 'text-dark-500 hover:text-dark-300 opacity-60 group-hover:opacity-100')
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
                  ? 'bg-rose-100 dark:bg-rose-900/90 text-danger border border-rose-200 dark:border-rose-700/50'
                  : (queryStore.activeResultTabId === rtab.id ? 'bg-dark-750 text-dark-200' : 'bg-dark-700 text-dark-300')
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
                  : (queryStore.activeResultTabId === rtab.id ? 'text-dark-400 hover:text-danger hover:bg-rose-500/15' : 'text-dark-400 hover:text-danger hover:bg-rose-500/15 opacity-0 group-hover:opacity-100 cursor-pointer')
              ]"
              :title="queryStore.resultTabs.length <= 1 ? '最後一個查詢結果不可刪除' : '關閉此結果'"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <!-- PrimeVue Result Tab Context Menu -->
        <ContextMenu ref="tabContextMenuRef" :model="tabContextMenuItems" />

        <!-- Result Grid Viewer Area -->
        <div class="flex-1 min-h-0 overflow-hidden">
          <ResultGrid
            :result-sets="queryStore.activeResult?.resultSets ?? []"
            :tab-id="queryStore.activeResultTabId"
          />
        </div>
      </div>

      <!-- Tab 2: Messages -->
      <ResultMessages
        v-else-if="workspaceStore.bottomPanelTab === 'messages'"
        :messages="queryStore.sessionMessages"
        @clear="queryStore.clearMessages()"
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
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import ContextMenu from 'primevue/contextmenu';
import { TableProperties, MessageSquare, History, Pin, X, Gauge } from 'lucide-vue-next';
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
const tabContextMenuRef = ref();
const tabContextMenu = reactive<{
  tab: QueryResultTab | null;
}>({
  tab: null,
});

const tabContextMenuItems = computed(() => {
  const tab = tabContextMenu.tab;
  if (!tab) return [];
  return [
    {
      label: tab.title,
      disabled: true,
      class: 'font-mono !text-xs !text-dark-300',
    },
    { separator: true },
    {
      label: '重新命名 (Rename)',
      icon: 'pi pi-pencil',
      command: handleContextMenuRename,
    },
    {
      label: tab.isPinned ? '解除釘選 (Unpin)' : '釘選此結果 (Pin)',
      icon: tab.isPinned ? 'pi pi-bookmark-fill' : 'pi pi-bookmark',
      command: handleContextMenuPin,
    },
    {
      label: '關閉此結果 (Close)',
      icon: 'pi pi-times',
      disabled: queryStore.resultTabs.length <= 1,
      command: handleContextMenuClose,
    },
  ];
});

function openTabContextMenu(e: MouseEvent, tab: QueryResultTab) {
  tabContextMenu.tab = tab;
  tabContextMenuRef.value?.show(e);
}

function handleContextMenuRename() {
  const tab = tabContextMenu.tab;
  if (tab) {
    startRenameTab(tab);
  }
}

function handleContextMenuPin() {
  const tab = tabContextMenu.tab;
  if (tab) {
    queryStore.togglePinTab(tab.id);
  }
}

function handleContextMenuClose() {
  const tab = tabContextMenu.tab;
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
  return queryStore.sessionMessages.some((m) => m.level === 'error');
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
    badge: queryStore.sessionMessages.length,
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

function getResultTabStyle(rtab: QueryResultTab) {
  const isActive = queryStore.activeResultTabId === rtab.id;
  if (!isActive) return {};

  const isCustomBg = Boolean(settingsStore.activeSqlTabBgColor && settingsStore.activeSqlTabBgColor !== '#1e40af');
  const isCustomText = Boolean(settingsStore.activeSqlTabTextColor && settingsStore.activeSqlTabTextColor !== '#ffffff');

  if (isCustomBg || isCustomText) {
    return {
      backgroundColor: settingsStore.activeSqlTabBgColor,
      color: settingsStore.activeSqlTabTextColor,
      borderColor: settingsStore.activeSqlTabBgColor,
      borderTopColor: settingsStore.activeSqlTabBgColor,
    };
  }

  const isLight = settingsStore.colorMode === 'light';
  return {
    backgroundColor: isLight ? '#ffffff' : 'rgb(var(--color-dark-900))',
    color: isLight ? '#0f172a' : 'rgb(var(--color-dark-100))',
    borderColor: 'rgb(var(--color-dark-700))',
    borderTopColor: 'var(--p-primary-color, #3b82f6)',
    borderTopWidth: '1px',
  };
}
</script>
