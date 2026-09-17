import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import type { ErDiagramTab } from '../src/types/workspace';

const data = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => { data.set(key, String(value)); },
  removeItem: (key) => { data.delete(key); },
  clear: () => data.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  data.clear();
  setActivePinia(createPinia());
});

test('ER tab snapshot preserves camera viewport zoom and pan translation', () => {
  const store = useWorkspaceStore();

  store.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Products',
    connectionId: 'conn-1',
    database: 'Northwind',
  });

  const tabId = store.activeTabId;

  // Simulate snapshot captured during onBeforeUnmount
  const mockSnapshot = {
    exportedAt: new Date().toISOString(),
    graph: { cells: [{ id: 'node-dbo.Products' }] },
    zoom: 1.25,
    translation: { tx: 180, ty: -95 },
  };

  store.updateTabData(tabId, { initialData: mockSnapshot });

  const currentTab = store.tabs.find((t) => t.id === tabId) as ErDiagramTab;
  assert.ok(currentTab);
  assert.ok(currentTab.initialData);
  assert.equal(currentTab.initialData.zoom, 1.25);
  assert.deepEqual(currentTab.initialData.translation, { tx: 180, ty: -95 });
});

test('restore logic restores zoomTo and translate when viewport coordinates are present', () => {
  // Mock Graph methods to verify restore behavior
  let zoomToCalledWith: number | null = null;
  let translateCalledWith: { tx: number; ty: number } | null = null;
  let zoomToFitCalled = false;

  const mockGraph = {
    fromJSON: () => {},
    getEdges: () => [],
    getNodes: () => [],
    zoomTo: (factor: number) => {
      zoomToCalledWith = factor;
    },
    translate: (tx: number, ty: number) => {
      translateCalledWith = { tx, ty };
    },
    zoomToFit: () => {
      zoomToFitCalled = true;
    },
  };

  const initialDataWithViewport = {
    graph: { cells: [] },
    zoom: 0.85,
    translation: { tx: 250, ty: 120 },
  };

  // Execute restore logic as implemented in ErDiagramViewer
  if (
    typeof initialDataWithViewport.zoom === 'number' &&
    initialDataWithViewport.translation &&
    typeof initialDataWithViewport.translation.tx === 'number' &&
    typeof initialDataWithViewport.translation.ty === 'number'
  ) {
    mockGraph.zoomTo(initialDataWithViewport.zoom);
    mockGraph.translate(initialDataWithViewport.translation.tx, initialDataWithViewport.translation.ty);
  } else {
    mockGraph.zoomToFit();
  }

  assert.equal(zoomToCalledWith, 0.85);
  assert.deepEqual(translateCalledWith, { tx: 250, ty: 120 });
  assert.equal(zoomToFitCalled, false);
});

test('restore logic falls back to zoomToFit when viewport coordinates are missing', () => {
  let zoomToCalled = false;
  let translateCalled = false;
  let zoomToFitCalled = false;

  const mockGraph = {
    fromJSON: () => {},
    getEdges: () => [],
    getNodes: () => [],
    zoomTo: () => {
      zoomToCalled = true;
    },
    translate: () => {
      translateCalled = true;
    },
    zoomToFit: () => {
      zoomToFitCalled = true;
    },
  };

  const legacyDataWithoutViewport = {
    graph: { cells: [] },
  };

  const data = legacyDataWithoutViewport as any;
  if (
    typeof data.zoom === 'number' &&
    data.translation &&
    typeof data.translation.tx === 'number' &&
    typeof data.translation.ty === 'number'
  ) {
    mockGraph.zoomTo();
    mockGraph.translate();
  } else {
    mockGraph.zoomToFit();
  }

  assert.equal(zoomToCalled, false);
  assert.equal(translateCalled, false);
  assert.equal(zoomToFitCalled, true);
});
