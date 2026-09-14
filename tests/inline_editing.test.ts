import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTableEditability } from '../src/utils/tableEditability';
import { generateBatchUpdateScript, type RowModification } from '../src/utils/batchUpdateGenerator';
import type { ColumnDef, QueryResultTab } from '../src/types/query';
import type { TableSchema } from '../src/stores/schemaStore';

const mockTableSchema: TableSchema = {
  schema: 'dbo',
  name: 'Users',
  kind: 'BASE TABLE',
  columns: [
    { name: 'id', dataType: 'int', isPrimaryKey: true, isIdentity: true, nullable: false },
    { name: 'username', dataType: 'nvarchar', isPrimaryKey: false, isIdentity: false, nullable: false },
    { name: 'email', dataType: 'nvarchar', isPrimaryKey: false, isIdentity: false, nullable: true },
    { name: 'age', dataType: 'int', isPrimaryKey: false, isIdentity: false, nullable: true },
  ],
};

const mockNoPkTableSchema: TableSchema = {
  schema: 'dbo',
  name: 'Logs',
  kind: 'BASE TABLE',
  columns: [
    { name: 'timestamp', dataType: 'datetime', isPrimaryKey: false, isIdentity: false, nullable: false },
    { name: 'message', dataType: 'nvarchar', isPrimaryKey: false, isIdentity: false, nullable: true },
  ],
};

const mockViewSchema: TableSchema = {
  schema: 'dbo',
  name: 'v_active_users',
  kind: 'VIEW',
  columns: [
    { name: 'id', dataType: 'int', isPrimaryKey: true, isIdentity: false, nullable: false },
    { name: 'username', dataType: 'nvarchar', isPrimaryKey: false, isIdentity: false, nullable: false },
  ],
};

const mockGetTableSchema = (tableName: string): TableSchema | undefined => {
  const clean = tableName.toLowerCase().replace(/\[|\]/g, '');
  if (clean === 'users' || clean === 'dbo.users') return mockTableSchema;
  if (clean === 'logs' || clean === 'dbo.logs') return mockNoPkTableSchema;
  if (clean === 'v_active_users' || clean === 'dbo.v_active_users') return mockViewSchema;
  return undefined;
};

test('checkTableEditability: single table with full PK in projection is editable', () => {
  const tab: QueryResultTab = {
    id: 'tab-1',
    title: 'Query 1',
    sql: 'SELECT id, username, email FROM Users',
    result: { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 10 },
    executedAt: '12:00:00',
    isPinned: false,
    durationMs: 10,
    rowCount: 5,
  };

  const columns: ColumnDef[] = [
    { name: 'id', dataType: 'int', nullable: false, ordinal: 0 },
    { name: 'username', dataType: 'nvarchar', nullable: false, ordinal: 1 },
    { name: 'email', dataType: 'nvarchar', nullable: true, ordinal: 2 },
  ];

  const res = checkTableEditability({ tab, columns, getTableSchema: mockGetTableSchema });
  assert.equal(res.canEdit, true);
  assert.deepEqual(res.pkColumns, ['id']);
  assert.equal(res.targetTable?.tableName, 'Users');
});

test('checkTableEditability: table without PK cannot be edited', () => {
  const tab: QueryResultTab = {
    id: 'tab-2',
    title: 'Query 2',
    sql: 'SELECT timestamp, message FROM Logs',
    result: { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 10 },
    executedAt: '12:00:00',
    isPinned: false,
    durationMs: 10,
    rowCount: 2,
  };

  const columns: ColumnDef[] = [
    { name: 'timestamp', dataType: 'datetime', nullable: false, ordinal: 0 },
    { name: 'message', dataType: 'nvarchar', nullable: true, ordinal: 1 },
  ];

  const res = checkTableEditability({ tab, columns, getTableSchema: mockGetTableSchema });
  assert.equal(res.canEdit, false);
  assert.match(res.reason || '', /沒有主鍵/);
  assert.equal(res.shortReason, '無主鍵');
});

