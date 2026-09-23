import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { computeFrameStats, isGridPerfDiagEnabled } from '../src/composables/useGridPerfDiag';

const GRID_VIEWS = [
  'src/components/results/ResultGridItem.vue',
  'src/components/editor/TableDataViewer.vue',
  'src/components/editor/TableStructureViewer.vue',
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
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

test('result grid hands Tabulator raw row data instead of reactive proxies', () => {
  const source = readSource('src/components/results/ResultGridItem.vue');
  assert.match(source, /getRows: \(\) => gridRowData\.value/, 'the table must read the raw row-data computed');
  assert.match(source, /toRaw\(rows\)/, 'row data must be unwrapped with toRaw');
  assert.doesNotMatch(
    source,
    /:row-data=/,
    'the template must not bind reactive row data into a grid component any more'
  );
});

test('quick filter debounces large result sets, applies through setFilter and cleans up its timer', () => {
  const source = readSource('src/components/results/ResultGridItem.vue');

  assert.match(
    source,
    /v-model="quickFilterInput"/,
    'the input must bind the raw value, not the debounced one'
  );
  assert.doesNotMatch(
    source,
    /v-model="quickFilter"/,
    'binding the grid value directly to the input would skip the debounce'
  );
  assert.match(source, /const QUICK_FILTER_DEBOUNCE_MS = 250;/);
  assert.match(
    source,
    /const QUICK_FILTER_DEBOUNCE_ROW_THRESHOLD = 10000;/,
    'the measured ~100ms crossing is around 10k rows'
  );
  assert.match(source, /\}, QUICK_FILTER_DEBOUNCE_MS\);/, 'the debounce delay constant must drive the timer');
  assert.match(source, /table\.setFilter\(buildQuickFilter\(term\)\)/, 'the debounced value must reach Tabulator');
  assert.match(source, /table\.clearFilter\(\)/, 'an empty term must clear the filter');

  const unmountBlock = /onBeforeUnmount\(\(\) => \{([\s\S]*?)\n\}\);/.exec(source);
  assert.ok(unmountBlock, 'the component must still tear down on unmount');
  assert.match(
    unmountBlock![1]!,
    /clearTimeout\(quickFilterTimer\)/,
    'a pending debounce must not fire after the grid is gone'
  );
});

test('grids render every column and offer no per-column header filters', () => {
  for (const path of GRID_VIEWS) {
    const source = readSource(path);
    assert.doesNotMatch(
      source,
      /headerFilter/,
      `${path} must not add per-column header filters (migration decision)`
    );
    // Column windowing was explicitly deferred: the grids ship with the default all-columns
    // renderer, so this assertion documents the current decision rather than a permanent rule.
    assert.doesNotMatch(
      source,
      /renderHorizontal: 'virtual'/,
      `${path} must not silently enable horizontal virtualisation`
    );
    assert.match(
      source,
      /selectableRows: false/,
      `${path} must disable row selection so the range module initialises`
    );
    assert.match(
      source,
      /headerSortClickElement: 'icon'/,
      `${path} must sort from the arrow so header clicks can select columns`
    );
  }
});

test('the frozen # column keeps an opaque background', () => {
  const css = readSource('src/styles/tabulatorTheme.css');
  const rule = /\.sqlight-row-index-cell\s*\{([^}]*)\}/g;
  const matches = [...css.matchAll(rule)];
  assert.ok(matches.length > 0, 'row index column styling must exist');
  assert.ok(
    matches.some((match) => /background-color: var\(--sq-grid-bg\)/.test(match[1]!)),
    'the frozen cell needs an opaque background so scrolled content cannot bleed through'
  );
});

test('perf fixture is dev-gated before the IPC layer', () => {
  const serviceSource = readSource('src/services/queryService.ts');
  assert.match(
    serviceSource,
    /import\.meta\.env\?\.DEV \? parsePerfFixtureSpec\(sql\) : null/,
    'the fixture shortcut must be gated behind import.meta.env.DEV'
  );
  assert.match(serviceSource, /buildPerfFixture\(fixture\)/);
});

test('grid perf HUD can measure quick-filter cost and restores the filter afterwards', () => {
  const diagSource = readSource('src/composables/useGridPerfDiag.ts');
  assert.match(diagSource, /export async function runFilterSettleBenchmark\(/);
  assert.equal(
    (diagSource.match(/const original = options\.current\(\);/g) ?? []).length,
    1,
    'the original filter value must be captured exactly once'
  );
  assert.match(
    diagSource,
    /options\.apply\(original\)/,
    'the benchmark must put the grid back how the component believes it is'
  );
  assert.match(diagSource, /Run filter benchmark/);
  assert.match(diagSource, /tabulator-tableholder/, 'the scroller selector must match Tabulator');
});

test('all three grids mount a Tabulator table and scope keyboard handling to it', () => {
  for (const path of GRID_VIEWS) {
    const source = readSource(path);
    assert.match(source, /useTabulatorTable\(/, `${path} must use the shared Tabulator lifecycle`);
    assert.match(source, /@scroll\.capture\.passive="handleGridScroll"/, `${path} must track horizontal scrolling`);
    assert.match(source, /class="sqlight-grid /, `${path} must opt into the shared grid theme`);
  }
});
