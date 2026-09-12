import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import { useQueryStore, resetQueryExecutionSeq } from '../src/stores/queryStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { queryService } from '../src/services/queryService';
import type { QueryResult } from '../src/types/query';

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
  resetQueryExecutionSeq();
});

test('addTableStructureTab adds a tab with type table_structure and switches active tab', () => {
  const store = useWorkspaceStore();
  const initialCount = store.tabs.length;

  store.addTableStructureTab('dbo', 'Employees', 'conn-1', 'AdventureWorks');

  assert.equal(store.tabs.length, initialCount + 1);
  const createdTab = store.tabs[store.tabs.length - 1];
  assert.equal(createdTab?.type, 'table_structure');
  assert.equal(createdTab?.title, 'dbo.Employees (Structure)');
  assert.equal(store.activeTabId, createdTab?.id);

  // Calling again for the same table and database should activate existing without duplicate
  store.addTableStructureTab('dbo', 'Employees', 'conn-1', 'AdventureWorks');
  assert.equal(store.tabs.length, initialCount + 1);
  assert.equal(store.activeTabId, createdTab?.id);
});

test('queryExecutionSeq increments sequentially and titles follow $SEQ.$Tabname $rowNumber r', async () => {
  const store = useQueryStore();

  queryService.executeQuery = async (_connId, _db, sql) => {
    const isOrders = sql.includes('Orders');
    const rowCount = isOrders ? 12 : 50;
    return {
      resultSets: [
        {
          columns: [{ name: 'Id', dataType: 'int', nullable: false, ordinal: 0 }],
          rows: Array.from({ length: rowCount }, (_, i) => [i + 1]),
          rowCount,
        },
      ],
      messages: [],
      affectedRows: 0,
      executionTimeMs: 15,
    } as QueryResult;
  };

  // First query
  await store.execute('conn-1', 'master', 'SELECT * FROM Customers;');
  assert.equal(store.resultTabs.length, 1);
  assert.equal(store.resultTabs[0]?.title, '1.Customers 50r');
  assert.equal(store.resultTabs[0]?.seq, 1);
  assert.equal(store.resultTabs[0]?.rowCount, 50);

  // Second query
  await store.execute('conn-1', 'master', 'SELECT * FROM Orders;');
  assert.equal(store.resultTabs.length, 2);
  assert.equal(store.resultTabs[0]?.title, '2.Orders 12r');
  assert.equal(store.resultTabs[0]?.seq, 2);
  assert.equal(store.resultTabs[0]?.rowCount, 12);

  // Third query fails with error
  queryService.executeQuery = async () => {
    throw new Error('Table does not exist');
  };
  await store.execute('conn-1', 'master', 'SELECT * FROM NonExistentTable;');
  assert.equal(store.resultTabs.length, 3);
  assert.equal(store.resultTabs[0]?.title, '3.NonExistentTable 0r');
  assert.equal(store.resultTabs[0]?.seq, 3);
  assert.equal(store.resultTabs[0]?.rowCount, 0);
});

test('settingsStore includes customizable active tab colors with proper defaults and reset', () => {
  const store = useSettingsStore();

  assert.equal(store.activeSqlTabBgColor, '#1e40af');
  assert.equal(store.activeSqlTabTextColor, '#ffffff');
  assert.equal(store.activeResultTabBgColor, '#065f46');
  assert.equal(store.activeResultTabTextColor, '#ffffff');

  // Customize values
  store.activeSqlTabBgColor = '#9333ea';
  store.activeSqlTabTextColor = '#fef08a';
  store.activeResultTabBgColor = '#b91c1c';
  store.activeResultTabTextColor = '#f3f4f6';

  assert.equal(store.activeSqlTabBgColor, '#9333ea');
  assert.equal(store.activeResultTabBgColor, '#b91c1c');

  // Reset to defaults
  store.resetToDefaults();
  assert.equal(store.activeSqlTabBgColor, '#1e40af');
  assert.equal(store.activeSqlTabTextColor, '#ffffff');
  assert.equal(store.activeResultTabBgColor, '#065f46');
  assert.equal(store.activeResultTabTextColor, '#ffffff');
});
