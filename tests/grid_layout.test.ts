import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import type { Tabulator } from 'tabulator-tables';
import { buildLayoutKey, useGridLayoutStore } from '../src/stores/gridLayoutStore';

function freshStore() {
  setActivePinia(createPinia());
  return useGridLayoutStore();
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8');
}

function sliceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing marker: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing marker: ${end}`);
  return source.slice(from, to);
}

interface FakeTable {
  table: Tabulator;
  appliedLayouts: unknown[][];
  appliedSorters: unknown[][];
}

function makeFakeTable(
  columns: Array<{ field: string; width: number; visible?: boolean }>,
  sorters: Array<{ field: string; dir: 'asc' | 'desc' }> = []
): FakeTable {
  const appliedLayouts: unknown[][] = [];
  const appliedSorters: unknown[][] = [];
  const table = {
    getColumns: () =>
      columns.map((column) => ({
        getField: () => column.field,
        getWidth: () => column.width,
        isVisible: () => column.visible !== false,
      })),
    getSorters: () => sorters,
    setColumnLayout: (layout: unknown[]) => {
      appliedLayouts.push(layout);
      return true;
    },
    setSort: (next: unknown[]) => {
      appliedSorters.push(next);
    },
  } as unknown as Tabulator;
  return { table, appliedLayouts, appliedSorters };
}

test('buildLayoutKey namespaces result sets by tab and set index', () => {
  assert.equal(buildLayoutKey('tab-1', 0), 'tab-1:0');
  assert.equal(buildLayoutKey('tab-1', 2), 'tab-1:2');
  assert.equal(buildLayoutKey(null, 0), 'orphan:0');
  assert.equal(buildLayoutKey(undefined, 1), 'orphan:1');
});

test('capture then restore round-trips column layout and sorters', () => {
  const store = freshStore();
  const key = store.layoutKey('tab-a', 0);

  const source = makeFakeTable(
    [
      { field: '__sqlight_row', width: 60 },
      { field: '0', width: 240 },
      { field: '1', width: 120, visible: false },
    ],
    [{ field: '0', dir: 'asc' }]
  );

  store.capture(key, source.table);
  assert.equal(store.has(key), true);

  const target = makeFakeTable([]);
  assert.equal(store.restore(key, target.table), true);
  assert.deepEqual(target.appliedLayouts, [
    [
      { field: '__sqlight_row', width: 60, visible: true },
      { field: '0', width: 240, visible: true },
      { field: '1', width: 120, visible: false },
    ],
  ]);
  // Tabulator resolves sorters by `column` (a field name works), not by the `field` key of the
  // sorter object it returns from `getSorters()`.
  assert.deepEqual(target.appliedSorters, [[{ column: '0', dir: 'asc' }]]);
});

test('restore is a no-op for an unknown key and skips an empty sorter list', () => {
  const store = freshStore();
  const target = makeFakeTable([]);
  assert.equal(store.restore(store.layoutKey('tab-missing', 0), target.table), false);
  assert.equal(target.appliedLayouts.length, 0);

  const key = store.layoutKey('tab-b', 0);
  store.capture(key, makeFakeTable([{ field: '0', width: 90 }]).table);
  const restored = makeFakeTable([]);
  store.restore(key, restored.table);
  assert.equal(restored.appliedLayouts.length, 1);
  assert.equal(restored.appliedSorters.length, 0);
});

test('capture ignores non-directional sorters and tolerates a missing grid', () => {
  const store = freshStore();
  const key = store.layoutKey('tab-c', 0);
  const source = makeFakeTable([{ field: '0', width: 100 }], [
    { field: '0', dir: 'asc' },
    { field: '', dir: 'asc' },
    { field: '1', dir: undefined as unknown as 'asc' },
  ]);

  store.capture(key, source.table);
  const target = makeFakeTable([]);
  store.restore(key, target.table);
  assert.deepEqual(target.appliedSorters, [[{ column: '0', dir: 'asc' }]]);

  // A grid torn down mid-capture must not throw.
  store.capture(store.layoutKey('tab-d', 0), null);
});

test('active set index is remembered per tab and cleared with its layouts', () => {
  const store = freshStore();
  assert.equal(store.getActiveSetIndex('tab-x'), null);

  store.setActiveSetIndex('tab-x', 3);
  store.capture(store.layoutKey('tab-x', 3), makeFakeTable([{ field: '0', width: 100 }]).table);
  assert.equal(store.getActiveSetIndex('tab-x'), 3);
  assert.equal(store.has('tab-x:3'), true);

  store.clearTab('tab-x');
  assert.equal(store.getActiveSetIndex('tab-x'), null);
  assert.equal(store.has('tab-x:3'), false);
  // Other tabs are untouched by a scoped clear.
  store.capture(store.layoutKey('tab-y', 0), makeFakeTable([{ field: '0', width: 100 }]).table);
  store.clearTab('tab-x');
  assert.equal(store.has('tab-y:0'), true);
});

test('result grids wire layout restore and capture into the Tabulator lifecycle', () => {
  const item = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );
  assert.match(item, /gridLayoutStore\.restore\(layoutKey\.value/, 'grid ready must restore the layout');
  assert.match(item, /table\.on\('columnResized', scheduleLayoutCapture\)/);
  assert.match(item, /table\.on\('columnMoved', handleColumnMoved\)/);
  assert.match(item, /table\.on\('columnVisibilityChanged', scheduleLayoutCapture\)/);
  assert.match(item, /table\.on\('dataSorted', scheduleLayoutCapture\)/);
  assert.match(item, /captureLayoutNow\(\);/, 'unmount must snapshot the final layout');
  assert.match(item, /tabId\?: string \| null;/, 'result grid item must accept an explicit tab id');

  const grid = readFileSync(resolve(process.cwd(), 'src/components/results/ResultGrid.vue'), 'utf-8');
  assert.match(grid, /gridLayoutStore\.getActiveSetIndex/, 'must restore the selected Result #N');
  assert.match(grid, /gridLayoutStore\.setActiveSetIndex/, 'must remember the selected Result #N');
  assert.match(grid, /:key="itemKey\(/);
  assert.match(grid, /:tab-id="tabId"/, 'parent must pass an explicit tab id');

  const panel = readFileSync(resolve(process.cwd(), 'src/components/layout/AppBottomPanel.vue'), 'utf-8');
  assert.match(panel, /:tab-id="queryStore\.activeResultTabId"/);
});

test('refresh resets sorting and filtering instead of restoring them', () => {
  const item = readSource('src/components/results/ResultGridItem.vue');

  // The reset runs on every successful refresh…
  assert.match(
    sliceBetween(item, 'async function handleRefresh()', '// Check editability'),
    /resetGridState\(\);/,
    'refresh must reset the visible view state'
  );

  // …and drops sorting, filtering and the quick-filter input while keeping column widths.
  const resetBody = sliceBetween(item, 'function resetGridState()', 'async function handleRefresh()');
  assert.match(resetBody, /quickFilterInput\.value = ''/);
  assert.match(resetBody, /table\.clearSort\(\)/);
  assert.match(resetBody, /table\.clearFilter\(\)/);
  assert.match(
    resetBody,
    /gridLayoutStore\.capture\(layoutKey\.value, table\)/,
    'the remembered sorters must be overwritten so a rebuild cannot bring them back'
  );
  assert.doesNotMatch(resetBody, /setColumnLayout|setSort\(/, 'column layout must survive a refresh');

  for (const path of [
    'src/components/editor/TableDataViewer.vue',
    'src/components/editor/TableStructureViewer.vue',
  ]) {
    const source = readSource(path);
    assert.match(source, /resetGridState\(\);/, `${path} must reset on reload`);
    assert.match(source, /table\.clearSort\(\)/, `${path} must drop the sorter`);
    assert.match(source, /table\.clearFilter\(\)/, `${path} must drop the quick filter`);
  }
});
