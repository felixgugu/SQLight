import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildTableUniqueKeysSql,
  formatColumnType,
  MAX_SOURCE_BYTES,
  parseTsv,
  parseUniqueKeys,
  planImportColumns,
  validateCell,
  validateImportRows,
} from '../src/utils/tsvImport';
import type { ColumnItem } from '../src/types/schema';
import type { ResultSet } from '../src/types/query';

function column(name: string, dataType: string, patch: Partial<ColumnItem> = {}): ColumnItem {
  return {
    name,
    dataType,
    maxLength: null,
    precision: null,
    scale: null,
    isNullable: true,
    isPrimaryKey: false,
    isIdentity: false,
    ...patch,
  };
}

function expectValid(raw: string, col: ColumnItem, expected: string | null) {
  const checked = validateCell(raw, { column: planImportColumns([col])[0]!, rawColumn: col });
  assert.equal(checked.ok, true, `${raw} should be valid for ${col.dataType}`);
  assert.equal(checked.value, expected);
}

function expectInvalid(raw: string, col: ColumnItem, reason: string) {
  const checked = validateCell(raw, { column: planImportColumns([col])[0]!, rawColumn: col });
  assert.equal(checked.ok, false, `${raw} should be rejected for ${col.dataType}`);
  assert.equal(checked.reason, reason);
}

test('parseTsv keeps empty fields, handles line endings and reports middle blank lines', () => {
  const parsed = parseTsv('a\t\tc\r\n1\t2\t3\n\nx\t\r', { skipHeader: false });
  assert.equal(parsed.totalLines, 4);
  assert.equal(parsed.headerLine, null);
  assert.deepEqual(parsed.rows.map((row) => row.cells), [
    ['a', '', 'c'],
    ['1', '2', '3'],
    ['x', ''],
  ]);
  assert.deepEqual(parsed.rows.map((row) => row.line), [1, 2, 4]);
  assert.deepEqual(parsed.blankLines, [3]);
});

test('parseTsv skips the header but keeps original line numbers', () => {
  const parsed = parseTsv('id\tname\n1\tAda\n2\tGrace\n', { skipHeader: true });
  assert.equal(parsed.headerLine, 1);
  assert.deepEqual(parsed.rows.map((row) => row.line), [2, 3]);
  assert.deepEqual(parsed.rows[0]!.cells, ['1', 'Ada']);
  assert.deepEqual(parsed.blankLines, []);
});

test('parseTsv ignores trailing newlines and a line made only of tabs stays a data row', () => {
  const parsed = parseTsv('1\t2\n\t\n\n\n', { skipHeader: false });
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[1]!.cells, ['', '']);
  assert.deepEqual(parsed.blankLines, []);
});

test('planImportColumns keeps identity and only drops generated columns', () => {
  const columns = [
    column('Id', 'int', { isIdentity: true, isPrimaryKey: true }),
    column('Name', 'nvarchar', { maxLength: 50, isNullable: false }),
    column('Total', 'decimal', { isComputed: true, precision: 18, scale: 2 }),
    column('Ver', 'timestamp', { isRowVersion: true }),
    column('Email', 'nvarchar', { maxLength: 100, isPrimaryKey: true, isNullable: false }),
  ];

  const plan = planImportColumns(columns);
  assert.deepEqual(plan.map((entry) => entry.name), ['Id', 'Name', 'Email']);
  assert.deepEqual(plan.map((entry) => entry.index), [0, 1, 2]);
  assert.equal(plan[0]!.isIdentity, true);
  assert.equal(plan[0]!.deferRangeToDatabase, true, 'identity range checks belong to the database');
  assert.equal(plan[1]!.deferRangeToDatabase, false);
  assert.equal(formatColumnType(columns[1]!), 'nvarchar(50)');
  assert.equal(formatColumnType(columns[2]!), 'decimal(18, 2)');
});

test('identity columns only get format checking while range goes to the database', () => {
  const identity = column('Id', 'int', { isNullable: false, isIdentity: true, isPrimaryKey: true });
  expectValid('2147483648', identity, '2147483648');
  expectInvalid('abc', identity, '型別不符');
  expectInvalid('\\N', identity, '必填值缺漏');

  const plain = column('Age', 'int', { isNullable: false });
  expectInvalid('2147483648', plain, '型別不符');
});

test('identity columns are excluded from in-file duplicate detection', () => {
  const rawColumns = [
    column('Id', 'int', { isNullable: false, isIdentity: true, isPrimaryKey: true }),
    column('Email', 'nvarchar', { maxLength: 50, isNullable: false }),
  ];
  const columns = planImportColumns(rawColumns);
  const rows = parseTsv('1\ta@x.com\n1\tb@x.com', { skipHeader: false }).rows;

  const identityPk = validateImportRows({ rows, columns, rawColumns });
  assert.equal(identityPk.errors.length, 0, 'duplicate identity values are reported by the database');
  assert.equal(identityPk.validRows, 2);

  const naturalPk = planImportColumns([
    column('Code', 'nvarchar', { maxLength: 10, isNullable: false, isPrimaryKey: true }),
    column('Email', 'nvarchar', { maxLength: 50, isNullable: false }),
  ]);
  const duplicate = validateImportRows({
    rows: parseTsv('A\ta@x.com\nA\tb@x.com', { skipHeader: false }).rows,
    columns: naturalPk,
  });
  assert.ok(duplicate.errors.some((error) => error.reason === '主鍵重複'));
});

