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

describe('Grid context menus own the actions the toolbars cannot reach', () => {
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
    assert.match(result, /(?:複製儲存格值 \(Copy Cell\)|results\.copyCell)/);
    assert.match(result, /(?:複製欄位名稱 \(Column Name\)|results\.copyColumnName)/);
    assert.match(result, /(?:複製整列資料 \(Copy Row\)|results\.copyRow)/);
    assert.match(result, /(?:複製整列為 JSON \(Row JSON\)|results\.copyRowJson)/);
  });

  for (const grid of grids) {
    test(`${grid.path} keeps selection copy in the context menu only`, () => {
      const source = readSource(grid.path);

      assert.equal(
        countOccurrences(source, '@click="copySelectedCells"'),
        1,
        'the aggregate bar must not repeat the context menu action'
      );
      assert.doesNotMatch(
        source,
        /Copy Selection Button/,
        'the aggregate bar copy-selection button was removed'
      );
      assert.match(
        source,
        /onCopySelected: \(\) => gridExport\.copySelectedCells\(\)/,
        'Ctrl+C must keep copying the current selection'
      );
      assert.match(source, /(?:複製選取內容 \(\{\{ selectionStats\?\.totalCells \}\} 格\)|results\.copySelection)/);
    });
  }
});
