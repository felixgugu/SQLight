import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import {
  parseStatisticsMessages,
  formatBytes,
  formatPageSize,
  buildExecutionStats,
  wrapQueryWithPerfTelemetry,
} from '../src/utils/statsParser';
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

test('formatBytes and formatPageSize calculate human readable data sizes from 8KB SQL Server pages', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1024 * 1024), '1 MB');
  assert.equal(formatBytes(1024 * 1024 * 1024), '1 GB');

  // 1 page = 8192 bytes = 8 KB
  assert.equal(formatPageSize(1), '1 頁 (8 KB)');

  // 1000 pages = 8,192,000 bytes = 7.81 MB
  assert.ok(formatPageSize(1000).includes('1,000 頁 (7.8 MB)'));
});

test('parseStatisticsMessages accurately parses STATISTICS IO and STATISTICS TIME lines', () => {
  const sampleMessages = [
    "Table 'Customers'. Scan count 1, logical reads 35, physical reads 2, read-ahead reads 4, lob logical reads 0, lob physical reads 0, lob read-ahead reads 0.",
    "Table 'Orders'. Scan count 2, logical reads 1250, physical reads 10, read-ahead reads 0, lob logical reads 12, lob physical reads 0, lob read-ahead reads 0.",
    "Table 'Worktable'. Scan count 0, logical reads 0, physical reads 0, read-ahead reads 0, lob logical reads 0, lob physical reads 0, lob read-ahead reads 0.",
    "SQL Server parse and compile time: \n   CPU time = 3 ms, elapsed time = 5 ms.",
    "SQL Server Execution Times:\n   CPU time = 48 ms,  elapsed time = 62 ms.",
  ];

  const parsed = parseStatisticsMessages(sampleMessages);

  // CPU and Elapsed times
  assert.equal(parsed.cpuTimeMs, 48);
  assert.equal(parsed.elapsedTimeMs, 62);
  assert.equal(parsed.compileCpuTimeMs, 3);
  assert.equal(parsed.compileElapsedTimeMs, 5);

  // Table Stats
  assert.equal(parsed.tableStats.length, 3);

  // Sorted by logical reads descending -> Orders (1250) should be first
  const firstTable = parsed.tableStats[0];
  assert.equal(firstTable?.tableName, 'Orders');
  assert.equal(firstTable?.logicalReads, 1250);
  assert.equal(firstTable?.physicalReads, 10);
  assert.equal(firstTable?.lobLogicalReads, 12);
  assert.equal(firstTable?.totalReads, 1262);
  assert.equal(firstTable?.isHighIo, true); // > 1000 logical reads -> flagged as High IO

  const secondTable = parsed.tableStats[1];
  assert.equal(secondTable?.tableName, 'Customers');
  assert.equal(secondTable?.logicalReads, 35);
  assert.equal(secondTable?.physicalReads, 2);
  assert.equal(secondTable?.readAheadReads, 4);
  assert.equal(secondTable?.isHighIo, false);

  const worktable = parsed.tableStats[2];
  assert.equal(worktable?.tableName, 'Worktable');
  assert.equal(worktable?.logicalReads, 0);
});

test('buildExecutionStats correctly computes cache hit ratio and aggregates totals', () => {
  const messages = [
    "Table 'Products'. Scan count 1, logical reads 100, physical reads 10, read-ahead reads 0, lob logical reads 0.",
  ];

  const stats = buildExecutionStats({
    messages,
    telemetrySummary: {
      elapsedTimeMs: 25,
      cpuTimeMs: 15,
      logicalReads: 100,
      physicalReads: 10,
      physicalWrites: 5,
    },
    waitStats: [
      {
        waitType: 'PAGEIOLATCH_SH',
        waitingTasksCount: 2,
        waitTimeMs: 8,
        maxWaitTimeMs: 5,
      },
    ],
    executionTimeMsFallback: 25,
    querySql: 'SELECT * FROM Products',
  });

  assert.equal(stats.totalLogicalReads, 100);
  assert.equal(stats.totalPhysicalReads, 10);
  assert.equal(stats.totalPhysicalWrites, 5);
  assert.equal(stats.cpuTimeMs, 15);
  assert.equal(stats.elapsedTimeMs, 25);
  // (100 - 10) / 100 = 90%
  assert.equal(stats.cacheHitRatio, 90);
  assert.equal(stats.waitStats.length, 1);
  assert.equal(stats.waitStats[0]?.waitType, 'PAGEIOLATCH_SH');
});

