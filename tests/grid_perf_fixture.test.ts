import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPerfFixture,
  buildPerfFixtureColumns,
  parsePerfFixtureSpec,
  PERF_FIXTURE_DEFAULT_SPEC,
  PERF_FIXTURE_MAX_COLS,
  PERF_FIXTURE_MAX_ROWS,
  PERF_FIXTURE_MAX_SETS,
} from '../src/utils/perfGridFixture';

test('perf fixture spec is only recognised through the dev marker comment', () => {
  assert.equal(parsePerfFixtureSpec('SELECT 1'), null);
  assert.equal(parsePerfFixtureSpec(''), null);
  assert.equal(parsePerfFixtureSpec(undefined), null);
  assert.equal(parsePerfFixtureSpec('-- sqlight:perf-fixture cols=5'), null, 'line comments must not trigger');

  const spec = parsePerfFixtureSpec('/* sqlight:perf-fixture */');
  assert.deepEqual(spec, PERF_FIXTURE_DEFAULT_SPEC);
});

test('perf fixture spec reads cols, rows, sets and longtext tokens', () => {
  const spec = parsePerfFixtureSpec(
    'SELECT * FROM t; /* sqlight:perf-fixture cols=40 rows=50000 sets=3 longtext=1 */'
  );
  assert.deepEqual(spec, { cols: 40, rows: 50000, sets: 3, longtext: true });

  assert.equal(
    parsePerfFixtureSpec('/* sqlight:perf-fixture longtext=true */')?.longtext,
    true
  );
  assert.equal(
    parsePerfFixtureSpec('/* sqlight:perf-fixture longtext=0 */')?.longtext,
    false
  );
});

test('perf fixture spec clamps out-of-range values and ignores junk tokens', () => {
  const spec = parsePerfFixtureSpec(
    '/* sqlight:perf-fixture cols=99999 rows=9999999 sets=99 longtext=maybe nonsense */'
  );
  assert.equal(spec?.cols, PERF_FIXTURE_MAX_COLS);
  assert.equal(spec?.rows, PERF_FIXTURE_MAX_ROWS);
  assert.equal(spec?.sets, PERF_FIXTURE_MAX_SETS);
  assert.equal(spec?.longtext, false);

  const zeroed = parsePerfFixtureSpec('/* sqlight:perf-fixture cols=0 rows=0 sets=0 */');
  assert.deepEqual(zeroed, { ...PERF_FIXTURE_DEFAULT_SPEC, cols: 1, rows: 1, sets: 1 });

  const unparsable = parsePerfFixtureSpec('/* sqlight:perf-fixture cols=abc rows= */');
  assert.deepEqual(unparsable, PERF_FIXTURE_DEFAULT_SPEC);
});

test('perf fixture columns cycle through the type mix and are nullable on demand', () => {
  const columns = buildPerfFixtureColumns(8, false);
  assert.equal(columns.length, 8);
  assert.deepEqual(
    columns.map((column) => column.dataType),
    ['int', 'bigint', 'nvarchar', 'bit', 'datetime2', 'decimal', 'uniqueidentifier', 'varbinary']
  );
  assert.deepEqual(
    columns.map((column) => column.ordinal),
    [0, 1, 2, 3, 4, 5, 6, 7]
  );
  assert.equal(columns[1]?.nullable, false, 'non-nullable types stay non-nullable');
  assert.equal(columns[2]?.nullable, true, 'nullable types stay nullable');
  assert.ok(!columns.some((column) => column.dataType === 'nvarchar(max)'));
});

test('perf fixture longtext mode adds nvarchar(max) columns including StmtText', () => {
  const columns = buildPerfFixtureColumns(40, true);
  const longTextColumns = columns.filter((column) => column.dataType === 'nvarchar(max)');
  assert.ok(longTextColumns.length >= 2, 'longtext must add more than one wide column');
  assert.equal(columns[columns.length - 1]?.name, 'StmtText');
  assert.equal(columns[columns.length - 1]?.dataType, 'nvarchar(max)');
  assert.ok(
    longTextColumns.every((column) => column.nullable),
    'wide text columns must be nullable so the NULL path is exercised'
  );
});

test('perf fixture shapes result sets from the requested dimensions', () => {
  const result = buildPerfFixture({ cols: 12, rows: 5, sets: 2 });
  assert.equal(result.resultSets.length, 2);
  assert.equal(result.affectedRows, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0]?.level, 'info');

  for (const set of result.resultSets) {
    assert.equal(set.columns.length, 12);
    assert.equal(set.rows.length, 5);
    assert.equal(set.rowCount, 5);
    assert.equal(set.totalCount, 5);
    assert.ok(Array.isArray(set.rows[0]), 'rows must be positional arrays, not records');
    assert.equal(set.rows[0]?.length, 12);
  }
});

test('perf fixture uses the documented default size', () => {
  const result = buildPerfFixture();
  assert.equal(result.resultSets.length, PERF_FIXTURE_DEFAULT_SPEC.sets);
  assert.equal(result.resultSets[0]?.columns.length, PERF_FIXTURE_DEFAULT_SPEC.cols);
  assert.equal(result.resultSets[0]?.rows.length, PERF_FIXTURE_DEFAULT_SPEC.rows);
});

test('perf fixture is deterministic for a given spec', () => {
  const first = buildPerfFixture({ cols: 9, rows: 40, sets: 2 });
  const second = buildPerfFixture({ cols: 9, rows: 40, sets: 2 });

  assert.deepEqual(first.resultSets, second.resultSets, 'A/B runs must see identical cell data');
  assert.deepEqual(
    first.messages.map((message) => message.message),
    second.messages.map((message) => message.message)
  );
  assert.notDeepEqual(
    first.resultSets[0]!.rows,
    first.resultSets[1]!.rows,
    'each set must use its own seed'
  );
});

test('perf fixture injects NULLs on a fixed cadence and keeps value types honest', () => {
  const result = buildPerfFixture({ cols: 8, rows: 40 });
  const rows = result.resultSets[0]!.rows;
  const nullableIndex = result.resultSets[0]!.columns.findIndex((column) => column.nullable);
  assert.ok(nullableIndex >= 0);

  assert.equal(rows[0]?.[nullableIndex], null, 'row 0 is blank in nullable columns');
  assert.equal(rows[17]?.[nullableIndex], null, 'row 17 repeats the cadence');
  assert.notEqual(rows[1]?.[nullableIndex], null, 'rows in between keep their value');

  const types = result.resultSets[0]!.columns.map((column) => column.dataType);
  const bitRow = rows.find((row) => typeof row[3] === 'boolean');
  assert.ok(bitRow, 'bit columns must emit real booleans');
  assert.ok(
    rows.some((row) => typeof row[0] === 'number'),
    'int columns must emit numbers'
  );

  const binaryIndex = types.indexOf('varbinary');
  assert.ok(binaryIndex >= 0);
  const binaryCell = rows[1]?.[binaryIndex];
  assert.ok(binaryCell && typeof binaryCell === 'object', 'binary columns emit descriptor objects');
  assert.equal((binaryCell as { type: string }).type, 'binary');
  const binaryLength = (binaryCell as { length: number }).length;
  assert.ok(Number.isInteger(binaryLength) && binaryLength >= 16 && binaryLength <= 80);
});
