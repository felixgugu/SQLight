import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useQueryStore, resetQueryExecutionSeq, resetSessionMessageSeq, resetHistorySeq } from '../src/stores/queryStore';
import { queryService } from '../src/services/queryService';
import type { QueryResult } from '../src/types/query';

const storageMap = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => storageMap.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storageMap.clear();
  setActivePinia(createPinia());
  resetQueryExecutionSeq();
  resetSessionMessageSeq();
  resetHistorySeq();
});

test('sessionMessages and history start empty and are purely in-memory without localStorage persistence', () => {
  const store = useQueryStore();
  assert.equal(store.sessionMessages.length, 0);
  assert.equal(store.history.length, 0);
  assert.equal(storageMap.size, 0, 'No data should be in localStorage initially');
});

test('sessionMessages accumulates query after query and keeps newest in front with sequential numbers', async () => {
  const store = useQueryStore();

  let queryCallCount = 0;
  queryService.executeQuery = async (_conn, _db, _sql) => {
    queryCallCount++;
    const res: QueryResult = {
      resultSets: [
        {
          columns: [{ name: 'id', dataType: 'int', nullable: false, ordinal: 0 }],
          rows: [[queryCallCount]],
          rowCount: 1,
          totalCount: 1,
          isTruncated: false,
        },
      ],
      messages: [
        {
          level: 'info',
          message: `Query ${queryCallCount} completed. 1 row affected.`,
          timestamp: new Date().toISOString(),
        },
      ],
      affectedRows: 1,
      executionTimeMs: 10,
    };
    return res;
  };

  // Run first query
  await store.execute('conn-1', 'db1', 'SELECT 1;');
  assert.equal(store.sessionMessages.length, 1);
  assert.equal(store.sessionMessages[0].seq, 1);
  assert.equal(store.sessionMessages[0].message, 'Query 1 completed. 1 row affected.');

  // Run second query
  await store.execute('conn-1', 'db1', 'SELECT 2;');
  assert.equal(store.sessionMessages.length, 2);
  // Newest at index 0
  assert.equal(store.sessionMessages[0].seq, 2);
  assert.equal(store.sessionMessages[0].message, 'Query 2 completed. 1 row affected.');
  assert.equal(store.sessionMessages[1].seq, 1);

  // Run third query with multiple messages
  queryService.executeQuery = async () => ({
    resultSets: [],
    messages: [
      { level: 'info', message: 'First msg from query 3', timestamp: new Date().toISOString() },
      { level: 'warning', message: 'Second msg from query 3', timestamp: new Date().toISOString() },
    ],
    affectedRows: 0,
    executionTimeMs: 25,
  });

  await store.execute('conn-1', 'db1', 'EXEC test;');
  assert.equal(store.sessionMessages.length, 4);
  // Sequence numbers should be 4, 3, 2, 1 with newest at index 0
  assert.equal(store.sessionMessages[0].seq, 4);
  assert.equal(store.sessionMessages[0].message, 'Second msg from query 3');
  assert.equal(store.sessionMessages[1].seq, 3);
  assert.equal(store.sessionMessages[1].message, 'First msg from query 3');
  assert.equal(store.sessionMessages[2].seq, 2);
  assert.equal(store.sessionMessages[3].seq, 1);

  // Still not persisted to localStorage
  assert.equal(storageMap.has('sqlight_messages'), false);
  assert.equal(storageMap.has('sqlight_history'), false);
});

test('history accumulates query after query and keeps newest in front with sequential numbers', async () => {
  const store = useQueryStore();

  queryService.executeQuery = async (_conn, _db, sql) => ({
    resultSets: [],
    messages: [],
    affectedRows: 5,
    executionTimeMs: 15,
  });

  await store.execute('conn-1', 'db1', 'SELECT 1;');
  await store.execute('conn-1', 'db1', 'SELECT 2;');
  await store.execute('conn-1', 'db1', 'SELECT 3;');

  assert.equal(store.history.length, 3);
  assert.equal(store.history[0].seq, 3);
  assert.equal(store.history[0].sql, 'SELECT 3;');
  assert.equal(store.history[1].seq, 2);
  assert.equal(store.history[1].sql, 'SELECT 2;');
  assert.equal(store.history[2].seq, 1);
  assert.equal(store.history[2].sql, 'SELECT 1;');
});

