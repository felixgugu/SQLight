import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useWorkspaceStore } from '../src/stores/workspaceStore';
import type { ErDiagramTab } from '../src/types/workspace';

const storageData = new Map<string, string>();
globalThis.localStorage = {
  getItem: (key) => storageData.get(key) ?? null,
  setItem: (key, value) => { storageData.set(key, String(value)); },
  removeItem: (key) => { storageData.delete(key); },
  clear: () => storageData.clear(),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  storageData.clear();
  setActivePinia(createPinia());
});

test('erTheme defaults to dark in settingsStore', () => {
  const settingsStore = useSettingsStore();
  assert.equal(settingsStore.erTheme, 'dark');
});

test('erTheme can be toggled to light and is persisted in localStorage', () => {
  const settingsStore = useSettingsStore();
  assert.equal(settingsStore.erTheme, 'dark');

  settingsStore.erTheme = 'light';
  assert.equal(settingsStore.erTheme, 'light');

  // Trigger auto-persistence check
  settingsStore.saveSettings();
  const savedRaw = localStorage.getItem('sqlight_app_settings');
  assert.ok(savedRaw);
  const parsed = JSON.parse(savedRaw);
  assert.equal(parsed.erTheme, 'light');
});

test('resetToDefaults restores erTheme to dark', () => {
  const settingsStore = useSettingsStore();
  settingsStore.erTheme = 'light';
  assert.equal(settingsStore.erTheme, 'light');

  settingsStore.resetToDefaults();
  assert.equal(settingsStore.erTheme, 'dark');
});

test('ER tab snapshot includes theme metadata and restores properly', () => {
  const workspaceStore = useWorkspaceStore();
  const settingsStore = useSettingsStore();

  workspaceStore.addErDiagramTab({
    rootSchema: 'dbo',
    rootTable: 'Orders',
    connectionId: 'conn-1',
    database: 'Northwind',
  });

  const tabId = workspaceStore.activeTabId;

  // Simulate snapshot captured during onBeforeUnmount with light theme
  const mockSnapshot = {
    exportedAt: new Date().toISOString(),
    graph: { cells: [] },
    zoom: 1.0,
    translation: { tx: 50, ty: 50 },
    theme: 'light' as const,
  };

  workspaceStore.updateTabData(tabId, { initialData: mockSnapshot });

  const currentTab = workspaceStore.tabs.find((t) => t.id === tabId) as ErDiagramTab;
  assert.ok(currentTab);
  assert.ok(currentTab.initialData);
  assert.equal(currentTab.initialData.theme, 'light');

  // Simulate restore logic
  if (currentTab.initialData.theme) {
    settingsStore.erTheme = currentTab.initialData.theme;
  }
  assert.equal(settingsStore.erTheme, 'light');
});
