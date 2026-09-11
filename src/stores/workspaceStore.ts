import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { WorkspaceTab, BottomPanelTab, SqlEditorTab, TableDataTab } from '@/types/workspace';
import { format as formatSql } from 'sql-formatter';

const STORAGE_TABS_KEY = 'sqlight_workspace_tabs';
const STORAGE_ACTIVE_TAB_KEY = 'sqlight_active_tab_id';
const STORAGE_SIDEBAR_KEY = 'sqlight_sidebar_open';

function loadSavedSidebarState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_SIDEBAR_KEY);
    if (raw !== null) {
      return raw === 'true';
    }
  } catch (e) {
    console.warn('Failed to load sidebar open state:', e);
  }
  return true;
}

function saveSidebarStateToStorage(isOpen: boolean) {
  try {
    localStorage.setItem(STORAGE_SIDEBAR_KEY, String(isOpen));
  } catch (e) {
    console.warn('Failed to save sidebar state to storage:', e);
  }
}

const DEFAULT_INITIAL_TAB: SqlEditorTab = {
  id: 'tab-initial-sql-1',
  type: 'sql_editor',
  title: 'Query 1.sql',
  query: `-- Welcome to SQLight!
-- Press Ctrl+Enter to execute selected query or entire editor.
-- Press Shift+Alt+F to format SQL.

SELECT 
    name AS DatabaseName,
    database_id,
    create_date
FROM sys.databases
ORDER BY name;
`,
  isDirty: false,
};