test('wrapQueryWithPerfTelemetry properly surrounds query with telemetry and statistics commands', () => {
  const wrapped = wrapQueryWithPerfTelemetry('SELECT * FROM sys.tables;');
  assert.ok(wrapped.includes('SET STATISTICS IO ON;'));
  assert.ok(wrapped.includes('SET STATISTICS TIME ON;'));
  assert.ok(wrapped.includes('SELECT * FROM sys.tables;'));
  assert.ok(wrapped.includes('SET STATISTICS IO OFF;'));
  assert.ok(wrapped.includes('__SQLIGHT_PERF_SUMMARY__'));
  assert.ok(wrapped.includes('__SQLIGHT_WAIT_STATS__'));
});

test('queryStore defaults isStatsEnabled to false and strips telemetry result sets when enabled', async () => {
  const store = useQueryStore();
  // Verify default is false as requested by user
  assert.equal(store.isStatsEnabled, false);

  // Enable performance analysis
  store.isStatsEnabled = true;

  queryService.executeQuery = async (_connId, _db, sql) => {
    assert.ok(sql.includes('__SQLIGHT_PERF_SUMMARY__'));

    return {
      resultSets: [
        // User's genuine query result
        {
          columns: [{ name: 'Id', dataType: 'int', nullable: false, ordinal: 0 }],
          rows: [[1], [2]],
          rowCount: 2,
        },
        // Telemetry payload 1
        {
          columns: [
            { name: '__sqlight_tag__', dataType: 'varchar', nullable: false, ordinal: 0 },
            { name: 'elapsedTimeMs', dataType: 'int', nullable: false, ordinal: 1 },
            { name: 'cpuTimeMs', dataType: 'int', nullable: false, ordinal: 2 },
            { name: 'logicalReads', dataType: 'bigint', nullable: false, ordinal: 3 },
            { name: 'physicalReads', dataType: 'bigint', nullable: false, ordinal: 4 },
            { name: 'physicalWrites', dataType: 'bigint', nullable: false, ordinal: 5 },
          ],
          rows: [['__SQLIGHT_PERF_SUMMARY__', 35, 12, 420, 0, 0]],
          rowCount: 1,
        },
        // Telemetry payload 2
        {
          columns: [
            { name: '__sqlight_tag__', dataType: 'varchar', nullable: false, ordinal: 0 },
            { name: 'wait_type', dataType: 'varchar', nullable: false, ordinal: 1 },
            { name: 'waiting_tasks_count', dataType: 'bigint', nullable: false, ordinal: 2 },
            { name: 'wait_time_ms', dataType: 'bigint', nullable: false, ordinal: 3 },
            { name: 'max_wait_time_ms', dataType: 'bigint', nullable: false, ordinal: 4 },
          ],
          rows: [['__SQLIGHT_WAIT_STATS__', 'ASYNC_NETWORK_IO', 1, 4, 4]],
          rowCount: 1,
        },
      ],
      messages: [
        {
          level: 'info',
          message: "Table 'MyTable'. Scan count 1, logical reads 420, physical reads 0.",
          timestamp: new Date().toISOString(),
        },
      ],
      affectedRows: 2,
      executionTimeMs: 35,
    };
  };

  const res = await store.execute('conn-1', 'AppDb', 'SELECT * FROM MyTable');
  assert.ok(res);

  // The telemetry result sets MUST be stripped so only 1 result set is presented to user
  assert.equal(res.resultSets.length, 1);
  assert.equal(res.resultSets[0]?.columns[0]?.name, 'Id');

  // activeExecutionStats should be populated
  assert.ok(store.activeExecutionStats);
  assert.equal(store.activeExecutionStats.totalLogicalReads, 420);
  assert.equal(store.activeExecutionStats.cpuTimeMs, 12);
  assert.equal(store.activeExecutionStats.waitStats.length, 1);
  assert.equal(store.activeExecutionStats.waitStats[0]?.waitType, 'ASYNC_NETWORK_IO');
});
