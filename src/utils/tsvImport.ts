/**
 * Pure helpers for the TSV import wizard: parsing, column planning and pre-validation.
 * No Vue / IPC / DOM dependencies so everything here is unit testable.
 */

import type { ColumnItem } from '@/types/schema';
import type { ResultSet } from '@/types/query';
import type {
  ImportColumnPlan,
  ImportErrorReason,
  ImportPayloadRow,
  ImportValidationError,
  ImportValidationResult,
  ParsedRow,
  ParsedTsv,
  UniqueKeyPlan,
} from '@/types/tsvImport';

/** Explicit NULL marker recommended by the import spec. */
export const NULL_SENTINEL = '\\N';
export const PREVIEW_ROW_LIMIT = 20;
export const MAX_DISPLAYED_ERRORS = 100;
/** Source size cap (file upload or pasted text). */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

const RE_INTEGER = /^[+-]?\d+$/;
const RE_DECIMAL = /^[+-]?\d+(\.\d+)?$/;
const RE_FLOAT = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const RE_GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RE_HEX = /^0[xX][0-9a-fA-F]*$/;
const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_TIME = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/;
const RE_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/;
const RE_DATETIME_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?(Z|[+-]\d{2}:\d{2})$/;

const TEXT_TYPES = new Set(['char', 'varchar', 'nchar', 'nvarchar', 'text', 'ntext', 'xml', 'sysname']);
const UNICODE_TEXT_TYPES = new Set(['nchar', 'nvarchar', 'ntext', 'sysname']);
const INTEGER_TYPES = new Set(['tinyint', 'smallint', 'int', 'bigint']);
const DECIMAL_TYPES = new Set(['decimal', 'numeric']);
const MONEY_TYPES = new Set(['money', 'smallmoney']);
const BINARY_TYPES = new Set(['binary', 'varbinary', 'image']);

/** Splits raw TSV text into data rows, preserving empty fields produced by tabs. */
export function parseTsv(text: string, options: { skipHeader: boolean }): ParsedTsv {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.split(/\r\n|\n|\r/);

  // A trailing newline (or several) must not create phantom rows.
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  let headerLine: number | null = null;
  const totalLines = lines.length;
  if (options.skipHeader && lines.length > 0) {
    lines.shift();
    headerLine = 1;
  }

  const rows: ParsedRow[] = [];
  const blankLines: number[] = [];
  const firstDataLine = headerLine === null ? 1 : 2;

  lines.forEach((line, idx) => {
    const lineNumber = firstDataLine + idx;
    // A line made only of tabs is a valid all-empty row; a truly empty line is not.
    if (line === '' || (line.trim() === '' && !line.includes('\t'))) {
      blankLines.push(lineNumber);
      return;
    }
    rows.push({ line: lineNumber, cells: line.split('\t') });
  });

  return { rows, blankLines, headerLine, totalLines };
}

export function countUtf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function isGeneratedColumn(column: ColumnItem): boolean {
  return Boolean(column.isComputed) || Boolean(column.isRowVersion);
}

export function formatColumnType(column: ColumnItem): string {
  const type = column.dataType.toLowerCase();
  const maxLength = column.maxLength ?? null;
  if (UNICODE_TEXT_TYPES.has(type) || ['char', 'varchar', 'binary', 'varbinary'].includes(type)) {
    if (maxLength === -1) return `${type}(max)`;
    if (maxLength != null && maxLength > 0) return `${type}(${maxLength})`;
  }
  if (DECIMAL_TYPES.has(type) && column.precision != null && column.scale != null) {
    return `${type}(${column.precision}, ${column.scale})`;
  }
  return type;
}

/**
 * Positional import columns: table order, without generated columns.
 *
 * Identity columns are always part of the payload (the checkbox only controls
 * `SET IDENTITY_INSERT`), so the TSV always matches the full writable column list.
 */
