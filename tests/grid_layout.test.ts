import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import type { ColumnState, GridApi } from 'ag-grid-community';
import { buildLayoutKey, useGridLayoutStore } from '../src/stores/gridLayoutStore';

function freshStore() {
  setActivePinia(createPinia());
  return useGridLayoutStore();
}

interface FakeApi {
  api: GridApi;
  applied: Array<{ state: ColumnState[]; applyOrder?: boolean }>;
  filters: Record<string, unknown>[];
}

function makeFakeApi(state: ColumnState[], filterModel: Record<string, unknown> = {}): FakeApi {
  const applied: FakeApi['applied'] = [];
  const filters: FakeApi['filters'] = [];
  const api = {
    getColumnState: () => state,
    getFilterModel: () => filterModel,
    applyColumnState: (params: { state: ColumnState[]; applyOrder?: boolean }) => {
      applied.push(params);
      return true;
    },
    setFilterModel: (model: Record<string, unknown>) => {
      filters.push(model);
    },
  } as unknown as GridApi;
  return { api, applied, filters };
}

test('buildLayoutKey namespaces result sets by tab and set index', () => {
  assert.equal(buildLayoutKey('tab-1', 0), 'tab-1:0');
  assert.equal(buildLayoutKey('tab-1', 2), 'tab-1:2');
  assert.equal(buildLayoutKey(null, 0), 'orphan:0');
  assert.equal(buildLayoutKey(undefined, 1), 'orphan:1');
});

test('capture then restore round-trips the full column layout and filter model', () => {
  const store = freshStore();
  const key = store.layoutKey('tab-a', 0);
  const state: ColumnState[] = [
    { colId: 'col_0', width: 240, pinned: 'left', sort: 'asc' },
    { colId: 'col_1', width: 120, sort: null },
  ];
  const source = makeFakeApi(state, { col_1: { filterType: 'text', type: 'contains', filter: 'x' } });

  store.capture(key, source.api);
  assert.equal(store.has(key), true);

  const target = makeFakeApi([]);
  assert.equal(store.restore(key, target.api), true);
  assert.equal(target.applied.length, 1);
  assert.deepEqual(target.applied[0]!.state, state);
  assert.equal(target.applied[0]!.applyOrder, true);
  assert.deepEqual(target.filters, [{ col_1: { filterType: 'text', type: 'contains', filter: 'x' } }]);
});

test('restore is a no-op for an unknown key and skips an empty filter model', () => {
  const store = freshStore();
  const target = makeFakeApi([]);
  assert.equal(store.restore(store.layoutKey('tab-missing', 0), target.api), false);
  assert.equal(target.applied.length, 0);

  const key = store.layoutKey('tab-b', 0);
  store.capture(key, makeFakeApi([{ colId: 'col_0', width: 90 }]).api);
  const restored = makeFakeApi([]);
  store.restore(key, restored.api);
  assert.equal(restored.applied.length, 1);
  assert.equal(restored.filters.length, 0);
});

test('active set index is remembered per tab and cleared with its layouts', () => {
  const store = freshStore();
  assert.equal(store.getActiveSetIndex('tab-x'), null);

  store.setActiveSetIndex('tab-x', 3);
  store.capture(store.layoutKey('tab-x', 3), makeFakeApi([{ colId: 'col_0', width: 100 }]).api);
  assert.equal(store.getActiveSetIndex('tab-x'), 3);
  assert.equal(store.has('tab-x:3'), true);

  store.clearTab('tab-x');
  assert.equal(store.getActiveSetIndex('tab-x'), null);
  assert.equal(store.has('tab-x:3'), false);
  // Other tabs are untouched by a scoped clear.
  store.capture(store.layoutKey('tab-y', 0), makeFakeApi([{ colId: 'col_0', width: 100 }]).api);
  store.clearTab('tab-x');
  assert.equal(store.has('tab-y:0'), true);
});

test('result grids wire layout restore and capture into the AG Grid lifecycle', () => {
  const item = readFileSync(
    resolve(process.cwd(), 'src/components/results/ResultGridItem.vue'),
    'utf-8'
  );
  assert.match(item, /gridLayoutStore\.restore\(layoutKey\.value/, 'grid-ready must restore the layout');
  assert.match(item, /@column-resized="onColumnResized"/);
  assert.match(item, /@column-moved="handleColumnMoved"/);
  assert.match(item, /@column-pinned="handleColumnLayoutChanged"/);
  assert.match(item, /@sort-changed="handleGridStateChanged"/);
  assert.match(item, /@filter-changed="handleGridStateChanged"/);
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
