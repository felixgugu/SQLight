import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import type { ErDiagramTab } from '../src/types/workspace';

const data = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => { data.set(key, String(value)); },
  removeItem: (key) => { data.delete(key); },
  clear: () => data.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  data.clear();
  setActivePinia(createPinia());
});

test('opening ER diagrams for different tables creates independent tabs', () => {
  const store = useWorkspaceStore();
  const initialCount = store.tabs.length;

  // 1. Open ER tab for Customers
  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Customers',
    connectionId: 'conn-1',
    database: 'Northwind',
  });

  assert.equal(store.tabs.length, initialCount + 1);
  const tab1 = store.tabs[store.tabs.length - 1] as ErDiagramTab;
  assert.equal(tab1.type, 'er_diagram');
  assert.equal(tab1.rootTable, 'Customers');
  assert.equal(tab1.title, 'ER: Customers');
  assert.equal(store.activeTabId, tab1.id);

  // 2. Open ER tab for Orders (different table)
  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Orders',
    connectionId: 'conn-1',
    database: 'Northwind',
  });

  assert.equal(store.tabs.length, initialCount + 2);
  const tab2 = store.tabs[store.tabs.length - 1] as ErDiagramTab;
  assert.equal(tab2.type, 'er_diagram');
  assert.equal(tab2.rootTable, 'Orders');
  assert.equal(tab2.title, 'ER: Orders');
  assert.notEqual(tab2.id, tab1.id);
  assert.equal(store.activeTabId, tab2.id);

  // 3. Opening Customers again should activate tab1 without duplicate
  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Customers',
    connectionId: 'conn-1',
    database: 'Northwind',
  });

  assert.equal(store.tabs.length, initialCount + 2);
  assert.equal(store.activeTabId, tab1.id);
});

test('ER tabs maintain completely isolated snapshots when updated via updateTabData', () => {
  const store = useWorkspaceStore();

  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Customers',
    connectionId: 'conn-1',
    database: 'Northwind',
  });
  const tab1Id = store.activeTabId;

  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Orders',
    connectionId: 'conn-1',
    database: 'Northwind',
  });
  const tab2Id = store.activeTabId;

  // Save distinct snapshots for each tab (simulating onBeforeUnmount)
  const snapshot1 = { graph: { cells: [{ id: 'node-dbo.Customers' }] } };
  const snapshot2 = { graph: { cells: [{ id: 'node-dbo.Orders' }] } };

  store.updateTabData(tab1Id, { initialData: snapshot1 });
  store.updateTabData(tab2Id, { initialData: snapshot2 });

  const currentTab1 = store.tabs.find((t) => t.id === tab1Id) as ErDiagramTab;
  const currentTab2 = store.tabs.find((t) => t.id === tab2Id) as ErDiagramTab;

  assert.deepEqual(currentTab1.initialData, snapshot1);
  assert.deepEqual(currentTab2.initialData, snapshot2);
  assert.notDeepEqual(currentTab1.initialData, currentTab2.initialData);
});
