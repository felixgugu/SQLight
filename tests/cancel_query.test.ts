import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useQueryStore } from '../src/stores/queryStore';
import { queryService } from '../src/services/queryService';

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
});

test('queryStore starts with isExecuting=false, isCancelling=false, currentRequestId=null', () => {
  const store = useQueryStore();
  assert.equal(store.isExecuting, false);
  assert.equal(store.isCancelling, false);
  assert.equal(store.currentRequestId, null);
  assert.equal(store.elapsedExecutionMs, 0);
});

test('cancelQuery invokes queryService.cancelQuery with active connection and requestId', async () => {
  const store = useQueryStore();

  let cancelledConnId: string | null = null;
  let cancelledReqId: string | undefined = undefined;

  queryService.cancelQuery = async (connId, reqId) => {
    cancelledConnId = connId;
    cancelledReqId = reqId;
  };

  // When not executing, cancelQuery does nothing
  await store.cancelQuery();
  assert.equal(cancelledConnId, null);

  // Simulate long running query
  let resolveQuery: (res: any) => void;
  const queryPromise = new Promise((resolve) => {
    resolveQuery = resolve;
  });

  queryService.executeQuery = async (_connId, _db, _sql, _limit, reqId) => {
    assert.ok(reqId && reqId.startsWith('req_'));
    return queryPromise as any;
  };

  const execPromise = store.execute('conn-42', 'master', 'WAITFOR DELAY "00:00:30"');

  assert.equal(store.isExecuting, true);
  assert.equal(store.isCancelling, false);
  assert.ok(store.currentRequestId);

  // Trigger cancel
  await store.cancelQuery();

  assert.equal(store.isCancelling, true);
  assert.equal(cancelledConnId, 'conn-42');
  assert.equal(cancelledReqId, store.currentRequestId);

  // Now resolve the mock query with a cancelled error
  resolveQuery!(Promise.reject(new Error('Query cancelled by user')));
  const result = await execPromise;

  assert.equal(result, null);
  assert.equal(store.isExecuting, false);
  assert.equal(store.isCancelling, false);
  assert.equal(store.currentRequestId, null);
});

test('cancelled query records status as cancelled in history and does not add error tab', async () => {
  const store = useQueryStore();

  queryService.executeQuery = async () => {
    throw new Error('Query cancelled by user');
  };

  const initialTabCount = store.resultTabs.length;
  const result = await store.execute('conn-1', 'master', 'SELECT * FROM BigCartesianProduct');

  assert.equal(result, null);
  // No error result tab was added
  assert.equal(store.resultTabs.length, initialTabCount);

  // History contains cancelled entry
  assert.equal(store.history.length, 1);
  const histItem = store.history[0];
  assert.equal(histItem?.status, 'cancelled');
  assert.equal(histItem?.connectionId, 'conn-1');
  assert.ok(histItem?.errorMessage?.includes('取消'));
  assert.equal(store.isExecuting, false);
});

test('subsequent query executes normally and independently after a cancelled query', async () => {
  const store = useQueryStore();

  let queryCallCount = 0;
  queryService.executeQuery = async (_connId, _db, sql) => {
    queryCallCount++;
    if (queryCallCount === 1) {
      throw new Error('查詢已被使用者取消');
    }
    return {
      resultSets: [
        {
          columns: [{ name: 'Val', dataType: 'int', nullable: false, ordinal: 0 }],
          rows: [[100]],
          rowCount: 1,
        },
      ],
      messages: [],
      affectedRows: 1,
      executionTimeMs: 12,
    };
  };

  // 1. First query is cancelled
  const firstRes = await store.execute('conn-1', 'master', 'SELECT * FROM HeavyLoop');
  assert.equal(firstRes, null);
  assert.equal(store.history[0]?.status, 'cancelled');
  assert.equal(store.resultTabs.length, 0);

  // 2. Second query succeeds
  const secondRes = await store.execute('conn-1', 'master', 'SELECT 100 AS Val');
  assert.ok(secondRes);
  assert.equal(secondRes.resultSets.length, 1);
  assert.equal(secondRes.resultSets[0]?.rows[0]?.[0], 100);
  assert.equal(store.history[0]?.status, 'success');
  assert.equal(store.resultTabs.length, 1);
  assert.equal(store.isExecuting, false);
});

test('queryService exposes cancelQuery and getConnectionSpid methods', async () => {
  assert.equal(typeof queryService.cancelQuery, 'function');
  assert.equal(typeof queryService.getConnectionSpid, 'function');

  // Test browser fallback mock response
  const spid = await queryService.getConnectionSpid('conn-mock');
  assert.equal(spid, 55);

  const cancelRes = await queryService.cancelQuery('conn-mock', 'req-123');
  assert.equal(cancelRes, undefined);
});

test('execute with multi-batch script executes each batch sequentially and aggregates results', async () => {
  const store = useQueryStore();

  const executedBatches: string[] = [];

  queryService.executeQuery = async (_connId, _db, sql) => {
    executedBatches.push(sql);
    if (sql.startsWith('CREATE TABLE')) {
      return {
        resultSets: [],
        messages: [{ level: 'info', message: 'Table created', timestamp: new Date().toISOString() }],
        affectedRows: 0,
        executionTimeMs: 15,
      };
    }
    if (sql.startsWith('SELECT')) {
      return {
        resultSets: [
          {
            columns: [{ name: 'Done', dataType: 'int', nullable: false, ordinal: 0 }],
            rows: [[1]],
            rowCount: 1,
          },
        ],
        messages: [],
        affectedRows: 1,
        executionTimeMs: 5,
      };
    }
    return { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 2 };
  };

  const script = `SET ANSI_NULLS ON
GO
CREATE TABLE dbo.MyTable (id int);
GO
SELECT 1 AS Done;`;

  const res = await store.execute('conn-1', 'master', script);
  assert.ok(res);
  assert.equal(executedBatches.length, 3);
  assert.equal(executedBatches[0], 'SET ANSI_NULLS ON');
  assert.equal(executedBatches[1], 'CREATE TABLE dbo.MyTable (id int);');
  assert.equal(executedBatches[2], 'SELECT 1 AS Done;');

  // Results combined
  assert.equal(res.resultSets.length, 1);
  assert.equal(res.resultSets[0]?.rows[0]?.[0], 1);
  assert.equal(res.messages.length, 1);
  assert.equal(res.messages[0]?.message, 'Table created');
});

