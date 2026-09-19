import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useSqlFolderStore } from '../src/stores/sqlFolderStore';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import { sqlFolderService } from '../src/services/sqlFolderService';
import type { SqlEditorTab } from '../src/types/workspace';

const storageMap = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => storageMap.get(key) ?? null,
  setItem: (key, value) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key) => {
    storageMap.delete(key);
  },
  clear: () => storageMap.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storageMap.clear();
  setActivePinia(createPinia());
});

test('sqlFolderStore: adds and persists monitored folder', async () => {
  const store = useSqlFolderStore();
  assert.equal(store.monitoredFolders.length, 0);

  const added = await store.addFolder('C:/MyProjects/SQL_Scripts');
  assert.equal(added, true);
  assert.equal(store.monitoredFolders.length, 1);
  assert.equal(store.monitoredFolders[0]?.name, 'SQL_Scripts');
  assert.equal(store.monitoredFolders[0]?.path, 'C:/MyProjects/SQL_Scripts');

  // Verify stored in localStorage
  const raw = storageMap.get('sqlight_monitored_sql_folders');
  assert.ok(raw);
  assert.ok(raw.includes('SQL_Scripts'));

  // Duplicate path should not be added again
  const duplicateAdded = await store.addFolder('C:/MyProjects/SQL_Scripts');
  assert.equal(duplicateAdded, false);
  assert.equal(store.monitoredFolders.length, 1);
});

test('sqlFolderStore: removes folder from monitoring and clears cache', async () => {
  const store = useSqlFolderStore();
  await store.addFolder('C:/MyProjects/SQL_Scripts');
  assert.equal(store.monitoredFolders.length, 1);

  store.removeFolder('C:/MyProjects/SQL_Scripts');
  assert.equal(store.monitoredFolders.length, 0);
  assert.equal(store.folderTrees['C:/MyProjects/SQL_Scripts'], undefined);

  const raw = storageMap.get('sqlight_monitored_sql_folders');
  assert.equal(raw, '[]');
});

test('sqlFolderStore: collapses all expanded nodes', async () => {
  const store = useSqlFolderStore();
  store.expandedNodes['path/a'] = true;
  store.expandedNodes['path/b'] = true;

  store.collapseAll();
  assert.equal(store.expandedNodes['path/a'], false);
  assert.equal(store.expandedNodes['path/b'], false);
});

test('sqlFolderStore: openFile opens SQL in workspace editor and sets filePath', async () => {
  const folderStore = useSqlFolderStore();
  const workspaceStore = useWorkspaceStore();

  const fileNode = {
    name: '01_Init_Tables.sql',
    path: 'C:/MyScripts/SQL/01_Init_Tables.sql',
    is_dir: false,
  };

  await folderStore.openFile(fileNode);

  assert.ok(workspaceStore.activeTab);
  assert.equal(workspaceStore.activeTab?.type, 'sql_editor');
  assert.equal(workspaceStore.activeTab?.title, '01_Init_Tables.sql');

  const sqlTab = workspaceStore.activeTab as SqlEditorTab;
  assert.equal(sqlTab.filePath, 'C:/MyScripts/SQL/01_Init_Tables.sql');
  assert.equal(sqlTab.isDirty, false);

  // Calling openFile again on the same path switches tab without opening duplicate
  const firstTabId = sqlTab.id;
  const initialTabCount = workspaceStore.tabs.length;

  await folderStore.openFile(fileNode);
  assert.equal(workspaceStore.tabs.length, initialTabCount);
  assert.equal(workspaceStore.activeTabId, firstTabId);
});

test('sqlFolderService & workspace: direct in-place save overwrites file without prompt', async () => {
  const targetPath = 'C:/MyScripts/SQL/01_Init_Tables.sql';
  const newContent = 'SELECT 1 AS [Modified];';

  // Perform write
  await sqlFolderService.writeFile(targetPath, newContent);

  // Read back
  const readBack = await sqlFolderService.readFile(targetPath);
  assert.equal(readBack, newContent);
});
