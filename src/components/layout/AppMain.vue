<template>
  <main class="h-full flex flex-col bg-dark-900 overflow-hidden">
    <!-- Workspace Tab Bar -->
    <div
      ref="queryTabsBarRef"
      @wheel="handleTabsWheel"
      class="h-9 bg-dark-850 border-b border-dark-700 flex items-center px-1 space-x-1 overflow-x-auto select-none flex-shrink-0"
    >
      <!-- Tabs List -->
      <div
        v-for="(tab, idx) in workspaceStore.tabs"
        :key="tab.id"
        @pointerdown="onTabPointerDown($event, idx)"
        @click="handleTabClick(tab.id)"
        @contextmenu.prevent="openTabContextMenu($event, tab)"
        :class="[
          'query-tab-item h-7 px-2.5 flex items-center space-x-2 text-xs rounded-t border-t border-x cursor-grab active:cursor-grabbing transition-all duration-100 group max-w-[220px] select-none touch-none',
          workspaceStore.activeTabId === tab.id
            ? 'bg-dark-900 text-dark-100 border-dark-700 border-b-dark-900 font-medium shadow-xs'
            : 'bg-dark-800/80 text-dark-400 hover:text-dark-200 border-transparent hover:bg-dark-800',
          isPointerDragging && dragSourceIndex === idx ? 'opacity-35 border-dashed border-brand-400 scale-95' : '',
          dropHoverIndex === idx && isPointerDragging && dropHoverIndex !== dragSourceIndex ? 'border-brand-400 bg-brand-500/25 ring-1 ring-brand-400 scale-102' : ''
        ]"
      >
        <FileCode v-if="tab.type === 'sql_editor'" class="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        <Table2 v-else class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />

        <!-- Title Display OR Inline Rename Input -->
        <input
          v-if="editingTabId === tab.id"
          ref="renameInputRef"
          v-model="editingTabTitle"
          @click.stop
          @pointerdown.stop
          @keydown.enter.stop="saveRenameTab(tab.id)"
          @keydown.esc.stop="cancelRenameTab"
          @blur="saveRenameTab(tab.id)"
          class="bg-dark-800 border border-brand-500 text-dark-100 rounded px-1.5 py-0.5 text-xs font-sans focus:outline-none w-28 flex-1 min-w-0"
        />
        <span
          v-else
          @dblclick.stop="startRenameTab(tab)"
          class="truncate flex-1"
          title="雙擊或右鍵重新命名此分頁"
        >
          {{ tab.title }}
        </span>

        <!-- Dirty Indicator -->
        <span
          v-if="tab.isDirty && editingTabId !== tab.id"
          class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
          title="Unsaved changes"
        />

        <!-- Close Tab Button -->
        <button
          v-if="editingTabId !== tab.id"
          type="button"
          @click.stop="workspaceStore.closeTab(tab.id)"
          class="p-0.5 rounded-full hover:bg-dark-700 text-dark-500 hover:text-dark-200 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-pointer"
          title="關閉分頁 (Close tab)"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Add New Query Tab Button -->
      <button
        type="button"
        @click="workspaceStore.addSqlTab()"
        class="p-1 text-dark-500 hover:text-dark-200 hover:bg-dark-750 rounded transition-colors cursor-pointer"
        title="新增查詢分頁 (Add new SQL tab)"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Query Tab Context Menu Backdrop -->
    <div
      v-if="tabContextMenu.visible"
      class="fixed inset-0 z-50"
      @click="closeTabContextMenu"
      @contextmenu.prevent="closeTabContextMenu"
    />

    <!-- Query Tab Context Menu Popup -->
    <div
      v-if="tabContextMenu.visible && tabContextMenu.tab"
      :style="{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }"
      class="fixed z-50 bg-dark-850 border border-dark-700 rounded-md shadow-2xl py-1 text-xs text-dark-200 select-none min-w-[170px] animate-in fade-in zoom-in-95 duration-100 font-sans"
    >
      <div class="px-3 py-1 text-xxs font-mono text-dark-400 border-b border-dark-750 truncate max-w-[190px]">
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
        @click="handleContextMenuClose"
        class="w-full text-left px-3 py-1.5 hover:bg-dark-750 hover:text-dark-100 flex items-center space-x-2 cursor-pointer transition-colors"
      >
        <X class="w-3.5 h-3.5 text-dark-400" />
        <span>關閉此分頁 (Close)</span>
      </button>
      <button
        type="button"
        @click="handleContextMenuCloseOthers"
        :disabled="workspaceStore.tabs.length <= 1"
        :class="[
          'w-full text-left px-3 py-1.5 flex items-center space-x-2 transition-colors',
          workspaceStore.tabs.length <= 1
            ? 'opacity-40 cursor-not-allowed text-dark-500'
            : 'hover:bg-dark-750 hover:text-dark-100 text-dark-300 cursor-pointer'
        ]"
      >
        <Layers class="w-3.5 h-3.5 text-dark-400" />
        <span>關閉其他分頁 (Close Others)</span>
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
            @format="formatCode"
          />
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
import { ref, reactive, nextTick, onBeforeUnmount } from 'vue';
import { FileCode, Table2, Plus, X, Edit2, Layers } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import MonacoEditor from '@/components/editor/MonacoEditor.vue';
import TableDataViewer from '@/components/editor/TableDataViewer.vue';
import type { SqlEditorTab, TableDataTab, WorkspaceTab } from '@/types/workspace';

