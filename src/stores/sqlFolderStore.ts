import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type { MonitoredFolder, SqlFileNode } from '@/types/sqlFolder';
import { sqlFolderService } from '@/services/sqlFolderService';
import { useWorkspaceStore } from './workspaceStore';

const STORAGE_KEY = 'sqlight_monitored_sql_folders';

function loadStoredFolders(): MonitoredFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (f): f is MonitoredFolder =>
            typeof f === 'object' && f !== null && typeof f.path === 'string' && typeof f.name === 'string'
        );
      }
    }
  } catch (err) {
    console.warn('[sqlFolderStore] Failed to load stored folders:', err);
  }
  return [];
}

function saveStoredFolders(folders: MonitoredFolder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[sqlFolderStore] Failed to save folders:', err);
  }
}

export const useSqlFolderStore = defineStore('sqlFolder', () => {
  const workspaceStore = useWorkspaceStore();

  const monitoredFolders = ref<MonitoredFolder[]>(loadStoredFolders());
  const folderTrees = reactive<Record<string, SqlFileNode>>({});
  const expandedNodes = reactive<Record<string, boolean>>({});
  const isLoading = ref(false);
  const refreshingPath = ref<string | null>(null);

  /**
   * Initializes store by scanning all registered monitored folders
   */
  async function init() {
    if (monitoredFolders.value.length === 0) return;
    await refreshAll();
  }

  /**
   * Scans a single folder and caches its tree in folderTrees
   */
  async function scanSingleFolder(folderPath: string): Promise<SqlFileNode | null> {
    try {
      const tree = await sqlFolderService.scanFolder(folderPath);
      folderTrees[folderPath] = tree;
      return tree;
    } catch (err: unknown) {
      console.error(`[sqlFolderStore] Failed to scan folder [${folderPath}]:`, err);
      return null;
    }
  }

  /**
   * Prompts user for a folder or takes a path directly, then registers and scans it
   */
  async function addFolder(targetPath?: string): Promise<boolean> {
    let folderPath = targetPath;
    if (!folderPath) {
      isLoading.value = true;
      try {
        const picked = await sqlFolderService.pickFolder();
        if (!picked) return false;
        folderPath = picked;
      } catch (err) {
        console.error('[sqlFolderStore] pickFolder error:', err);
        workspaceStore.showToast('選取資料夾失敗', 'error', 3000);
        return false;
      } finally {
        isLoading.value = false;
      }
    }

    // Check duplicate
    const normalized = folderPath.trim();
    if (monitoredFolders.value.some((f) => f.path === normalized)) {
      workspaceStore.showToast('該資料夾已在監控清單中', 'info', 2000);
      return false;
    }

    const name = normalized.split(/[/\\]/).filter(Boolean).pop() || normalized;
    const item: MonitoredFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      path: normalized,
      addedAt: new Date().toISOString(),
    };

    monitoredFolders.value.push(item);
    saveStoredFolders(monitoredFolders.value);

    // Scan
    isLoading.value = true;
    try {
      const tree = await scanSingleFolder(normalized);
      if (tree) {
        expandedNodes[normalized] = true;
      }
      workspaceStore.showToast(`已加入 SQL 監控資料夾：${name}`, 'success', 2500);
      return true;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Removes a folder from monitoring
   */
  function removeFolder(folderPath: string) {
    monitoredFolders.value = monitoredFolders.value.filter((f) => f.path !== folderPath);
    delete folderTrees[folderPath];
    delete expandedNodes[folderPath];
    saveStoredFolders(monitoredFolders.value);
    workspaceStore.showToast('已自監控清單移除資料夾', 'info', 2000);
  }

  /**
   * Refreshes all monitored folders
   */
  async function refreshAll() {
    isLoading.value = true;
    try {
      for (const folder of monitoredFolders.value) {
        await scanSingleFolder(folder.path);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Refreshes a single monitored folder
   */
  async function refreshFolder(folderPath: string) {
    refreshingPath.value = folderPath;
    try {
      await scanSingleFolder(folderPath);
      workspaceStore.showToast('已重新整理資料夾內容', 'success', 1500);
    } finally {
      refreshingPath.value = null;
    }
  }

  /**
   * Collapses all expanded folder nodes
   */
  function collapseAll() {
    Object.keys(expandedNodes).forEach((k) => {
      expandedNodes[k] = false;
    });
  }

  /**
   * Toggles node expansion
   */
  function toggleNode(nodePath: string) {
    expandedNodes[nodePath] = !expandedNodes[nodePath];
  }

  /**
   * Opens a .sql file in workspace editor
   */
  async function openFile(fileNode: SqlFileNode) {
    try {
      const content = await sqlFolderService.readFile(fileNode.path);
      workspaceStore.openSqlFileTab(fileNode.path, fileNode.name, content);
    } catch (err: unknown) {
      console.error(`[sqlFolderStore] Failed to read file [${fileNode.path}]:`, err);
      workspaceStore.showToast(`開啟檔案失敗: ${err instanceof Error ? err.message : String(err)}`, 'error', 3500);
    }
  }

  return {
    monitoredFolders,
    folderTrees,
    expandedNodes,
    isLoading,
    refreshingPath,
    init,
    addFolder,
    removeFolder,
    refreshAll,
    refreshFolder,
    collapseAll,
    toggleNode,
    openFile,
  };
});
