import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Result tab context menu close other results', () => {
  test('AppBottomPanel provides 關閉其它結果 in context menu and closes unpinned tabs', () => {
    const bottomPanelSource = readSource('src/components/layout/AppBottomPanel.vue');
    const queryStoreSource = readSource('src/stores/queryStore.ts');

    // Context menu item check
    assert.match(
      bottomPanelSource,
      /label:\s*'關閉其它結果 \(Close Others\)'/,
      'AppBottomPanel context menu must contain 關閉其它結果 (Close Others)'
    );
    assert.match(
      bottomPanelSource,
      /command:\s*handleContextMenuCloseOthers/,
      'AppBottomPanel context menu must bind handleContextMenuCloseOthers'
    );

    // queryStore function check
    assert.match(
      queryStoreSource,
      /function closeOtherResultTabs\(keepId: string\)/,
      'queryStore must implement closeOtherResultTabs'
    );
    assert.match(
      queryStoreSource,
      /tab\.id !== keepId && !tab\.isPinned/,
      'closeOtherResultTabs must not close pinned tabs or the target tab'
    );
  });
});
