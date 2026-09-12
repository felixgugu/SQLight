import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhereConditions, generateDeleteStatement, generateInsertStatement, generateUpdateStatement, formatTableName, formatSqlLiteral } from '../src/utils/sqlGenerator';

const columns = [{ name: 'tenant', isPrimaryKey: true }, { name: 'id', isPrimaryKey: true }, { name: 'value' }];
test('complete composite primary key uses every key component', () => {
  assert.deepEqual(buildWhereConditions(columns, [7, 9, 'x'], ['tenant', 'id']), ['[tenant] = 7', '[id] = 9']);
});
test('partial composite primary key falls back to all projected columns', () => {
  assert.deepEqual(buildWhereConditions([columns[1]!, columns[2]!], [9, 'x'], ['tenant', 'id']), ["[id] = 9", "[value] = N'x'"]);
});
test('unknown primary key metadata never assumes a partial key is unique', () => {
  assert.equal(buildWhereConditions(columns, [7, 9, null]).length, 3);
});
test('empty, incomplete and ambiguous rows cannot produce unconstrained DML', () => {
  assert.throws(() => buildWhereConditions([], []));
  assert.throws(() => buildWhereConditions(columns, [7]));
  assert.throws(() => buildWhereConditions([{ name: 'id' }, { name: 'id' }], [1, 2]));
});
test('generated mutations roll back when more or fewer than one row is affected', () => {
  for (const generate of [generateDeleteStatement, generateUpdateStatement]) {
    const sql = generate({ database: 'B', tableName: 'Orders', columns, row: [7, 9, 'x'], primaryKeyColumns: ['tenant', 'id'] });
    assert.match(sql, /\[B\]\.\[dbo\]\.\[Orders\]/);
    assert.match(sql, /IF @@TRANCOUNT <> 0 THROW/);
    assert.match(sql, /IF @@ROWCOUNT <> 1 THROW/);
    assert.match(sql, /ROLLBACK TRANSACTION/);
  }
});
test('identity columns are omitted from inserts and update assignments', () => {
  const params = { tableName: 'Orders', columns: [{ name: 'id', isIdentity: true, isPrimaryKey: true }, { name: 'value' }], row: [1, 'x'], primaryKeyColumns: ['id'] };
  assert.match(generateInsertStatement(params), /\(\[value\]\)/);
  assert.doesNotMatch(generateUpdateStatement(params), /SET\s+\[id\]/);
});
test('identifier escaping preserves closing brackets instead of deleting them', () => {
  assert.equal(formatTableName('a]b', 's', 'db'), '[db].[s].[a]]b]');
});
test('binary placeholders and imprecise integers cannot silently become SQL values', () => {
  assert.throws(() => formatSqlLiteral({ type: 'binary', length: 8 }));
  assert.throws(() => formatSqlLiteral(9007199254740992));
  assert.equal(formatSqlLiteral('9223372036854775807'), "N'9223372036854775807'");
});
