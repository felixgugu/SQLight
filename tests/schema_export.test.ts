import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeCsvValue,
  resultSetToCsv,
  combineResultSetsToCsv,
  getTablesAndColumnsSql,
  getIndexesAndKeysSql,
  getProgrammabilityHashSql,
  formatByteSize,
} from '../src/utils/schemaExport';
import type { ColumnDef } from '../src/types/query';

test('escapeCsvValue formats null, strings, commas, quotes and newlines correctly', () => {
  assert.equal(escapeCsvValue(null), '');
  assert.equal(escapeCsvValue(undefined), '');
  assert.equal(escapeCsvValue('simple'), 'simple');
  assert.equal(escapeCsvValue('hello, world'), '"hello, world"');
  assert.equal(escapeCsvValue('He said "Hi"'), '"He said ""Hi"""');
  assert.equal(escapeCsvValue("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.equal(escapeCsvValue({ type: 'binary', length: 16 }), '[Binary 16 Bytes]');
});

test('resultSetToCsv converts tabular data into CSV with UTF-8 BOM', () => {
  const columns: ColumnDef[] = [
    { name: 'Schema', dataType: 'nvarchar', nullable: false, ordinal: 0 },
    { name: 'Table', dataType: 'nvarchar', nullable: false, ordinal: 1 },
    { name: 'Column', dataType: 'nvarchar', nullable: false, ordinal: 2 },
  ];
  const rows = [
    ['dbo', 'Users', 'Id'],
    ['dbo', 'Users', 'User, Name'],
  ];

  const csv = resultSetToCsv(columns, rows);
  // Must start with UTF-8 BOM
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Schema,Table,Column/);
  assert.match(csv, /dbo,Users,"User, Name"/);
});

test('combineResultSetsToCsv aggregates multiple result sets with block dividers', () => {
  const sections = [
    {
      title: '資料表規格',
      columns: [{ name: 'Table', dataType: 'nvarchar', nullable: false, ordinal: 0 }],
      rows: [['Users'], ['Orders']],
    },
    {
      title: '索引規格',
      columns: [{ name: 'Index', dataType: 'nvarchar', nullable: false, ordinal: 0 }],
      rows: [['PK_Users']],
    },
  ];

  const combined = combineResultSetsToCsv(sections);
  assert.ok(combined.startsWith('\uFEFF'));
  assert.match(combined, /區塊 1.*資料表規格/);
  assert.match(combined, /區塊 2.*索引規格/);
  assert.match(combined, /Users/);
  assert.match(combined, /PK_Users/);
});

test('getTablesAndColumnsSql generates valid query scoped to database', () => {
  const sql = getTablesAndColumnsSql('Production_DB');
  assert.match(sql, /USE \[Production_DB\];/);
  assert.match(sql, /sys\.tables/);
  assert.match(sql, /sys\.columns/);
  assert.match(sql, /sys\.types/);
  assert.match(sql, /t\.is_ms_shipped = 0/);
});

test('getIndexesAndKeysSql uses backward-compatible FOR XML PATH aggregation', () => {
  const sql = getIndexesAndKeysSql('CRM_DB');
  assert.match(sql, /USE \[CRM_DB\];/);
  assert.match(sql, /sys\.indexes/);
  assert.match(sql, /FOR XML PATH/);
  assert.match(sql, /STUFF\(/);
});

test('getProgrammabilityHashSql hashes object definitions with SHA2_256', () => {
  const sql = getProgrammabilityHashSql('ERP_DB');
  assert.match(sql, /USE \[ERP_DB\];/);
  assert.match(sql, /sys\.sql_modules/);
  assert.match(sql, /HASHBYTES\('SHA2_256'/);
});

test('formatByteSize formats bytes, KB, and MB accurately', () => {
  assert.equal(formatByteSize(500), '500 B');
  assert.equal(formatByteSize(2048), '2.0 KB');
  assert.equal(formatByteSize(1048576 * 2.5), '2.50 MB');
});
