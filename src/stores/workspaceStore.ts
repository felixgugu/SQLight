import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorkspaceTab, BottomPanelTab, SqlEditorTab } from '@/types/workspace';

export const useWorkspaceStore = defineStore('workspace', () => {
  const tabs = ref<WorkspaceTab[]>([
    {
      id: 'tab-initial-sql-1',
      type: 'sql_editor',
      title: 'Query 1.sql',
      query: '-- Welcome to SQLight!\n-- Press Ctrl+Enter to execute queries.\n\nSELECT @@VERSION AS [SQL Server Version];\n',
      isDirty: false,
    } as SqlEditorTab,
  ]);

  const activeTabId = ref<string>('tab-initial-sql-1');
  const bottomPanelTab = ref<BottomPanelTab>('results');
  const isBottomPanelOpen = ref<boolean>(true);

  const activeTab = computed(() => {
    return tabs.value.find((t) => t.id === activeTabId.value) ?? tabs.value[0] ?? null;
  });

  function setActiveTab(id: string) {
    activeTabId.value = id;
  }

  function addSqlTab(initialQuery = '', title?: string) {
    const nextNum = tabs.value.filter((t) => t.type === 'sql_editor').length + 1;
    const tabId = `tab-sql-${Date.now()}`;
    const newTab: SqlEditorTab = {
      id: tabId,
      type: 'sql_editor',
      title: title ?? `Query ${nextNum}.sql`,
      query: initialQuery,
      isDirty: false,
    };
    tabs.value.push(newTab);
    activeTabId.value = tabId;
  }

  function closeTab(tabId: string) {
    const index = tabs.value.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    tabs.value.splice(index, 1);

    // If active tab was closed, select adjacent tab
    if (activeTabId.value === tabId) {
      if (tabs.value.length > 0) {
        const nextIndex = Math.min(index, tabs.value.length - 1);
        const nextTab = tabs.value[nextIndex];
        if (nextTab) {
          activeTabId.value = nextTab.id;
        }
      } else {
        // If no tabs remain, auto-open a fresh query tab
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

  function setBottomPanelTab(tab: BottomPanelTab) {
    bottomPanelTab.value = tab;
    isBottomPanelOpen.value = true;
  }

  function toggleBottomPanel() {
    isBottomPanelOpen.value = !isBottomPanelOpen.value;
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    bottomPanelTab,
    isBottomPanelOpen,
    setActiveTab,
    addSqlTab,
    closeTab,
    updateTabContent,
    setBottomPanelTab,
    toggleBottomPanel,
  };
});
