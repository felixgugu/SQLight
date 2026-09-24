import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Result tab header formatting and rename behavior', () => {
  test('result tab header removes double-click inline rename and removes row count from tab title and badge', () => {
    const bottomPanelSource = readSource('src/components/layout/AppBottomPanel.vue');
    const queryStoreSource = readSource('src/stores/queryStore.ts');

    // 1. Result tab title span should not have @dblclick
    assert.doesNotMatch(
      bottomPanelSource,
      /@dblclick[^\n]*startRenameTab\(rtab\)/,
      'Result tab span must not have @dblclick bound to startRenameTab'
    );

    // 2. Result tab must not have row count badge (${rtab.rowCount}r)
    assert.doesNotMatch(
      bottomPanelSource,
      /\$\{rtab\.rowCount\}r/,
      'Result tab must not render row count badge'
    );

    // 3. Tab title in queryStore should not append row count suffix (${rowCount}r or 0r)
    assert.doesNotMatch(
      queryStoreSource,
      /\$\{seq\}\.\$\{tableName\}[^\n]*\$\{rowCount\}r/,
      'queryStore execute should not append ${rowCount}r to tabTitle'
    );
    assert.doesNotMatch(
      queryStoreSource,
      /\$\{seq\}\.\$\{tableName\}\s+0r/,
      'queryStore error handler should not append 0r to tabTitle'
    );
  });
});