export function planImportColumns(columns: ColumnItem[]): ImportColumnPlan[] {
  return columns
    .filter((column) => !isGeneratedColumn(column))
    .map((column, index) => ({
      index,
      name: column.name,
      dataType: column.dataType.toLowerCase(),
      fullType: formatColumnType(column),
      nullable: column.isNullable,
      isPrimaryKey: column.isPrimaryKey,
      isIdentity: column.isIdentity,
      deferRangeToDatabase: column.isIdentity,
    }));
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return day <= (month === 2 && isLeap ? 29 : daysInMonth);
}

function isRealTime(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59;
}

export interface CellCheck {
  ok: boolean;
  value?: string | null;
  reason?: ImportErrorReason;
  detail?: string;
}

function checkDecimal(
  text: string,
  precision: number | null,
  scale: number | null,
  label: string
): CellCheck {
  if (!RE_DECIMAL.test(text)) {
    return { ok: false, reason: '型別不符', detail: `${label} 必須是數值` };
  }
  const negative = text.startsWith('-');
  const unsigned = text.replace(/^[+-]/, '');
  const [intPartRaw = '', decimalsRaw = ''] = unsigned.split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const effectiveScale = scale ?? decimalsRaw.length;
  if (scale != null && decimalsRaw.length > effectiveScale) {
    const extra = decimalsRaw.slice(effectiveScale);
    if (extra.split('').some((char) => char !== '0')) {
      return { ok: false, reason: '精度超限', detail: `${label} 的小數位最多 ${scale} 位` };
    }
  }
  const keptDecimals = decimalsRaw.slice(0, effectiveScale);
  if (precision != null) {
    const digits = (intPart.length === 0 ? 1 : intPart.length) + effectiveScale;
    if (digits > precision) {
      return { ok: false, reason: '精度超限', detail: `${label} 的總位數最多 ${precision} 位` };
    }
  }
  const normalized = `${negative ? '-' : ''}${intPart.length ? intPart : '0'}${
    keptDecimals.length ? `.${keptDecimals}` : ''
  }`;
  return { ok: true, value: normalized };
}

function checkInteger(text: string, dataType: string, skipRange: boolean): CellCheck {
  if (!RE_INTEGER.test(text)) {
    return { ok: false, reason: '型別不符', detail: '必須是整數' };
  }
  if (skipRange) {
    return { ok: true, value: text.replace(/^\+/, '') };
  }
  const limits: Record<string, [bigint, bigint]> = {
    tinyint: [0n, 255n],
    smallint: [-32768n, 32767n],
    int: [-2147483648n, 2147483647n],
    bigint: [-9223372036854775808n, 9223372036854775807n],
  };
  const limit = limits[dataType];
  if (limit) {
    const value = BigInt(text);
    if (value < limit[0] || value > limit[1]) {
      return { ok: false, reason: '型別不符', detail: `超出 ${dataType} 的範圍` };
    }
  }
  return { ok: true, value: text.replace(/^\+/, '') };
}

function checkTextLength(
  text: string,
  column: ImportColumnPlan,
  rawColumn: ColumnItem | undefined
): CellCheck {
  const maxLength = rawColumn?.maxLength ?? null;
  if (maxLength == null || maxLength < 0) return { ok: true, value: text };
  const isUnicode = UNICODE_TEXT_TYPES.has(column.dataType);
  const length = isUnicode ? [...text].length : countUtf8Bytes(text);
  if (length > maxLength) {
    return {
      ok: false,
      reason: '長度超限',
      detail: `${isUnicode ? '字元' : '位元組'}長度 ${length} 超過上限 ${maxLength}`,
    };
  }
  return { ok: true, value: text };
}

export interface CellValidationContext {
  column: ImportColumnPlan;
  rawColumn?: ColumnItem;
}

