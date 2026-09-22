import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useConnectionStore } from '../src/stores/connectionStore';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import { schemaService } from '../src/services/schemaService';
import { connectionService } from '../src/services/connectionService';
import { queryService } from '../src/services/queryService';

const data = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => { data.set(key, String(value)); },
  removeItem: (key) => { data.delete(key); },
  clear: () => data.clear(), key: () => null, length: 0,
};

beforeEach(() => {
  data.clear();
  setActivePinia(createPinia());
  connectionService.connect = async () => {};
  schemaService.switchDatabase = async () => {};
  schemaService.getDatabases = async () => [{ name: 'A' }, { name: 'B' }];
  schemaService.getDatabaseSchema = async () => [];
});

test('database switch failure preserves the displayed and persisted database', async () => {
  const store = useConnectionStore();
  await store.connect('server', 'A');
  schemaService.switchDatabase = async () => { throw new Error('access denied'); };
  await assert.rejects(store.switchDatabase('B'), /access denied/);
  assert.equal(store.activeDatabase, 'A');
  assert.equal(data.get('sqlight_last_database'), 'A');
});

test('failed post-connect database selection does not publish a successful new target', async () => {
  const store = useConnectionStore();
  await store.connect('old', 'A');
  schemaService.switchDatabase = async () => { throw new Error('access denied'); };
  await assert.rejects(store.connect('new', 'B'), /access denied/);
  assert.equal(store.activeConnectionId, 'old');
  assert.equal(store.activeDatabase, 'A');
  assert.equal(store.status, 'error');
});

test('late connection response cannot overwrite the most recent selection', async () => {
  const store = useConnectionStore();
  let release!: () => void;
  connectionService.connect = (id) => id === 'slow'
    ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
  const pending = store.connect('slow', 'A');
  await store.connect('fast', 'B');
  release();
  await pending;
  assert.equal(store.activeConnectionId, 'fast');
  assert.equal(store.activeDatabase, 'B');
});

test('a tab for a deleted connection is not rebound to the active server', async () => {
  const store = useConnectionStore();
  await store.connect('current', 'A');
  const workspace = useWorkspaceStore();
  workspace.addSqlTab('DELETE FROM Orders', 'old query', 'deleted', 'B');
  workspace.setActiveTab(workspace.activeTabId);
  assert.equal(workspace.activeTab?.connectionId, 'deleted');
  assert.equal(workspace.activeTab?.database, 'B');
});

test('query IPC includes the requested database, SQL and limit', async () => {
  let sent: unknown;
  globalThis.window = { __TAURI_INTERNALS__: {
    invoke: async (command: string, args: unknown) => { sent = { command, args }; return {}; },
  } } as unknown as Window & typeof globalThis;
  try {
    await queryService.executeQuery('server', 'B', 'SELECT 1', 10, 'request', 30);
    assert.deepEqual(sent, { command: 'execute_query', args: {
      connectionId: 'server', database: 'B', sql: 'SELECT 1', maxRows: 10,
      requestId: 'request', timeoutSeconds: 30,
    } });
  } finally { delete (globalThis as any).window; }
});

async function twoConnectionWorkspace() {
  const store = useConnectionStore();
  const profile = (id: string) => ({
    id, name: id, engine: 'mssql' as const, host: 'localhost', port: 1433,
    database: 'master', username: 'sa', encrypt: false, trustServerCertificate: true,
    createdAt: '', updatedAt: '',
  });
  connectionService.getConnections = async () => [profile('A'), profile('B')];
  await store.connect('A', 'master');
  await store.loadConnections();

  const connected: string[] = [];
  connectionService.connect = async (id) => { connected.push(id); };

  const workspace = useWorkspaceStore();
  workspace.addSqlTab('SELECT 1', 'a.sql', 'A', 'master');
  const tabA = workspace.activeTabId;
  workspace.addSqlTab('SELECT 2', 'b.sql', 'B', 'master');
  const tabB = workspace.activeTabId;
  return { workspace, tabA, tabB, connected };
}

test('rapid tab switching only connects to the tab the user settles on', async () => {
  const { workspace, tabA, tabB, connected } = await twoConnectionWorkspace();

  workspace.setActiveTab(tabA);
  workspace.setActiveTab(tabB);
  workspace.setActiveTab(tabA);
  workspace.setActiveTab(tabB);
  assert.deepEqual(connected, [], 'nothing should connect while the switch is still settling');

  await new Promise((resolve) => setTimeout(resolve, 260));
  assert.deepEqual(connected, ['B']);
});

test('executing right after a tab switch flushes the pending connection sync', async () => {
  const { workspace, tabA, tabB, connected } = await twoConnectionWorkspace();

  workspace.setActiveTab(tabA);
  workspace.setActiveTab(tabB);
  assert.deepEqual(connected, []);

  await workspace.ensureActiveTabConnection();
  assert.deepEqual(connected, ['B'], 'the flush must not wait for the debounce');

  await new Promise((resolve) => setTimeout(resolve, 260));
  assert.deepEqual(connected, ['B'], 'the flushed timer must not fire a second time');
});
