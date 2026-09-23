/**
 * Dev-only synthetic result-set generator used to build repeatable grid performance
 * baselines. Everything here is a pure function with no IPC or Vue dependency, so the shape,
 * determinism and spec parsing can be covered by the plain Node test suite.
 *
 * The generator is triggered from the SQL editor by a block comment holding the marker
 * `sqlight:perf-fixture` plus optional `key=value` tokens:
 *
 *   sqlight:perf-fixture cols=140 rows=1000 sets=1 longtext=0
 *
 * Only `queryService` decides when the fixture is actually used, and only in dev builds.
 */

import type { CellValue, ColumnDef, QueryMessage, QueryResult, ResultSet } from '../types/query';

export const PERF_FIXTURE_MARKER = 'sqlight:perf-fixture';

export const PERF_FIXTURE_MAX_COLS = 512;
export const PERF_FIXTURE_MAX_ROWS = 50000;
export const PERF_FIXTURE_MAX_SETS = 8;

export const PERF_FIXTURE_SEED = 0x5a17c0de;

export interface PerfFixtureSpec {
  cols: number;
  rows: number;
  sets: number;
  /** Adds nvarchar(max) columns (including a `StmtText` column) to reproduce the heaviest layout. */
  longtext: boolean;
}

export const PERF_FIXTURE_DEFAULT_SPEC: PerfFixtureSpec = {
  cols: 140,
  rows: 1000,
  sets: 1,
  longtext: false,
};

interface FixtureColumnType {
  dataType: string;
  nullable: boolean;
}

/** Mirrors the type mix of a real wide SELECT so no column takes a degenerate fast path. */
const COLUMN_TYPES: FixtureColumnType[] = [
  { dataType: 'int', nullable: false },
  { dataType: 'bigint', nullable: false },
  { dataType: 'nvarchar', nullable: true },
  { dataType: 'bit', nullable: false },
  { dataType: 'datetime2', nullable: true },
  { dataType: 'decimal', nullable: true },
  { dataType: 'uniqueidentifier', nullable: true },
  { dataType: 'varbinary', nullable: true },
];

const LONG_TEXT_COLUMN = 'nvarchar(max)';
const LONG_TEXT_EVERY = 16;

const STMT_TEXT_VALUE =
  'SELECT o.OrderID, o.CustomerID, SUM(od.UnitPrice * od.Quantity) AS Total ' +
  'FROM Sales.Orders AS o JOIN Sales.OrderLines AS od ON od.OrderID = o.OrderID ' +
  'WHERE o.OrderDate >= @start GROUP BY o.OrderID, o.CustomerID ORDER BY Total DESC;';

const NOTE_TEXT_VALUE =
  'line one\nline two\nline three with a longer tail so the cell is measured as multi-line content.';

const MARKER_REGEX = /\/\*\s*sqlight:perf-fixture\b([^*]*)\*\//;
const TOKEN_SPLIT_REGEX = /[\s,;]+/;

