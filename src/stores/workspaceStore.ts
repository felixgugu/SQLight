import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { WorkspaceTab, BottomPanelTab, SqlEditorTab, TableDataTab } from '@/types/workspace';
import { format as formatSql } from 'sql-formatter';

export const useWorkspaceStore = defineStore('workspace', () => {
  const tabs = ref<WorkspaceTab[]>([
    {
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

  return {
    tabs,
    activeTabId,
    activeTab,
    bottomPanelTab,
    isBottomPanelOpen,
    setActiveTab,
    addSqlTab,
    addTableDataTab,
    closeTab,
    updateTabContent,
    formatActiveQuery,
    setBottomPanelTab,
    toggleBottomPanel,
  };
});
