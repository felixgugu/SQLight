import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadFilterHistory,
  saveFilterHistory,
  addFilterHistoryItem,
  removeFilterHistoryItem,
  clearFilterHistory,
  STORAGE_EXPLORER_FILTER_HISTORY_KEY,
  MAX_FILTER_HISTORY_ITEMS,
} from '../src/utils/filterHistory';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('filterHistory utility', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  test('loadFilterHistory: returns empty array when storage is empty', () => {
    const history = loadFilterHistory(mockStorage);
    assert.deepEqual(history, []);
  });

  test('loadFilterHistory: parses saved valid JSON array', () => {
    mockStorage.setItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY, JSON.stringify(['Users', 'Orders']));
    const history = loadFilterHistory(mockStorage);
    assert.deepEqual(history, ['Users', 'Orders']);
  });

  test('loadFilterHistory: handles corrupted or invalid JSON gracefully', () => {
    mockStorage.setItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY, '{invalid json}');
    const history = loadFilterHistory(mockStorage);
    assert.deepEqual(history, []);
  });

  test('loadFilterHistory: filters out non-strings and empty strings', () => {
    mockStorage.setItem(
      STORAGE_EXPLORER_FILTER_HISTORY_KEY,
      JSON.stringify(['Users', '', '   ', 123, null, 'Orders'])
    );
    const history = loadFilterHistory(mockStorage);
    assert.deepEqual(history, ['Users', 'Orders']);
  });

  test('addFilterHistoryItem: trims whitespace and adds to the front', () => {
    let history: string[] = [];
    history = addFilterHistoryItem(history, '  Orders  ');
    assert.deepEqual(history, ['Orders']);

    history = addFilterHistoryItem(history, 'Customers');
    assert.deepEqual(history, ['Customers', 'Orders']);
  });

  test('addFilterHistoryItem: ignores empty or whitespace-only inputs', () => {
    const history = ['Orders'];
    assert.deepEqual(addFilterHistoryItem(history, ''), ['Orders']);
    assert.deepEqual(addFilterHistoryItem(history, '   '), ['Orders']);
  });

  test('addFilterHistoryItem: deduplicates case-insensitively and promotes to front (LRU)', () => {
    let history = ['Orders', 'Users', 'Products'];
    // Adding 'users' (different case) should remove 'Users' from middle and put 'users' at front
    history = addFilterHistoryItem(history, 'users');
    assert.deepEqual(history, ['users', 'Orders', 'Products']);
  });

  test('addFilterHistoryItem: strictly caps at 30 items', () => {
    let history: string[] = [];
    for (let i = 1; i <= 35; i++) {
      history = addFilterHistoryItem(history, `Filter_${i}`);
    }

    assert.equal(history.length, MAX_FILTER_HISTORY_ITEMS);
    assert.equal(history.length, 30);
    // The most recent one should be at the front
    assert.equal(history[0], 'Filter_35');
    // The 30th item should be Filter_6 (Filter_1..Filter_5 were pushed out)
    assert.equal(history[29], 'Filter_6');
    assert.ok(!history.includes('Filter_5'));
  });

  test('removeFilterHistoryItem: removes specified item case-insensitively', () => {
    const history = ['Users', 'Orders', 'Products'];
    const updated = removeFilterHistoryItem(history, 'orders');
    assert.deepEqual(updated, ['Users', 'Products']);
  });

  test('saveFilterHistory and clearFilterHistory: correctly interact with storage', () => {
    const history = ['Table1', 'Table2'];
    saveFilterHistory(history, mockStorage);

    assert.equal(
      mockStorage.getItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY),
      JSON.stringify(['Table1', 'Table2'])
    );

    clearFilterHistory(mockStorage);
    assert.equal(mockStorage.getItem(STORAGE_EXPLORER_FILTER_HISTORY_KEY), null);
    assert.deepEqual(loadFilterHistory(mockStorage), []);
  });

  test('AppSidebar.vue template and script integration for ComboBox and clear button', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sidebarCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/layout/AppSidebar.vue'),
      'utf-8'
    );

    // Clear button (X)
    assert.ok(sidebarCode.includes('clearFilter'), 'AppSidebar should define clearFilter handler');
    assert.ok(sidebarCode.includes('v-if="filterQuery"'), 'AppSidebar should conditionally render clear button');

    // ComboBox toggle button and dropdown
    assert.ok(sidebarCode.includes('toggleHistoryDropdown'), 'AppSidebar should define toggleHistoryDropdown');
    assert.ok(sidebarCode.includes('isHistoryDropdownOpen'), 'AppSidebar should track dropdown open state');
    assert.ok(sidebarCode.includes('filterHistory'), 'AppSidebar should have reactive filterHistory list');

    // ComboBox item actions
    assert.ok(sidebarCode.includes('selectHistoryItem'), 'AppSidebar should support selecting history items');
    assert.ok(sidebarCode.includes('handleRemoveHistoryItem'), 'AppSidebar should support deleting single history item');
    assert.ok(sidebarCode.includes('handleClearAllHistory'), 'AppSidebar should support clearing all history');

    // Keyboard navigation
    assert.ok(sidebarCode.includes('handleKeyDown'), 'AppSidebar should handle Down Arrow navigation');
    assert.ok(sidebarCode.includes('handleKeyUp'), 'AppSidebar should handle Up Arrow navigation');
    assert.ok(sidebarCode.includes('handleKeyEnter'), 'AppSidebar should handle Enter commit/selection');
    assert.ok(sidebarCode.includes('handleKeyEsc'), 'AppSidebar should handle Escape to close or clear');

    // Outside click & debounce watcher
    assert.ok(sidebarCode.includes('handleDocumentPointerDown'), 'AppSidebar should handle outside pointerdown');
    assert.ok(sidebarCode.includes('debounceRecordTimer'), 'AppSidebar should debounce recording user input');
  });
});
