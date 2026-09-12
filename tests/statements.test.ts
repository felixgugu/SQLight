import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStatementAtCursor } from '../src/utils/sqlStatementExtractor';
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