test('checkTableEditability: missing PK column in projection cannot be edited', () => {
  const tab: QueryResultTab = {
    id: 'tab-3',
    title: 'Query 3',
    sql: 'SELECT username, email FROM Users',
    result: { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 10 },
    executedAt: '12:00:00',
    isPinned: false,
    durationMs: 10,
    rowCount: 5,
  };

  // Missing 'id' in projected columns
  const columns: ColumnDef[] = [
    { name: 'username', dataType: 'nvarchar', nullable: false, ordinal: 0 },
    { name: 'email', dataType: 'nvarchar', nullable: true, ordinal: 1 },
  ];

  const res = checkTableEditability({ tab, columns, getTableSchema: mockGetTableSchema });
  assert.equal(res.canEdit, false);
  assert.match(res.reason || '', /未包含完整主鍵欄位/);
  assert.equal(res.shortReason, '缺少 PK 欄位');
});

test('checkTableEditability: multi-table JOIN cannot be edited', () => {
  const tab: QueryResultTab = {
    id: 'tab-4',
    title: 'Query 4',
    sql: 'SELECT u.id, u.username, l.message FROM Users u JOIN Logs l ON u.id = l.id',
    result: { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 10 },
    executedAt: '12:00:00',
    isPinned: false,
    durationMs: 10,
    rowCount: 5,
  };

  const columns: ColumnDef[] = [
    { name: 'id', dataType: 'int', nullable: false, ordinal: 0 },
    { name: 'username', dataType: 'nvarchar', nullable: false, ordinal: 1 },
    { name: 'message', dataType: 'nvarchar', nullable: true, ordinal: 2 },
  ];

  const res = checkTableEditability({ tab, columns, getTableSchema: mockGetTableSchema });
  assert.equal(res.canEdit, false);
  assert.match(res.reason || '', /多資料表/);
  assert.equal(res.shortReason, '多表查詢');
});

test('checkTableEditability: VIEW cannot be edited', () => {
  const tab: QueryResultTab = {
    id: 'tab-5',
    title: 'Query 5',
    sql: 'SELECT id, username FROM v_active_users',
    result: { resultSets: [], messages: [], affectedRows: 0, executionTimeMs: 10 },
    executedAt: '12:00:00',
    isPinned: false,
    durationMs: 10,
    rowCount: 5,
  };

  const columns: ColumnDef[] = [
    { name: 'id', dataType: 'int', nullable: false, ordinal: 0 },
    { name: 'username', dataType: 'nvarchar', nullable: false, ordinal: 1 },
  ];

  const res = checkTableEditability({ tab, columns, getTableSchema: mockGetTableSchema });
  assert.equal(res.canEdit, false);
  assert.match(res.reason || '', /檢視表/);
  assert.equal(res.shortReason, '檢視表');
});

test('generateBatchUpdateScript: builds transactional multi-row UPDATE with rowcount guards', () => {
  const modifications: RowModification[] = [
    {
      rowIndex: 0,
      updates: { username: 'alice_new', email: 'alice@example.com' },
      pkWhere: { id: 1 },
    },
    {
      rowIndex: 2,
      updates: { email: null },
      pkWhere: { id: 3 },
    },
  ];

  const script = generateBatchUpdateScript({
    tableName: 'Users',
    schema: 'dbo',
    database: 'MyDb',
    modifications,
  });

  assert.match(script, /BEGIN TRANSACTION;/);
  assert.match(script, /COMMIT TRANSACTION;/);
  assert.match(script, /ROLLBACK TRANSACTION;/);
  assert.match(script, /IF @@ROWCOUNT <> 1 THROW 50001/);
  assert.match(script, /\[MyDb\]\.\[dbo\]\.\[Users\]/);
  assert.match(script, /\[username\] = N'alice_new'/);
  assert.match(script, /\[email\] = NULL/);
  assert.match(script, /WHERE \[id\] = 1/);
  assert.match(script, /WHERE \[id\] = 3/);
});

test('generateBatchUpdateScript: throws on empty modifications or missing PK conditions', () => {
  assert.throws(() => {
    generateBatchUpdateScript({ tableName: 'Users', modifications: [] });
  });

  assert.throws(() => {
    generateBatchUpdateScript({
      tableName: 'Users',
      modifications: [{ rowIndex: 0, updates: { username: 'test' }, pkWhere: {} }],
    });
  });
});