/** Validates and normalizes one cell. `null` means SQL NULL. */
export function validateCell(raw: string, context: CellValidationContext): CellCheck {
  const { column, rawColumn } = context;
  const isText = TEXT_TYPES.has(column.dataType);

  if (raw === NULL_SENTINEL) {
    if (!column.nullable) {
      return { ok: false, reason: '必填值缺漏', detail: '欄位不可為 NULL' };
    }
    return { ok: true, value: null };
  }

  if (raw === '') {
    if (isText) return checkTextLength('', column, rawColumn);
    return { ok: false, reason: '型別不符', detail: '空值請以 \\N 表示 NULL，或提供實際內容' };
  }

  const dataType = column.dataType;
  if (dataType === 'bit') {
    const lowered = raw.toLowerCase();
    if (lowered === '1' || lowered === 'true') return { ok: true, value: '1' };
    if (lowered === '0' || lowered === 'false') return { ok: true, value: '0' };
    return { ok: false, reason: '型別不符', detail: '必須是 1/0 或 true/false' };
  }
  if (INTEGER_TYPES.has(dataType)) {
    return checkInteger(raw, dataType, column.deferRangeToDatabase);
  }
  if (DECIMAL_TYPES.has(dataType)) {
    return checkDecimal(raw, rawColumn?.precision ?? null, rawColumn?.scale ?? null, '數值');
  }
  if (MONEY_TYPES.has(dataType)) {
    return checkDecimal(raw, null, 4, dataType === 'money' ? 'money' : 'smallmoney');
  }
  if (dataType === 'float' || dataType === 'real') {
    return RE_FLOAT.test(raw)
      ? { ok: true, value: raw }
      : { ok: false, reason: '型別不符', detail: '必須是浮點數' };
  }
  if (dataType === 'uniqueidentifier') {
    return RE_GUID.test(raw)
      ? { ok: true, value: raw.toUpperCase() }
      : { ok: false, reason: '型別不符', detail: '必須是 GUID 格式' };
  }
  if (BINARY_TYPES.has(dataType)) {
    const normalized = raw.replace(/^0X/, '0x');
    if (!RE_HEX.test(normalized) || normalized.length === 2 || (normalized.length - 2) % 2 !== 0) {
      return { ok: false, reason: '型別不符', detail: '必須是 0x 開頭的偶數長度十六進位字串' };
    }
    return { ok: true, value: normalized };
  }
  if (dataType === 'date') {
    const match = RE_DATE.exec(raw);
    if (!match) return { ok: false, reason: '型別不符', detail: '必須是 YYYY-MM-DD' };
    const [, year, month, day] = match;
    if (!isRealDate(Number(year), Number(month), Number(day))) {
      return { ok: false, reason: '型別不符', detail: '日期不存在' };
    }
    return { ok: true, value: raw };
  }
  if (dataType === 'time') {
    const match = RE_TIME.exec(raw);
    if (!match) return { ok: false, reason: '型別不符', detail: '必須是 hh:mm[:ss[.fffffff]]' };
    if (!isRealTime(Number(match[1]), Number(match[2]), Number(match[3] ?? 0))) {
      return { ok: false, reason: '型別不符', detail: '時間不存在' };
    }
    return { ok: true, value: raw };
  }
  if (dataType === 'datetime' || dataType === 'smalldatetime' || dataType === 'datetime2') {
    const match = RE_DATETIME.exec(raw);
    if (!match) {
      return { ok: false, reason: '型別不符', detail: '必須是 YYYY-MM-DDThh:mm[:ss[.fffffff]]' };
    }
    const [, year, month, day, hour, minute, second] = match;
    if (
      !isRealDate(Number(year), Number(month), Number(day)) ||
      !isRealTime(Number(hour), Number(minute), Number(second ?? 0))
    ) {
      return { ok: false, reason: '型別不符', detail: '日期或時間不存在' };
    }
    if (dataType === 'smalldatetime' && Number(year) < 1900) {
      return { ok: false, reason: '型別不符', detail: 'smalldatetime 不支援 1900 年之前的日期' };
    }
    return { ok: true, value: raw.replace(' ', 'T') };
  }
  if (dataType === 'datetimeoffset') {
    const match = RE_DATETIME_OFFSET.exec(raw);
    if (!match) {
      return { ok: false, reason: '型別不符', detail: '必須包含時區位移，例如 2026-01-01T10:00:00+08:00' };
    }
    const [, year, month, day, hour, minute, second, , offsetRaw] = match;
    const offset = offsetRaw ?? '';
    if (
      !isRealDate(Number(year), Number(month), Number(day)) ||
      !isRealTime(Number(hour), Number(minute), Number(second ?? 0))
    ) {
      return { ok: false, reason: '型別不符', detail: '日期或時間不存在' };
    }
    if (offset !== 'Z') {
      const [offsetHour, offsetMinute] = offset.slice(1).split(':');
      if (Number(offsetHour) > 14 || Number(offsetMinute) > 59) {
        return { ok: false, reason: '型別不符', detail: '時區位移超出範圍' };
      }
    }
    return { ok: true, value: raw.replace(' ', 'T') };
  }
  if (isText) return checkTextLength(raw, column, rawColumn);

  // Unknown / unsupported types (geography, hierarchyid, ...) are handed to the database.
  return { ok: true, value: raw };
}

