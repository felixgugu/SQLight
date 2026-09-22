import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Result grid: double-click copies a read-only cell value', () => {
  test('ResultGridItem binds the grid cellDoubleClicked event', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    assert.match(
      source,
      /@cell-double-clicked="onCellDoubleClicked"/,
      'AgGridVue should bind @cell-double-clicked'
    );
    assert.match(
      source,
      /function onCellDoubleClicked\(event: CellDoubleClickedEvent\)/,
      'ResultGridItem should implement onCellDoubleClicked'
    );
    assert.match(
      source,
      /type CellDoubleClickedEvent,/,
      'CellDoubleClickedEvent should be imported from ag-grid-community'
    );
  });

  test('double-click copy leaves editable cells to the editor', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    const guardIdx = source.indexOf('if (event.column.isCellEditable(event.node)) return;');
    const writeIdx = source.indexOf('navigator.clipboard.writeText(text)', guardIdx);

    assert.ok(guardIdx !== -1, 'the handler should bail out when the cell is editable');
    assert.ok(
      writeIdx !== -1 && guardIdx < writeIdx,
      'the editable check must run before the clipboard write'
    );
  });

  test('double-click copy ignores the row number column and reuses export formatting', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    assert.match(
      source,
      /const colIdx = getColIndex\(event\.column\.getColId\(\)\);/,
      'the handler should resolve the data column index via getColIndex'
    );
    assert.match(
      source,
      /const text = formatCellForExport\(event\.value\);/,
      'the handler should reuse formatCellForExport'
    );
  });

  test('double-click copy reports both success and failure', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    assert.match(
      source,
      /workspaceStore\.showToast\(`已複製「\$\{colName\}」的值至剪貼簿`, 'success'/,
      'a successful copy should toast the column name'
    );
    assert.match(
      source,
      /workspaceStore\.showToast\('複製失敗：無法寫入剪貼簿', 'warning'/,
      'a failed clipboard write should be surfaced as a warning'
    );
  });
});
