import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useGridSelection } from '../src/composables/useGridSelection';
import { computeFrameStats, isGridPerfDiagEnabled } from '../src/composables/useGridPerfDiag';
import type { ColumnDef, CellValue } from '../src/types/query';

function makeColumns(count: number): ColumnDef[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `C${i}`,
    dataType: 'int',
    nullable: false,
    ordinal: i,
  }));
}

function makeContainerStub() {
  let queries = 0;
  const container = {
    querySelector: () => {
      queries++;
      return null;
    },
    querySelectorAll: () => {
      queries++;
      return [] as unknown as NodeListOf<Element>;
    },
  } as unknown as HTMLElement;
  return { container, getQueries: () => queries };
}

test('computeFrameStats summarises samples with p95 and frame budget overruns', () => {
  const stats = computeFrameStats([16, 16, 16, 40]);
  assert.equal(stats.frames, 4);
  assert.equal(stats.avgMs, 22);
  assert.equal(stats.maxMs, 40);
  assert.equal(stats.p95Ms, 40);
  assert.equal(stats.overBudgetFrames, 1);
  assert.ok(stats.fps > 0);
  assert.deepEqual(computeFrameStats([]), {
    frames: 0,
    avgMs: 0,
    p95Ms: 0,
    maxMs: 0,
    fps: 0,
    overBudgetFrames: 0,
  });
});

test('perf HUD stays disabled outside an explicit dev opt-in', () => {
  assert.equal(isGridPerfDiagEnabled(), false);
});

test('visual column indices are cached and invalidated on demand', () => {
  const columns = makeColumns(3);
  let apiOrder = ['row_index', 'col_0', 'col_2', 'col_1'];
  const api = {
    getAllGridColumns: () => apiOrder.map((id) => ({ getColId: () => id })),
    getFirstDisplayedRowIndex: () => 0,
    getLastDisplayedRowIndex: () => 9,
  };
  const rows: CellValue[][] = [
    [1, 2, 3],
    [4, 5, 6],
  ];

  const selection = useGridSelection({
    getRows: () => rows,
    getColumns: () => columns,
    getGridApi: () => api as never,
    getGridContainer: () => null,
  });

  const first = selection.getVisualDataColIndices();
  assert.deepEqual(first, [0, 2, 1], 'visual order follows the displayed column order');
  assert.equal(selection.getVisualDataColIndices(), first, 'repeat calls reuse the cache');

  apiOrder = ['row_index', 'col_1', 'col_0', 'col_2'];
  assert.equal(selection.getVisualDataColIndices(), first, 'cache survives until invalidated');

  selection.invalidateVisualColIndices();
  const second = selection.getVisualDataColIndices();
  assert.notEqual(second, first, 'invalidation forces a rebuild');
  assert.deepEqual(second, [1, 0, 2]);
});

test('scroll handling with no selection never walks the cell DOM', () => {
  const columns = makeColumns(4);
  const rows: CellValue[][] = [[1, 2, 3, 4]];
  const { container, getQueries } = makeContainerStub();

  const selection = useGridSelection({
    getRows: () => rows,
    getColumns: () => columns,
    getGridApi: () => ({ getAllGridColumns: () => [] }) as never,
    getGridContainer: () => container,
  });

  selection.onBodyScroll();
  assert.equal(getQueries(), 0, 'scroll without selection must be free');

  selection.updateSelectionHighlight();
  assert.ok(
    getQueries() <= 2,
    'two cheap probes are enough to prove nothing is highlighted; the cell DOM must not be walked'
  );
});

test('scroll handling with a selection still refreshes the highlight', () => {
  const columns = makeColumns(4);
  const rows: CellValue[][] = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ];
  const { container, getQueries } = makeContainerStub();

  const selection = useGridSelection({
    getRows: () => rows,
    getColumns: () => columns,
    getGridApi: () => ({ getAllGridColumns: () => [] }) as never,
    getGridContainer: () => container,
  });

  selection.selectAll();
  const before = getQueries();
  selection.updateSelectionHighlight();
  assert.ok(getQueries() > before, 'an active selection must rescan the rendered cells');
});

test('result grid hands AG Grid raw row data instead of reactive proxies', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );
  assert.match(source, /:row-data="gridRowData"/, 'grid must bind the raw row-data computed');
  assert.match(source, /toRaw\(rows\)/, 'row data must be unwrapped with toRaw');
  assert.doesNotMatch(
    source,
    /:row-data="resultSet\.rows"/,
    'reactive proxies must not be handed to AG Grid'
  );
});

