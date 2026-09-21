import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { ColumnDef, CellValue } from '../src/types/query';
import {
  detectSpecialType,
  formatDataViewFields,
  filterDataViewFields,
  formatRowForJson,
  formatRowForTsv,
  formatRowForMarkdown,
} from '../src/utils/dataViewFormatters';
import { exportRowAsJson, exportRowsAsMarkdown } from '../src/utils/exportFormatters';
import { formatCellForExport } from '../src/composables/useColumnAutoWidth';

describe('Data View: Field Formatting & Type Detection', () => {
  test('detects NULL values properly', () => {
    assert.deepEqual(detectSpecialType(null), { specialType: 'null', displayValue: 'NULL' });
    assert.deepEqual(detectSpecialType(undefined), { specialType: 'null', displayValue: 'NULL' });
  });

  test('detects empty strings properly', () => {
    assert.deepEqual(detectSpecialType(''), { specialType: 'empty', displayValue: '' });
  });

  test('detects boolean values properly', () => {
    assert.deepEqual(detectSpecialType(true), { specialType: 'boolean', displayValue: 'TRUE' });
    assert.deepEqual(detectSpecialType(false), { specialType: 'boolean', displayValue: 'FALSE' });
  });

  test('detects binary object properly', () => {
    const bin = { type: 'binary', length: 32 };
    const res = detectSpecialType(bin);
    assert.equal(res.specialType, 'binary');
    assert.equal(res.displayValue, '[Binary 32 B]');
  });

  test('detects JSON strings properly and formats them', () => {
    const jsonStr = '{"name": "Alice", "age": 30}';
    const res = detectSpecialType(jsonStr);
    assert.equal(res.specialType, 'json');
    assert.ok(res.formattedJson?.includes('"name": "Alice"'));
  });

  test('detects JSON array strings properly', () => {
    const jsonArr = '[1, 2, 3]';
    const res = detectSpecialType(jsonArr);
    assert.equal(res.specialType, 'json');
    assert.ok(res.formattedJson?.includes('1'));
  });

  test('formats horizontal row into vertical two-column field list preserving order', () => {
    const columns: ColumnDef[] = [
      { name: 'id', dataType: 'int', nullable: false },
      { name: 'name', dataType: 'nvarchar(50)', nullable: false },
      { name: 'email', dataType: 'nvarchar(100)', nullable: true },
      { name: 'status', dataType: 'varchar(20)', nullable: false },
      { name: 'is_active', dataType: 'bit', nullable: false },
    ];
    const row: CellValue[] = [1, 'Tom', 'tom@example.com', 'Active', true];
    const pkSet = new Set(['id']);

    const fields = formatDataViewFields(columns, row, pkSet);

    assert.equal(fields.length, 5);
    assert.equal(fields[0]?.name, 'id');
    assert.equal(fields[0]?.value, 1);
    assert.equal(fields[0]?.isPrimaryKey, true);

    assert.equal(fields[1]?.name, 'name');
    assert.equal(fields[1]?.displayValue, 'Tom');

    assert.equal(fields[2]?.name, 'email');
    assert.equal(fields[2]?.displayValue, 'tom@example.com');

    assert.equal(fields[4]?.name, 'is_active');
    assert.equal(fields[4]?.specialType, 'boolean');
    assert.equal(fields[4]?.displayValue, 'TRUE');
  });
});

describe('Data View: Real-time Filtering', () => {
  const columns: ColumnDef[] = [
    { name: 'user_id', dataType: 'int', nullable: false },
    { name: 'username', dataType: 'nvarchar(50)', nullable: false },
    { name: 'email', dataType: 'nvarchar(100)', nullable: true },
    { name: 'bio', dataType: 'nvarchar(max)', nullable: true },
    { name: 'role', dataType: 'varchar(20)', nullable: false },
  ];
  const row: CellValue[] = [1001, 'alex_chen', 'alex@example.com', 'Senior Developer & DBA', 'Admin'];
  const fields = formatDataViewFields(columns, row);

  test('matches by column name (case-insensitive)', () => {
    const filtered = filterDataViewFields(fields, 'USER');
    // user_id, username
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0]?.name, 'user_id');
    assert.equal(filtered[1]?.name, 'username');
  });

  test('matches by column value (case-insensitive)', () => {
    const filtered = filterDataViewFields(fields, 'dba');
    // bio has 'Senior Developer & DBA'
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, 'bio');
  });

  test('matches both column name and column value', () => {
    // 'admin' matches role column value 'Admin'
    const filtered = filterDataViewFields(fields, 'admin');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, 'role');
  });

  test('clearing query restores all fields', () => {
    const filtered = filterDataViewFields(fields, '');
    assert.equal(filtered.length, fields.length);

    const filteredWhitespace = filterDataViewFields(fields, '   ');
    assert.equal(filteredWhitespace.length, fields.length);
  });

  test('non-matching query returns empty array without errors', () => {
    const filtered = filterDataViewFields(fields, 'non_existent_token_xyz');
    assert.equal(filtered.length, 0);
  });
});

describe('Data View: Copy Operations and Consistency with Existing Features', () => {
  const columns: ColumnDef[] = [
    { name: 'id', dataType: 'int', nullable: false },
    { name: 'name', dataType: 'nvarchar(50)', nullable: false },
    { name: 'email', dataType: 'nvarchar(100)', nullable: true },
    { name: 'status', dataType: 'varchar(20)', nullable: false },
  ];
  const row: CellValue[] = [1, 'Tom', 'tom@example.com', 'Active'];

  test('copy as JSON matches exportRowAsJson output exactly', () => {
    const expected = exportRowAsJson(columns, row);
    const actual = formatRowForJson(columns, row);
    assert.equal(actual, expected);

    const parsed = JSON.parse(actual);
    assert.deepEqual(parsed, {
      id: 1,
      name: 'Tom',
      email: 'tom@example.com',
      status: 'Active',
    });
  });

  test('copy as TSV matches formatCellForExport row mapping', () => {
    const expected = row.map(formatCellForExport).join('\t');
    const actual = formatRowForTsv(row);
    assert.equal(actual, expected);
    assert.equal(actual, '1\tTom\ttom@example.com\tActive');
  });

  test('copy as Markdown table matches exportRowsAsMarkdown output exactly', () => {
    const expected = exportRowsAsMarkdown(columns, [row]);
    const actual = formatRowForMarkdown(columns, row);
    assert.equal(actual, expected);
    assert.ok(actual.includes('| id | name | email | status |'));
    assert.ok(actual.includes('| 1 | Tom | tom@example.com | Active |'));
  });

  test('copying copies complete original row even when filtered', () => {
    // 即使在畫面上僅顯示過濾出的 1 個欄位，針對原始資料列的複製依舊是完整全部欄位
    const fields = formatDataViewFields(columns, row);
    const filtered = filterDataViewFields(fields, 'Active');
    assert.equal(filtered.length, 1);

    // 複製仍傳入原始 columns 與 row
    const jsonOutput = formatRowForJson(columns, row);
    const parsed = JSON.parse(jsonOutput);
    assert.equal(Object.keys(parsed).length, 4);
    assert.equal(parsed.id, 1);
    assert.equal(parsed.email, 'tom@example.com');
  });
});