test('clearMessages empties sessionMessages and clearHistory empties history', async () => {
  const store = useQueryStore();

  queryService.executeQuery = async () => ({
    resultSets: [],
    messages: [{ level: 'info', message: 'Hello', timestamp: new Date().toISOString() }],
    affectedRows: 1,
    executionTimeMs: 5,
  });

  await store.execute('conn-1', 'db1', 'SELECT 1;');
  assert.equal(store.sessionMessages.length, 1);
  assert.equal(store.history.length, 1);

  store.clearMessages();
  assert.equal(store.sessionMessages.length, 0);
  assert.equal(store.history.length, 1, 'clearMessages should not clear history');

  store.clearHistory();
  assert.equal(store.history.length, 0);
});

test('query cancellation and errors also accumulate into both sessionMessages and history', async () => {
  const store = useQueryStore();

  // Test error
  queryService.executeQuery = async () => {
    throw new Error('Invalid object name dbo.NonExistentTable');
  };

  await store.execute('conn-1', 'db1', 'SELECT * FROM dbo.NonExistentTable;');

  assert.equal(store.sessionMessages.length, 1);
  assert.equal(store.sessionMessages[0].level, 'error');
  assert.ok(store.sessionMessages[0].message.includes('Invalid object name dbo.NonExistentTable'));
  assert.equal(store.sessionMessages[0].seq, 1);

  assert.equal(store.history.length, 1);
  assert.equal(store.history[0].status, 'error');
  assert.equal(store.history[0].seq, 1);

  // Test cancelled
  queryService.executeQuery = async () => {
    throw new Error('Query was cancelled by user');
  };

  await store.execute('conn-1', 'db1', 'SELECT * FROM huge_table;');

  assert.equal(store.sessionMessages.length, 2);
  assert.equal(store.sessionMessages[0].level, 'warning');
  assert.equal(store.sessionMessages[0].seq, 2);

  assert.equal(store.history.length, 2);
  assert.equal(store.history[0].status, 'cancelled');
  assert.equal(store.history[0].seq, 2);
});

test('history and messages expand/collapse set behavior preserves individual and batch state', () => {
  const expandedKeys = new Set<string | number>();

  const toggleExpand = (key: string | number) => {
    if (expandedKeys.has(key)) {
      expandedKeys.delete(key);
    } else {
      expandedKeys.add(key);
    }
  };

  const item1Key = 'hist-1';
  const item2Key = 'hist-2';

  // Initially collapsed (not in set)
  assert.equal(expandedKeys.has(item1Key), false);
  assert.equal(expandedKeys.has(item2Key), false);

  // Toggle expand item1
  toggleExpand(item1Key);
  assert.equal(expandedKeys.has(item1Key), true);
  assert.equal(expandedKeys.has(item2Key), false);

  // Toggle collapse item1
  toggleExpand(item1Key);
  assert.equal(expandedKeys.has(item1Key), false);

  // Batch expand all
  const allKeys = [item1Key, item2Key, 'hist-3'];
  allKeys.forEach((k) => expandedKeys.add(k));
  assert.equal(expandedKeys.size, 3);
  assert.equal(allKeys.every((k) => expandedKeys.has(k)), true);

  // Batch collapse all
  expandedKeys.clear();
  assert.equal(expandedKeys.size, 0);
});

test('queryService openQueryLogFile and getQueryLogPath return valid log path in browser/mock environment', async () => {
  const logPath = await queryService.getQueryLogPath();
  assert.ok(logPath.includes('puffsql.log'), 'getQueryLogPath should resolve to puffsql.log');

  const openedPath = await queryService.openQueryLogFile();
  assert.ok(openedPath.includes('puffsql.log'), 'openQueryLogFile should open puffsql.log');
});