test('validateCell enforces integer ranges and normalizes decimals', () => {
  const tiny = column('Tiny', 'tinyint', { isNullable: false });
  expectValid('255', tiny, '255');
  expectInvalid('256', tiny, '型別不符');
  expectInvalid('-1', tiny, '型別不符');

  const big = column('Big', 'bigint', { isNullable: false });
  expectValid('9223372036854775807', big, '9223372036854775807');
  expectInvalid('9223372036854775808', big, '型別不符');

  const amount = column('Amount', 'decimal', { precision: 18, scale: 2, isNullable: false });
  expectValid('12.50', amount, '12.50');
  expectValid('12.5000', amount, '12.50');
  expectInvalid('12.505', amount, '精度超限');
  expectInvalid('12345678901234567.12', amount, '精度超限');
  expectInvalid('12,5', amount, '型別不符');
});

test('validateCell enforces required, NULL and empty value rules', () => {
  const required = column('Name', 'nvarchar', { maxLength: 10, isNullable: false });
  expectValid('Ada', required, 'Ada');
  expectInvalid('\\N', required, '必填值缺漏');
  expectValid('', required, '');

  const optionalNumber = column('Age', 'int', { isNullable: true });
  expectValid('\\N', optionalNumber, null);
  expectInvalid('', optionalNumber, '型別不符');
});

test('validateCell checks text length, GUID, binary, dates and booleans', () => {
  const name = column('Name', 'nvarchar', { maxLength: 3, isNullable: false });
  expectValid('abc', name, 'abc');
  expectInvalid('abcd', name, '長度超限');

  const code = column('Code', 'varchar', { maxLength: 4, isNullable: false });
  expectValid('abcd', code, 'abcd');
  expectInvalid('中文', code, '長度超限');

  const flag = column('Active', 'bit', { isNullable: false });
  expectValid('TRUE', flag, '1');
  expectValid('false', flag, '0');
  expectInvalid('maybe', flag, '型別不符');

  const id = column('Id', 'uniqueidentifier', { isNullable: false });
  expectValid('6f9619ff-8b86-d011-b42d-00c04fc964ff', id, '6F9619FF-8B86-D011-B42D-00C04FC964FF');
  expectInvalid('not-a-guid', id, '型別不符');

  const blob = column('Data', 'varbinary', { isNullable: false });
  expectValid('0x0a0b', blob, '0x0a0b');
  expectInvalid('0x0a0', blob, '型別不符');

  const day = column('Day', 'date', { isNullable: false });
  expectValid('2026-02-28', day, '2026-02-28');
  expectInvalid('2026-02-30', day, '型別不符');

  const created = column('CreatedAt', 'datetime2', { isNullable: false });
  expectValid('2026-09-21 08:30:00', created, '2026-09-21T08:30:00');
  expectInvalid('2026/09/21 08:30', created, '型別不符');

  const offset = column('Seen', 'datetimeoffset', { isNullable: false });
  expectValid('2026-09-21T08:30:00+08:00', offset, '2026-09-21T08:30:00+08:00');
  expectInvalid('2026-09-21T08:30:00', offset, '型別不符');
});

test('validateImportRows reports shape, type and duplicate key problems', () => {
  const rawColumns = [
    column('Id', 'int', { isNullable: false, isPrimaryKey: true }),
    column('Email', 'nvarchar', { maxLength: 50, isNullable: false }),
  ];
  const columns = planImportColumns(rawColumns);
  const parsed = parseTsv(
    ['1\ta@x.com', '2\tb@x.com', '2\tc@x.com', 'x\td@x.com', '5', '6\te@x.com', ''].join('\n'),
    { skipHeader: false }
  );

  const result = validateImportRows({
    rows: parsed.rows,
    blankLines: parsed.blankLines,
    columns,
    rawColumns,
    uniqueKeys: [{ name: 'IX_Email', isPrimaryKey: false, columns: ['Email'] }],
  });

  assert.equal(result.totalRows, 6);
  assert.equal(result.validRows, 3);
  assert.equal(result.invalidRows, 3);
  assert.equal(result.payload.length, 3);
  assert.deepEqual(result.payload[0], { line: 1, values: ['1', 'a@x.com'] });

  const reasons = result.errors.map((error) => error.reason);
  assert.ok(reasons.includes('主鍵重複'), 'duplicate primary key must be reported');
  assert.ok(result.errors.some((error) => error.detail.includes('第 2 列')));
  assert.ok(reasons.includes('欄位數不符'));
  assert.ok(result.errors.some((error) => error.line === 4 && error.reason === '型別不符'));
  assert.ok(result.errors.some((error) => error.line === 5 && error.reason === '欄位數不符'));
  assert.equal(result.preview.length, 6);
});