function readInt(raw: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function readBool(raw: string): boolean {
  const value = raw.toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * Returns the fixture spec if the SQL carries the dev marker, otherwise null.
 * Unknown tokens are ignored; out-of-range numbers are clamped instead of rejected so a typo
 * still produces a usable (and obviously wrong) fixture rather than a silent no-op.
 */
export function parsePerfFixtureSpec(sql: string | undefined | null): PerfFixtureSpec | null {
  if (!sql) return null;
  const match = MARKER_REGEX.exec(sql);
  if (!match) return null;

  const spec: PerfFixtureSpec = { ...PERF_FIXTURE_DEFAULT_SPEC };
  for (const token of (match[1] ?? '').split(TOKEN_SPLIT_REGEX)) {
    if (!token) continue;
    const separator = token.indexOf('=');
    if (separator <= 0) continue;

    const key = token.slice(0, separator).toLowerCase();
    const raw = token.slice(separator + 1);

    switch (key) {
      case 'cols':
        spec.cols = readInt(raw, spec.cols, PERF_FIXTURE_MAX_COLS);
        break;
      case 'rows':
        spec.rows = readInt(raw, spec.rows, PERF_FIXTURE_MAX_ROWS);
        break;
      case 'sets':
        spec.sets = readInt(raw, spec.sets, PERF_FIXTURE_MAX_SETS);
        break;
      case 'longtext':
        spec.longtext = readBool(raw);
        break;
      default:
        break;
    }
  }
  return spec;
}

/** mulberry32: small, fast, and stable across runs so measurements stay comparable. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPerfFixtureColumns(cols: number, longtext: boolean): ColumnDef[] {
  return Array.from({ length: cols }, (_, index) => {
    const isLast = index === cols - 1;
    const isLongText =
      longtext && (isLast || index % LONG_TEXT_EVERY === 3);
    const base = COLUMN_TYPES[index % COLUMN_TYPES.length]!;

    if (isLongText) {
      return {
        name: isLast ? 'StmtText' : `Column_${index + 1}`,
        dataType: LONG_TEXT_COLUMN,
        nullable: true,
        ordinal: index,
      };
    }
    return {
      name: `Column_${index + 1}`,
      dataType: base.dataType,
      nullable: base.nullable,
      ordinal: index,
    };
  });
}

function randomGuid(random: () => number): string {
  const hex = () =>
    Math.floor(random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}

function randomTimestamp(random: () => number): string {
  const month = String(1 + Math.floor(random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(random() * 28)).padStart(2, '0');
  const hour = String(Math.floor(random() * 24)).padStart(2, '0');
  const minute = String(Math.floor(random() * 60)).padStart(2, '0');
  const second = String(Math.floor(random() * 60)).padStart(2, '0');
  return `2026-${month}-${day}T${hour}:${minute}:${second}.0000000`;
}

function buildValue(column: ColumnDef, random: () => number, rowIndex: number): CellValue {
  // Deterministic NULL distribution: every 17th row blanks out the nullable columns.
  if (column.nullable && rowIndex % 17 === 0) return null;

  switch (column.dataType) {
    case 'int':
      return Math.floor(random() * 100000);
    case 'bigint':
      return String(9000000000000000 + Math.floor(random() * 1000000));
    case 'nvarchar':
      return `value_${Math.floor(random() * 1000000)}`;
    case LONG_TEXT_COLUMN:
      return column.name === 'StmtText' ? STMT_TEXT_VALUE : NOTE_TEXT_VALUE;
    case 'bit':
      return random() < 0.5;
    case 'datetime2':
      return randomTimestamp(random);
    case 'decimal':
      return Math.round(random() * 100000) / 100;
    case 'uniqueidentifier':
      return randomGuid(random);
    case 'varbinary':
      return { type: 'binary', length: 16 + Math.floor(random() * 64) };
    default:
      return String(Math.floor(random() * 1000));
  }
}

function buildResultSet(
  columns: ColumnDef[],
  rows: number,
  seed: number
): ResultSet {
  const random = createRandom(seed);
  const data: CellValue[][] = new Array(rows);
  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
    const row: CellValue[] = new Array(columns.length);
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      row[colIndex] = buildValue(columns[colIndex]!, random, rowIndex);
    }
    data[rowIndex] = row;
  }
  return { columns, rows: data, rowCount: rows, totalCount: rows };
}

/**
 * Builds the synthetic query result. Volatile on purpose for large inputs (it allocates the
 * whole grid payload), but fully deterministic for a given spec so A/B runs are comparable.
 */
export function buildPerfFixture(spec: Partial<PerfFixtureSpec> = {}): QueryResult {
  const resolved: PerfFixtureSpec = {
    cols: Math.min(Math.max(Math.trunc(spec.cols ?? PERF_FIXTURE_DEFAULT_SPEC.cols) || 1, 1), PERF_FIXTURE_MAX_COLS),
    rows: Math.min(Math.max(Math.trunc(spec.rows ?? PERF_FIXTURE_DEFAULT_SPEC.rows) || 1, 1), PERF_FIXTURE_MAX_ROWS),
    sets: Math.min(Math.max(Math.trunc(spec.sets ?? PERF_FIXTURE_DEFAULT_SPEC.sets) || 1, 1), PERF_FIXTURE_MAX_SETS),
    longtext: spec.longtext ?? PERF_FIXTURE_DEFAULT_SPEC.longtext,
  };

  const columns = buildPerfFixtureColumns(resolved.cols, resolved.longtext);
  const resultSets: ResultSet[] = [];
  for (let setIndex = 0; setIndex < resolved.sets; setIndex++) {
    resultSets.push(buildResultSet(columns, resolved.rows, PERF_FIXTURE_SEED + setIndex));
  }

  const messages: QueryMessage[] = [
    {
      level: 'info',
      message:
        `[perf-fixture] ${resolved.cols} cols x ${resolved.rows} rows x ${resolved.sets} set(s)` +
        `${resolved.longtext ? ' (longtext)' : ''} - synthetic data, no server round trip.`,
      timestamp: new Date().toISOString(),
    },
  ];

  return { resultSets, messages, affectedRows: 0, executionTimeMs: 0 };
}