test('grid scroll path avoids per-frame paint and listener costs', () => {
  const gridSource = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );
  const selectedRule = /:deep\(\.sqlight-cell-selected\)\s*\{([^}]*)\}/.exec(gridSource);
  assert.ok(selectedRule, 'selected cell rule must exist');
  assert.doesNotMatch(selectedRule![1]!, /box-shadow/, 'selection highlight must not paint shadows');
  assert.match(gridSource, /is-h-scrolling/, 'horizontal scroll mode class must be applied');

  const selectionSource = readFileSync(
    resolve(process.cwd(), 'src/composables/useGridSelection.ts'),
    'utf-8'
  );
  const moveListeners = selectionSource.match(/addEventListener\('mousemove'/g) ?? [];
  assert.equal(moveListeners.length, 1, 'mousemove listener must only be registered lazily');
  assert.match(selectionSource, /attachDragListeners\(\)/, 'drag listeners must be attached on demand');
  assert.match(selectionSource, /detachDragListeners\(\)/, 'drag listeners must be detached again');
});

test('result grid keeps column virtualisation enabled', () => {
  const gridSource = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );
  // Disabling column virtualisation renders every column of a wide result set into the DOM,
  // which is the single biggest AG Grid cost this grid can avoid. The wide-viewport guard in
  // `ensureColumnVirtualisation` is what keeps AG Grid honest instead.
  assert.doesNotMatch(
    gridSource,
    /:suppress-column-virtualisation="true"/,
    'column virtualisation must not be suppressed unconditionally'
  );
  assert.doesNotMatch(
    gridSource,
    /suppressColumnVirtualisation:\s*true/,
    'column virtualisation must not be suppressed from the column definitions either'
  );
  assert.match(
    gridSource,
    /function ensureColumnVirtualisation\(/,
    'the wide-viewport virtualisation guard must stay in place'
  );
});

test('perf fixture is dev-gated before the IPC layer', () => {
  const serviceSource = readFileSync(
    resolve(process.cwd(), 'src/services/queryService.ts'),
    'utf-8'
  );
  assert.match(
    serviceSource,
    /import\.meta\.env\?\.DEV \? parsePerfFixtureSpec\(sql\) : null/,
    'the fixture shortcut must be gated behind import.meta.env.DEV'
  );
  assert.match(serviceSource, /buildPerfFixture\(fixture\)/);
});

test('grid perf HUD can measure quick-filter cost and restores the filter afterwards', () => {
  const diagSource = readFileSync(
    resolve(process.cwd(), 'src/composables/useGridPerfDiag.ts'),
    'utf-8'
  );
  assert.match(diagSource, /export async function runFilterSettleBenchmark\(/);
  assert.equal(
    (diagSource.match(/getGridOption\('quickFilterText'\)/g) ?? []).length,
    1,
    'the original filter value must be captured exactly once'
  );
  assert.match(
    diagSource,
    /api\.setGridOption\('quickFilterText', original\)/,
    'the benchmark must put the grid back how the component believes it is'
  );
  assert.match(diagSource, /Run filter benchmark/);
});

test('quick filter debounces large result sets and cleans up its timer', () => {
  const gridSource = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );

  assert.match(
    gridSource,
    /v-model="quickFilterInput"/,
    'the input must bind the raw value, not the debounced one'
  );
  assert.doesNotMatch(
    gridSource,
    /v-model="quickFilter"/,
    'binding the grid value directly to the input would skip the debounce'
  );
  assert.match(
    gridSource,
    /:quick-filter-text="quickFilter"/,
    'the grid must receive the debounced value'
  );
  assert.match(gridSource, /const QUICK_FILTER_DEBOUNCE_MS = 250;/);
  assert.match(
    gridSource,
    /const QUICK_FILTER_DEBOUNCE_ROW_THRESHOLD = 10000;/,
    'the measured ~100ms crossing is around 10k rows'
  );
  assert.match(
    gridSource,
    /\}, QUICK_FILTER_DEBOUNCE_MS\);/,
    'the debounce delay constant must actually drive the timer'
  );

  const unmountBlock = /onBeforeUnmount\(\(\) => \{([\s\S]*?)\n\}\);/.exec(gridSource);
  assert.ok(unmountBlock, 'the component must still tear down on unmount');
  assert.match(
    unmountBlock![1]!,
    /clearTimeout\(quickFilterTimer\)/,
    'a pending debounce must not fire after the grid is gone'
  );
});
