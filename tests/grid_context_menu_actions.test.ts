import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

/**
 * The full-table copy actions live in the toolbar. They used to be duplicated at the bottom of
 * every grid context menu, which made the menu longer without adding reachable functionality.
 */
describe('Grid context menus do not duplicate the toolbar copy actions', () => {
  const grids: Array<{ path: string; actions: string[] }> = [
    {
      path: 'src/components/results/ResultGridItem.vue',
      actions: ['copyAsTsv', 'copyAsCsv', 'copyAsJson', 'copyAsMarkdown'],
    },
    {
      path: 'src/components/editor/TableDataViewer.vue',
      actions: ['copyAsTsv', 'copyAsJson', 'copyAsMarkdown'],
    },
    {
      path: 'src/components/editor/TableStructureViewer.vue',
      actions: ['copyAsTsv', 'copyAsJson', 'copyAsMarkdown'],
    },
  ];

  for (const grid of grids) {
    test(`${grid.path} binds each full-table copy action exactly once`, () => {
      const source = readSource(grid.path);

      for (const action of grid.actions) {
        assert.equal(
          countOccurrences(source, `@click="${action}"`),
          1,
          `${action} must only be wired to the toolbar button`
        );
      }

      assert.doesNotMatch(
        source.replace(/v-tooltip\.top="'[^']*'"/g, ''),
        /複製全表(結構)?為 (TSV|JSON|Markdown)/,
        'the context menu must not repeat the full-table copy entries'
      );
    });
  }

  test('the row level copy actions stay in the context menu', () => {
    const result = readSource('src/components/results/ResultGridItem.vue');
    assert.match(result, /複製儲存格值 \(Copy Cell\)/);
    assert.match(result, /複製欄位名稱 \(Column Name\)/);
    assert.match(result, /複製整列資料 \(Copy Row\)/);
    assert.match(result, /複製整列為 JSON \(Row JSON\)/);
  });
});