function loadSavedTabs(): WorkspaceTab[] {
  try {
    const raw = localStorage.getItem(STORAGE_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validTabs: WorkspaceTab[] = parsed.filter(
          (t: unknown): t is WorkspaceTab =>
            typeof t === 'object' &&
            t !== null &&
            'id' in t &&
            typeof (t as { id: unknown }).id === 'string' &&
            'type' in t &&
            ((t as { type: unknown }).type === 'sql_editor' || (t as { type: unknown }).type === 'table_data')
        );
        if (validTabs.length > 0) {
          return validTabs;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved workspace tabs:', e);
  }
  return [{ ...DEFAULT_INITIAL_TAB }];
}

function loadSavedActiveTabId(availableTabs: WorkspaceTab[]): string {
  try {
    const savedId = localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
    if (savedId && availableTabs.some((t) => t.id === savedId)) {
      return savedId;
    }
  } catch (e) {
    console.warn('Failed to load active tab id:', e);
  }
  return availableTabs[0]?.id ?? DEFAULT_INITIAL_TAB.id;
}

function saveTabsToStorage(tabList: WorkspaceTab[]) {
  try {
    localStorage.setItem(STORAGE_TABS_KEY, JSON.stringify(tabList));
  } catch (e) {
    console.warn('Failed to save workspace tabs to storage:', e);
  }
}

function saveActiveTabIdToStorage(id: string) {
  try {
    localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, id);
  } catch (e) {
    console.warn('Failed to save active tab id to storage:', e);
  }
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const initialTabs = loadSavedTabs();
  const tabs = ref<WorkspaceTab[]>(initialTabs);
  const activeTabId = ref<string>(loadSavedActiveTabId(initialTabs));
  const bottomPanelTab = ref<BottomPanelTab>('results');
  const isBottomPanelOpen = ref<boolean>(true);
  const isSidebarOpen = ref<boolean>(loadSavedSidebarState());
  const pendingColumnToInsert = ref<string | null>(null);
  const activeToast = ref<ToastMessage | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Watchers to auto-persist changes
  watch(
    tabs,
    (newTabs) => {
      saveTabsToStorage(newTabs);
    },
    { deep: true }
  );

  watch(activeTabId, (newId) => {
    saveActiveTabIdToStorage(newId);
  });

  watch(isSidebarOpen, (isOpen) => {
    saveSidebarStateToStorage(isOpen);
  });

  const activeTab = computed(() => {
    return tabs.value.find((t) => t.id === activeTabId.value) ?? tabs.value[0] ?? null;
  });

  function setActiveTab(id: string) {
    activeTabId.value = id;
  }

  function addSqlTab(initialQuery = '', title?: string) {
    const existingNums = tabs.value
      .filter((t) => t.type === 'sql_editor')
      .map((t) => {
        const match = t.title.match(/^Query\s*(\d+)/i);
        return match ? parseInt(match[1] || '0', 10) : 0;
      });
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const tabId = `tab-sql-${Date.now()}`;
    const newTab: SqlEditorTab = {
      id: tabId,
      type: 'sql_editor',
      title: title ?? `Query ${nextNum}.sql`,
      query: initialQuery || `SELECT TOP 100 * FROM sys.tables;`,
      isDirty: false,
    };
    tabs.value.push(newTab);
    activeTabId.value = tabId;
  }

  function addTableDataTab(schema: string, tableName: string) {
    const existing = tabs.value.find(
      (t) => t.type === 'table_data' && (t as TableDataTab).schema === schema && (t as TableDataTab).tableName === tableName
    );
    if (existing) {
      activeTabId.value = existing.id;
      return;
    }

    const tabId = `tab-data-${Date.now()}`;
    const newTab: TableDataTab = {
      id: tabId,
      type: 'table_data',
      title: `${schema}.${tableName} (Data)`,
      schema,
      tableName,
      isDirty: false,
    };
    tabs.value.push(newTab);
    activeTabId.value = tabId;
  }

  function closeTab(tabId: string) {
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    tabs.value.splice(index, 1);

    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const nextIndex = Math.min(index, tabs.value.length - 1);
        const nextTab = tabs.value[nextIndex];
        if (nextTab) {
          activeTabId.value = nextTab.id;
        }
      } else {
        addSqlTab();
      }
    }
  }

  function updateTabContent(tabId: string, query: string) {
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab && tab.type === 'sql_editor') {
      tab.query = query;
      tab.isDirty = true;
    }
  }

  function formatActiveQuery(): void {
    const current = activeTab.value;
    if (current && current.type === 'sql_editor') {
      try {
        const formatted = formatSql(current.query, {
          language: 'tsql',
          keywordCase: 'upper',
          tabWidth: 2,
        });
        current.query = formatted;
        current.isDirty = true;
      } catch (err) {
        console.warn('Failed to format SQL:', err);
      }
    }
  }

  function setBottomPanelTab(tab: BottomPanelTab) {
    bottomPanelTab.value = tab;
    isBottomPanelOpen.value = true;
  }

  function toggleBottomPanel() {
    isBottomPanelOpen.value = !isBottomPanelOpen.value;
  }

  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value;
  }

  function setSidebarOpen(open: boolean) {
    isSidebarOpen.value = open;
  }

  function reorderTabs(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= tabs.value.length) return;
    if (toIndex < 0 || toIndex >= tabs.value.length) return;

    const moved = tabs.value[fromIndex];
    if (!moved) return;
    tabs.value.splice(fromIndex, 1);
    tabs.value.splice(toIndex, 0, moved);
  }

  function renameTab(tabId: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const tab = tabs.value.find((t) => t.id === tabId);
    if (tab) {
      tab.title = trimmed;
    }
  }

  function closeOtherTabs(tabId: string) {
    tabs.value = tabs.value.filter((t) => t.id === tabId);
    activeTabId.value = tabId;
  }

  function setPendingColumnToInsert(colName: string) {
    pendingColumnToInsert.value = colName;
  }

  function consumePendingColumnToInsert(): string | null {
    const val = pendingColumnToInsert.value;
    pendingColumnToInsert.value = null;
    return val;
  }

  function clearPendingColumnToInsert() {
    pendingColumnToInsert.value = null;
  }

  function showToast(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration = 2500
  ) {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    activeToast.value = {
      id: String(Date.now()),
      message,
      type,
    };
    toastTimer = setTimeout(() => {
      activeToast.value = null;
      toastTimer = null;
    }, duration);
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    bottomPanelTab,
    isBottomPanelOpen,
    isSidebarOpen,
    pendingColumnToInsert,
    activeToast,
    setActiveTab,
    addSqlTab,
    addTableDataTab,
    closeTab,
    closeOtherTabs,
    reorderTabs,
    renameTab,
    updateTabContent,
    formatActiveQuery,
    setBottomPanelTab,
    toggleBottomPanel,
    toggleSidebar,
    setSidebarOpen,
    setPendingColumnToInsert,
    consumePendingColumnToInsert,
    clearPendingColumnToInsert,
    showToast,
  };
});
