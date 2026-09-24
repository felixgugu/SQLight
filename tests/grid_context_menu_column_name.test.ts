import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Result grid context menu: copy column name', () => {
  test('useGridExport exposes a copyColumnName action', () => {
    const source = readSource('src/composables/useGridExport.ts');
    assert.match(
      source,
      /copyColumnName: \(name: string\) => void;/,
      'UseGridExportReturn should declare copyColumnName'
    );
    assert.match(
      source,
      /function copyColumnName\(name: string\)/,
      'useGridExport should implement copyColumnName'
    );
    assert.match(
      source,
      /navigator\.clipboard\.writeText\(text\)/,
      'copyColumnName should write to the clipboard'
    );
    assert.match(
      source,
      /\n    copyColumnName,/,
      'copyColumnName should be returned from useGridExport'
    );
  });

  test('ResultGridItem renders the column name item directly below Copy Cell', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    const copyCellIdx = source.indexOf('results.copyCell') !== -1 ? source.indexOf('results.copyCell') : source.indexOf('複製儲存格值 (Copy Cell)');
    const copyColumnIdx = source.indexOf('results.copyColumnName') !== -1 ? source.indexOf('results.copyColumnName') : source.indexOf('複製欄位名稱 (Column Name)');
    const copyRowIdx = source.indexOf('results.copyRow') !== -1 ? source.indexOf('results.copyRow') : source.indexOf('複製整列資料 (Copy Row)');

    assert.ok(copyCellIdx !== -1, 'Copy Cell item should exist');
    assert.ok(copyColumnIdx !== -1, 'Column Name item should exist');
    assert.ok(copyRowIdx !== -1, 'Copy Row item should exist');

    assert.ok(
      copyCellIdx < copyColumnIdx,
      'Column Name should appear after Copy Cell'
    );
    assert.ok(
      copyColumnIdx < copyRowIdx,
      'Column Name should appear before Copy Row'
    );
  });

  test('ResultGridItem wires the menu item to the exported action', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');
    assert.match(
      source,
      /copyColumnName: exportCopyColumnName,/,
      'copyColumnName should be destructured from the export composable'
    );
    assert.match(
      source,
      /function copyColumnName\(\) \{\s*exportCopyColumnName\(contextMenu\.colName\);\s*\}/,
      'menu handler should copy the context menu column name'
    );
    assert.match(
      source,
      /@click="copyColumnName"/,
      'the Column Name button should call copyColumnName'
    );
  });
});