function resolveRawColumns(
  columns: ImportColumnPlan[],
  rawColumns?: ColumnItem[]
): (ColumnItem | undefined)[] {
  if (!rawColumns || rawColumns.length === 0) return columns.map(() => undefined);
  const byName = new Map(rawColumns.map((column) => [column.name.toLowerCase(), column]));
  return columns.map((column) => byName.get(column.name.toLowerCase()));
}

/**
 * Validates every parsed row against the positional column plan, including in-file primary
 * key / unique index duplicates. Any error blocks the import.
 */
export function validateImportRows(options: {
  rows: ParsedRow[];
  columns: ImportColumnPlan[];
  blankLines?: number[];
  rawColumns?: ColumnItem[];
  uniqueKeys?: UniqueKeyPlan[];
}): ImportValidationResult {
  const { rows, columns, blankLines = [], uniqueKeys = [] } = options;
  const rawColumnByIndex = resolveRawColumns(columns, options.rawColumns);
  const errors: ImportValidationError[] = [];
  const payload: ImportPayloadRow[] = [];
  let validRows = 0;

  blankLines.forEach((line) => {
    errors.push({
      line,
      columnPosition: 0,
      column: '(空白列)',
      rawValue: '',
      reason: '欄位數不符',
      detail: '資料中間出現空白列，請移除後再匯入',
    });
  });

  // In-file duplicate detection skips every key that involves an identity column: those
  // values are range/duplicate checked by the database at write time.
  const identityColumns = new Set(
    columns.filter((column) => column.isIdentity).map((column) => column.name)
  );
  const keys: UniqueKeyPlan[] = [];
  const primaryKey = columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
  if (primaryKey.length > 0 && primaryKey.every((name) => !identityColumns.has(name))) {
    keys.push({ name: 'PRIMARY KEY', isPrimaryKey: true, columns: primaryKey });
  }
  uniqueKeys.forEach((key) => {
    if (key.isPrimaryKey) return;
    if (key.columns.some((name) => identityColumns.has(name))) return;
    keys.push(key);
  });

  const seenKeys = new Map<string, { line: number }>();

  rows.forEach((row) => {
    if (row.cells.length !== columns.length) {
      errors.push({
        line: row.line,
        columnPosition: 0,
        column: columns.map((column) => column.name).join(', ') || '(無欄位)',
        rawValue: row.cells.join('\t'),
        reason: '欄位數不符',
        detail: `預期 ${columns.length} 欄，實際 ${row.cells.length} 欄`,
      });
      return;
    }

    const values: (string | null)[] = [];
    let rowFailed = false;
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index]!;
      const raw = row.cells[index] ?? '';
      const checked = validateCell(raw, { column, rawColumn: rawColumnByIndex[index] });
      if (!checked.ok) {
        rowFailed = true;
        errors.push({
          line: row.line,
          columnPosition: index + 1,
          column: column.name,
          rawValue: raw,
          reason: checked.reason ?? '型別不符',
          detail: checked.detail ?? '欄位值無效',
        });
        continue;
      }
      values.push(checked.value ?? null);
    }
    if (rowFailed) return;

    for (const key of keys) {
      const positions = key.columns.map((name) => columns.findIndex((column) => column.name === name));
      if (positions.some((position) => position < 0)) continue;
      const keyValue = positions
        .map((position) => {
          const value = values[position];
          return value === null || value === undefined ? '\u0000NULL' : value;
        })
        .join('\u0001');
      const signature = `${key.name}\u0002${keyValue}`;
      const previous = seenKeys.get(signature);
      if (previous) {
        rowFailed = true;
        errors.push({
          line: row.line,
          columnPosition: positions[0]! + 1,
          column: key.columns.join(', '),
          rawValue: positions.map((position) => row.cells[position] ?? '').join('\t'),
          reason: key.isPrimaryKey ? '主鍵重複' : '唯一值重複',
          detail: `${key.isPrimaryKey ? '主鍵' : `唯一索引 ${key.name}`} 與第 ${previous.line} 列重複`,
        });
        break;
      }
      seenKeys.set(signature, { line: row.line });
    }
    if (rowFailed) return;

    validRows += 1;
    payload.push({ line: row.line, values });
  });

  const totalRows = rows.length + blankLines.length;
  return {
    totalRows,
    validRows,
    invalidRows: totalRows - validRows,
    errors,
    payload,
    preview: rows.slice(0, PREVIEW_ROW_LIMIT),
  };
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Unique indexes (non filtered) of one table, used for in-file duplicate detection. */
export function buildTableUniqueKeysSql(schema: string, table: string): string {
  return `SELECT
    s.name AS [Schema],
    t.name AS [Table],
    i.name AS [IndexName],
    i.is_primary_key AS [IsPrimaryKey],
    i.is_unique AS [IsUnique],
    i.has_filter AS [HasFilter],
    ISNULL(STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, ''), '') AS [KeyColumns]
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
INNER JOIN sys.indexes i ON i.object_id = t.object_id
WHERE t.is_ms_shipped = 0
  AND i.is_unique = 1
  AND i.name IS NOT NULL
  AND t.name = N'${escapeSqlLiteral(table)}'
  AND s.name = N'${escapeSqlLiteral(schema)}'
ORDER BY [IndexName];`;
}