test('validateImportRows reports blank lines placed between data rows', () => {
  const rawColumns = [column('Id', 'int', { isNullable: false })];
  const columns = planImportColumns(rawColumns);
  const parsed = parseTsv('1\n\n2', { skipHeader: false });

  const result = validateImportRows({
    rows: parsed.rows,
    blankLines: parsed.blankLines,
    columns,
    rawColumns,
  });

  assert.equal(result.totalRows, 3);
  assert.equal(result.validRows, 2);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.line, 2);
  assert.equal(result.errors[0]!.column, '(空白列)');
});

test('validateImportRows flags composite unique keys and skips filtered indexes', () => {
  const rawColumns = [
    column('Tenant', 'int', { isNullable: false }),
    column('Code', 'nvarchar', { maxLength: 10, isNullable: false }),
  ];
  const columns = planImportColumns(rawColumns);

  const rows = parseTsv('1\tA\n1\tA\n2\tA', { skipHeader: false }).rows;
  const withUnique = validateImportRows({
    rows,
    columns,
    rawColumns,
    uniqueKeys: [{ name: 'UQ_Tenant_Code', isPrimaryKey: false, columns: ['Tenant', 'Code'] }],
  });
  assert.equal(withUnique.validRows, 2);
  assert.ok(withUnique.errors.some((error) => error.reason === '唯一值重複'));

  const withoutUnique = validateImportRows({ rows, columns, rawColumns, uniqueKeys: [] });
  assert.equal(withoutUnique.validRows, 3);
  assert.equal(withoutUnique.errors.length, 0);
});

test('unique key metadata is parsed from SQL results and filtered indexes are skipped', () => {
  const resultSet: ResultSet = {
    columns: [
      { name: 'IndexName', dataType: 'nvarchar', nullable: false, ordinal: 0 },
      { name: 'IsPrimaryKey', dataType: 'bit', nullable: false, ordinal: 1 },
      { name: 'HasFilter', dataType: 'bit', nullable: false, ordinal: 2 },
      { name: 'KeyColumns', dataType: 'nvarchar', nullable: false, ordinal: 3 },
    ],
    rows: [
      ['PK_Users', true, false, 'Id ASC'],
      ['UQ_Users_Email', false, false, 'Email ASC, TenantId ASC'],
      ['UQ_Users_Filtered', false, true, 'DisplayName ASC'],
    ],
    rowCount: 3,
  };

  const keys = parseUniqueKeys([resultSet]);
  assert.equal(keys.length, 2);
  assert.deepEqual(keys[0], { name: 'PK_Users', isPrimaryKey: true, columns: ['Id'] });
  assert.deepEqual(keys[1], {
    name: 'UQ_Users_Email',
    isPrimaryKey: false,
    columns: ['Email', 'TenantId'],
  });
});

test('unique key SQL escapes identifiers and source size cap stays documented', () => {
  const sql = buildTableUniqueKeysSql('dbo', "we'ird");
  assert.ok(sql.includes("t.name = N'we''ird'"));
  assert.ok(sql.includes('i.is_unique = 1'));
  assert.equal(MAX_SOURCE_BYTES, 20 * 1024 * 1024);
});

test('import entry points are wired for the Explorer table menu only', () => {
  const sidebar = readFileSync(resolve(process.cwd(), 'src/components/layout/AppSidebar.vue'), 'utf-8');
  const importEntry = sidebar.indexOf("label: 'TSV 匯入 (Import TSV)'");
  const ddlEntry = sidebar.indexOf("label: '產生 CREATE TABLE 腳本'");
  const viewBlock = sidebar.indexOf('if (isView || isProc || isFunc) {');
  assert.ok(importEntry > 0, 'table menu must expose the TSV import entry');
  assert.ok(
    ddlEntry > 0 && importEntry > ddlEntry && viewBlock > importEntry,
    'TSV import must live inside the table-only block'
  );
  assert.match(sidebar, /async function handleTsvImport\(\)/, 'sidebar must open the wizard');

  const app = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf-8');
  assert.match(app, /<TsvImportModal \/>/, 'wizard must be mounted globally');

  const api = readFileSync(resolve(process.cwd(), 'src/services/api.ts'), 'utf-8');
  assert.match(api, /get_table_import_capabilities/);
  assert.match(api, /import_table_rows/);

  const service = readFileSync(resolve(process.cwd(), 'src/services/tsvImportService.ts'), 'utf-8');
  assert.match(service, /'sqlight:import-progress'/, 'progress event name must match the Rust emitter');
});