const workspaceStore = useWorkspaceStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null);

// ========================
// Tab Reorder (Pointer Events)
// ========================
const queryTabsBarRef = ref<HTMLDivElement | null>(null);
const dragSourceIndex = ref<number | null>(null);
const dropHoverIndex = ref<number | null>(null);
const isPointerDragging = ref<boolean>(false);

let startPointerX = 0;
let hasMovedBeyondThreshold = false;

function onTabPointerDown(e: PointerEvent, index: number) {
  if (e.button !== 0) return;

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

  if (!queryTabsBarRef.value) return;
  const tabElements = queryTabsBarRef.value.querySelectorAll('.query-tab-item');
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
    workspaceStore.reorderTabs(dragSourceIndex.value, dropHoverIndex.value);
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
  workspaceStore.setActiveTab(tabId);
}

// ========================
// Inline Tab Renaming
// ========================
const editingTabId = ref<string | null>(null);
const editingTabTitle = ref<string>('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRenameTab(tab: WorkspaceTab) {
  editingTabId.value = tab.id;
  editingTabTitle.value = tab.title;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function saveRenameTab(tabId: string) {
  if (!editingTabId.value || editingTabId.value !== tabId) return;
  const trimmed = editingTabTitle.value.trim();
  if (trimmed) {
    workspaceStore.renameTab(tabId, trimmed);
  }
  editingTabId.value = null;
  editingTabTitle.value = '';
}

function cancelRenameTab() {
  editingTabId.value = null;
  editingTabTitle.value = '';
}

// ========================
// Context Menu
// ========================
const tabContextMenu = reactive<{
  visible: boolean;
  x: number;
  y: number;
  tab: WorkspaceTab | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  tab: null,
});

function openTabContextMenu(e: MouseEvent, tab: WorkspaceTab) {
  tabContextMenu.visible = true;
  tabContextMenu.x = Math.min(e.clientX, window.innerWidth - 190);
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

function handleContextMenuClose() {
  const tab = tabContextMenu.tab;
  closeTabContextMenu();
  if (tab) {
    workspaceStore.closeTab(tab.id);
  }
}

function handleContextMenuCloseOthers() {
  const tab = tabContextMenu.tab;
  closeTabContextMenu();
  if (tab) {
    workspaceStore.closeOtherTabs(tab.id);
  }
}

// ========================
// Wheel & Query Execution
// ========================
function handleTabsWheel(e: WheelEvent) {
  const container = e.currentTarget as HTMLElement;
  if (!container) return;
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    container.scrollLeft += e.deltaY;
  }
}

function formatCode() {
  if (monacoRef.value) {
    monacoRef.value.formatCode();
  } else if (workspaceStore.activeTab?.type === 'sql_editor') {
    workspaceStore.formatActiveQuery();
  }
}

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

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onDocumentPointerMove);
  window.removeEventListener('pointerup', onDocumentPointerUp);
  window.removeEventListener('pointercancel', onDocumentPointerUp);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

defineExpose({
  runQuery,
  formatCode,
});
</script>
