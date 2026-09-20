import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type { MonitoredFolder, SqlFileNode } from '@/types/sqlFolder';
import { sqlFolderService } from '@/services/sqlFolderService';
import { useWorkspaceStore } from './workspaceStore';

const STORAGE_KEY = 'sqlight_monitored_sql_folders';
const EXCLUDED_STORAGE_KEY = 'sqlight_excluded_sql_paths';

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

function loadStoredExcludedPaths(): string[] {
  try {
    const raw = localStorage.getItem(EXCLUDED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string');
      }
    }
  } catch (err) {
    console.warn('[sqlFolderStore] Failed to load excluded paths:', err);
  }
  return [];
}

function saveStoredExcludedPaths(paths: string[]) {
  try {
    localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify(paths));
  } catch (err) {
    console.warn('[sqlFolderStore] Failed to save excluded paths:', err);
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function filterExcluded(node: SqlFileNode, excludedSet: Set<string>): SqlFileNode | null {
  if (excludedSet.has(normalizePath(node.path))) {
    return null;
  }
  if (node.is_dir && node.children) {
    const filteredChildren = node.children
      .map((child) => filterExcluded(child, excludedSet))
      .filter((child): child is SqlFileNode => child !== null);
    return {
      ...node,
      children: filteredChildren,
    };
  }
  return node;
}

export const useSqlFolderStore = defineStore('sqlFolder', () => {
  const workspaceStore = useWorkspaceStore();

  const monitoredFolders = ref<MonitoredFolder[]>(loadStoredFolders());
  const excludedPaths = ref<string[]>(loadStoredExcludedPaths());
  const rawTrees = reactive<Record<string, SqlFileNode>>({});
  const folderTrees = reactive<Record<string, SqlFileNode>>({});
  const expandedNodes = reactive<Record<string, boolean>>({});
  const isLoading = ref(false);
  const refreshingPath = ref<string | null>(null);

  /**
   * Applies exclusion filter to raw scan trees
   */
  function applyExclusionFilter(folderPath?: string) {
    const excludedSet = new Set(excludedPaths.value.map(normalizePath));
    const targetPaths = folderPath ? [folderPath] : Object.keys(rawTrees);
    for (const p of targetPaths) {
      const raw = rawTrees[p];
      if (raw) {
        const filtered = filterExcluded(raw, excludedSet);
        if (filtered) {
          folderTrees[p] = filtered;
        } else {
          delete folderTrees[p];
        }
      }
    }
  }

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
      rawTrees[folderPath] = tree;
      applyExclusionFilter(folderPath);
      return folderTrees[folderPath] ?? null;
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
    if (monitoredFolders.value.some((f) => normalizePath(f.path) === normalizePath(normalized))) {
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
    monitoredFolders.value = monitoredFolders.value.filter(
      (f) => normalizePath(f.path) !== normalizePath(folderPath)
    );
    delete rawTrees[folderPath];
    delete folderTrees[folderPath];
    delete expandedNodes[folderPath];
    saveStoredFolders(monitoredFolders.value);
    workspaceStore.showToast('已取消監控資料夾（檔案仍保留於磁碟）', 'info', 2000);
  }

  /**
   * Unmonitors an individual file or subfolder or root folder without deleting physically
   */
  function unmonitorItem(nodePath: string, nodeName: string, isRoot = false) {
    const isActuallyRoot =
      isRoot || monitoredFolders.value.some((f) => normalizePath(f.path) === normalizePath(nodePath));

    if (isActuallyRoot) {
      removeFolder(nodePath);
    } else {
      if (!excludedPaths.value.some((p) => normalizePath(p) === normalizePath(nodePath))) {
        excludedPaths.value.push(nodePath);
        saveStoredExcludedPaths(excludedPaths.value);
        applyExclusionFilter();
      }
      workspaceStore.showToast(`已取消監控「${nodeName}」（本機檔案未刪除）`, 'info', 2500);
    }
  }

  /**
   * Restores all unmonitored files and folders
   */
  function restoreExcludedPaths() {
    excludedPaths.value = [];
    saveStoredExcludedPaths([]);
    applyExclusionFilter();
    workspaceStore.showToast('已重設取消監控清單，所有檔案已恢復顯示', 'success', 2000);
  }

  /**
   * Renames a file or folder on disk, syncing any open tab labels in workspaceStore
   */
  async function renameItem(oldPath: string, newName: string, isDir: boolean): Promise<boolean> {
    const lastSlash = Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\'));
    const parentDir = lastSlash >= 0 ? oldPath.substring(0, lastSlash) : '';
    const separator = oldPath.includes('\\') ? '\\' : '/';
    const finalName = !isDir && !newName.toLowerCase().endsWith('.sql') ? `${newName}.sql` : newName;
    const newPath = parentDir ? `${parentDir}${separator}${finalName}` : finalName;

    if (/[\\/:*?"<>|]/.test(newName)) {
      workspaceStore.showToast('名稱不可包含特殊字元: \\ / : * ? " < > |', 'error', 3000);
      return false;
    }

    if (oldPath === newPath) {
      return true;
    }

    try {
      await sqlFolderService.renamePath(oldPath, newPath);

      if (isDir) {
        workspaceStore.syncRenamedFolder(oldPath, newPath);

        const rootFolder = monitoredFolders.value.find(
          (f) => normalizePath(f.path) === normalizePath(oldPath)
        );
        if (rootFolder) {
          rootFolder.path = newPath;
          rootFolder.name = finalName;
          saveStoredFolders(monitoredFolders.value);

          if (expandedNodes[oldPath]) {
            expandedNodes[newPath] = true;
            delete expandedNodes[oldPath];
          }
          delete rawTrees[oldPath];
          delete folderTrees[oldPath];
          await scanSingleFolder(newPath);
        } else {
          await refreshAll();
        }
      } else {
        workspaceStore.syncRenamedFile(oldPath, newPath, finalName);
        await refreshAll();
      }

      workspaceStore.showToast(`已成功重新命名為「${finalName}」`, 'success', 2500);
      return true;
    } catch (err: unknown) {
      console.error(`[sqlFolderStore] Failed to rename [${oldPath} -> ${newPath}]:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      workspaceStore.showToast(`重新命名失敗: ${msg}`, 'error', 4000);
      return false;
    }
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
    excludedPaths,
    folderTrees,
    expandedNodes,
    isLoading,
    refreshingPath,
    init,
    addFolder,
    removeFolder,
    unmonitorItem,
    restoreExcludedPaths,
    renameItem,
    refreshAll,
    refreshFolder,
    collapseAll,
    toggleNode,
    openFile,
  };
});
