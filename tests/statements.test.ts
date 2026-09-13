import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStatementAtCursor, splitSqlBatches } from '../src/utils/sqlStatementExtractor';
import { generateDeleteStatement } from '../src/utils/sqlGenerator';

test('transaction guards stay attached when the cursor is on the generated DELETE', () => {
  const sql = generateDeleteStatement({ tableName: 'T', columns: [{ name: 'id' }], row: [1] });
  const line = sql.split('\n').findIndex((line) => line.startsWith('DELETE')) + 1;
  assert.equal(extractStatementAtCursor(sql, line).sql, sql);
});
test('blank lines within a query do not detach its WHERE clause', () => {
  const sql = 'DELETE FROM Orders\n\nWHERE id = 7;';
  assert.equal(extractStatementAtCursor(sql, 1).sql, sql);
});
test('GO and semicolons inside a multiline literal do not split a query', () => {
  const sql = "SELECT 'a;\nGO\nb' AS value;";
  assert.equal(extractStatementAtCursor(sql, 2).sql, sql);
});
test('nested comments containing GO are not batch boundaries', () => {
  const sql = 'SELECT /* outer\n/* inner */\nGO\n*/ 1;';
  assert.equal(extractStatementAtCursor(sql, 3).sql, sql);
});
test('real GO boundaries isolate batches and separator line executes nothing', () => {
  const sql = 'SELECT 1;\nGO -- batch\nSELECT 2;';
  assert.equal(extractStatementAtCursor(sql, 3).sql, 'SELECT 2;');
  assert.equal(extractStatementAtCursor(sql, 2).sql, '');
});
test('selection remains an explicit execution override', () => {
  assert.deepEqual(extractStatementAtCursor('SELECT 1;', 1, 'SELECT 2'), { sql: 'SELECT 2', isSelection: true });
});

test('splitSqlBatches correctly divides script across GO boundaries', () => {
  const script = `USE [mydb];
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE dbo.Test (id int);
GO`;

  const batches = splitSqlBatches(script);
  assert.equal(batches.length, 4);
  assert.equal(batches[0], 'USE [mydb];');
  assert.equal(batches[1], 'SET ANSI_NULLS ON');
  assert.equal(batches[2], 'SET QUOTED_IDENTIFIER ON');
  assert.equal(batches[3], 'CREATE TABLE dbo.Test (id int);');
});

test('splitSqlBatches preserves queries without GO as a single batch', () => {
  const query = 'SELECT * FROM Customers WHERE City = "Taipei";';
  const batches = splitSqlBatches(query);
  assert.equal(batches.length, 1);
  assert.equal(batches[0], query);
});

test('splitSqlBatches ignores GO inside string literals and block comments', () => {
  const script = `SELECT 'GO' AS val;
GO
SELECT /* GO inside comment */ 42;`;
  const batches = splitSqlBatches(script);
  assert.equal(batches.length, 2);
  assert.equal(batches[0], "SELECT 'GO' AS val;");
  assert.equal(batches[1], "SELECT /* GO inside comment */ 42;");
});

