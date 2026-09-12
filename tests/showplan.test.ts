import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useQueryStore } from '../src/stores/queryStore';
import { queryService } from '../src/services/queryService';

const storageMap = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, String(value)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => storageMap.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storageMap.clear();
  setActivePinia(createPinia());
});

test('isShowplanEnabled and isStatsEnabled default to false', () => {
  const store = useQueryStore();
  assert.equal(store.isShowplanEnabled, false);
  assert.equal(store.isStatsEnabled, false);
});

test('toggleShowplanEnabled and toggleStatsEnabled enforce mutual exclusivity', () => {
  const store = useQueryStore();

  // Enable stats
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isShowplanEnabled, false);

  // Enabling showplan automatically disables stats
  store.toggleShowplanEnabled();
  assert.equal(store.isShowplanEnabled, true);
  assert.equal(store.isStatsEnabled, false);

  // Enabling stats automatically disables showplan
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isShowplanEnabled, false);

  // Toggling off returns both to false
  store.toggleStatsEnabled();
  assert.equal(store.isStatsEnabled, false);
  assert.equal(store.isShowplanEnabled, false);
});

test('direct assignment maintains mutual exclusivity between showplan and stats', () => {
  const store = useQueryStore();

  store.isStatsEnabled = true;
  assert.equal(store.isStatsEnabled, true);

  store.isShowplanEnabled = true;
  assert.equal(store.isShowplanEnabled, true);
  assert.equal(store.isStatsEnabled, false);

  store.isStatsEnabled = true;
  assert.equal(store.isStatsEnabled, true);
  assert.equal(store.isShowplanEnabled, false);
});

test('execute with isShowplanEnabled wraps query in SET SHOWPLAN_ALL ON and OFF and creates [Plan] tab', async () => {
  const store = useQueryStore();
  store.isShowplanEnabled = true;

  const executedCommands: string[] = [];

  queryService.executeQuery = async (_connId, _db, sql) => {
    executedCommands.push(sql);

    if (sql === 'SET SHOWPLAN_ALL ON;') {
      return {
        resultSets: [],
        messages: [],
        affectedRows: 0,
        executionTimeMs: 1,
      };
    }

    if (sql === 'SET SHOWPLAN_ALL OFF;') {
      return {
        resultSets: [],
        messages: [],
        affectedRows: 0,
        executionTimeMs: 1,
      };
    }

    // Return mock showplan table
    return {
      resultSets: [
        {
          columns: [
            { name: 'StmtText', dataType: 'nvarchar', nullable: true, ordinal: 0 },
            { name: 'NodeId', dataType: 'int', nullable: false, ordinal: 1 },
            { name: 'Parent', dataType: 'int', nullable: false, ordinal: 2 },
            { name: 'PhysicalOp', dataType: 'varchar', nullable: true, ordinal: 3 },
            { name: 'LogicalOp', dataType: 'varchar', nullable: true, ordinal: 4 },
            { name: 'EstimateRows', dataType: 'float', nullable: true, ordinal: 5 },
            { name: 'TotalSubtreeCost', dataType: 'float', nullable: true, ordinal: 6 },
          ],
          rows: [
            ['SELECT * FROM Customers WHERE Country = ?', 1, 0, null, null, 15, 0.00328],
            ['  |--Clustered Index Seek(OBJECT:([Customers].[PK_Customers]))', 2, 1, 'Clustered Index Seek', 'Index Seek', 15, 0.00328],
          ],
          rowCount: 2,
        },
      ],
      messages: [],
      affectedRows: 0,
      executionTimeMs: 8,
    };
  };

  const res = await store.execute('conn-1', 'TestDb', 'SELECT * FROM Customers WHERE Country = ?');
  assert.ok(res);

  // Ensure commands were executed in exact order: SHOWPLAN ON -> User Query -> SHOWPLAN OFF
  assert.equal(executedCommands.length, 3);
  assert.equal(executedCommands[0], 'SET SHOWPLAN_ALL ON;');
  assert.equal(executedCommands[1], 'SELECT * FROM Customers WHERE Country = ?');
  assert.equal(executedCommands[2], 'SET SHOWPLAN_ALL OFF;');

  // Tab was created with [Plan] in title
  const activeTab = store.activeResultTab;
  assert.ok(activeTab);
  assert.equal(activeTab.isShowplan, true);
  assert.ok(activeTab.title.includes('[Plan]'));
  assert.equal(activeTab.result.resultSets.length, 1);
  assert.equal(activeTab.result.resultSets[0]?.columns[0]?.name, 'StmtText');
  assert.equal(activeTab.result.resultSets[0]?.rowCount, 2);
});

test('execute with isShowplanEnabled guarantees SET SHOWPLAN_ALL OFF even if user query throws error', async () => {
  const store = useQueryStore();
  store.isShowplanEnabled = true;

  const executedCommands: string[] = [];

  queryService.executeQuery = async (_connId, _db, sql) => {
    executedCommands.push(sql);

    if (sql === 'SET SHOWPLAN_ALL ON;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }
    if (sql === 'SET SHOWPLAN_ALL OFF;') {
      return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 1 };
    }

    // Simulate query error (e.g. invalid syntax)
    throw new Error('Msg 208: Invalid object name NonExistentTable');
  };

  const res = await store.execute('conn-1', 'TestDb', 'SELECT * FROM NonExistentTable');
  assert.ok(res);
  assert.equal(store.executionError, 'Msg 208: Invalid object name NonExistentTable');

  // Even though query failed, SET SHOWPLAN_ALL OFF must have been called in finally!
  assert.ok(executedCommands.includes('SET SHOWPLAN_ALL ON;'));
  assert.ok(executedCommands.includes('SET SHOWPLAN_ALL OFF;'));
  assert.equal(executedCommands[executedCommands.length - 1], 'SET SHOWPLAN_ALL OFF;');
});