/** Parses the result of {@link buildTableUniqueKeysSql}; unknown shapes are ignored. */
export function parseUniqueKeys(resultSets: ResultSet[] | undefined): UniqueKeyPlan[] {
  const resultSet = resultSets?.[0];
  if (!resultSet) return [];
  const indexOf = (names: string[]): number =>
    resultSet.columns.findIndex((column) => names.includes(column.name.toLowerCase()));
  const nameIdx = indexOf(['indexname']);
  const pkIdx = indexOf(['isprimarykey', 'ispk']);
  const filterIdx = indexOf(['hasfilter']);
  const columnsIdx = indexOf(['keycolumns']);
  if (nameIdx === -1 || columnsIdx === -1) return [];

  return resultSet.rows
    .map((row) => {
      const name = String(row[nameIdx] ?? '');
      const hasFilter = filterIdx === -1 ? false : Boolean(row[filterIdx]);
      const columns = String(row[columnsIdx] ?? '')
        .split(',')
        .map((part) => part.trim().replace(/\s+(ASC|DESC)$/i, ''))
        .filter((part) => part.length > 0);
      return {
        name,
        isPrimaryKey: pkIdx === -1 ? false : Boolean(row[pkIdx]),
        hasFilter,
        columns,
      };
    })
    .filter((key) => key.name.length > 0 && key.columns.length > 0 && !key.hasFilter)
    .map(({ name, isPrimaryKey, columns }) => ({ name, isPrimaryKey, columns }));
}
