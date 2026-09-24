import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Workspace editor tab header rename behavior', () => {
  test('workspace editor tab header removes double-click inline rename', () => {
    const appMainSource = readSource('src/components/layout/AppMain.vue');

    assert.doesNotMatch(
      appMainSource,
      /@dblclick[^\n]*startRenameTab\(tab\)/,
      'Workspace tab div must not have @dblclick bound to startRenameTab'
    );
  });
});
