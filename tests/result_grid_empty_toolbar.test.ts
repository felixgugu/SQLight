import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useGridExport } from '../src/composables/useGridExport';
import type { UseGridSelectionReturn } from '../src/composables/useGridSelection';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('ResultGrid toolbar persistence and empty state row validation', () => {
  test('ResultGrid does not hide toolbar when tabId is present and resultSets is empty', () => {
    const source = readSource('src/components/results/ResultGrid.vue');

    // The standalone empty state is only shown when there is no tabId
    assert.match(
      source,
      /v-if="!tabId && \(!resultSets \|\| resultSets\.length === 0\)"/,
      'isolated empty state without toolbar must only be shown when no tabId is active'
    );

    // effectiveResultSets falls back to an empty result set so ResultGridItem is mounted
    assert.match(
      source,
      /effectiveResultSets\.length === 1 && effectiveResultSets\[0\]/,
      'single result set or empty tab result set must mount ResultGridItem'
    );
  });

  test('queryStore.refreshTabResultSet preserves column metadata and 0 rows when query returns empty', () => {
    const source = readSource('src/stores/queryStore.ts');

    // When res.resultSets has 0 rows, it sets rows: [] and rowCount: 0 without wiping previous structure
    assert.match(
      source,
      /res\.resultSets\.length === 0/,
      'refreshTabResultSet must handle 0 rows returned'
    );
    assert.match(
      source,
      /prevColumns = tab\.result\.resultSets\[0\]\?\.columns \?\? \[\];/,
      'refreshTabResultSet must preserve previous column definitions'
    );
  });

  test('useGridExport performs row count validation and prompts user when rows are empty', () => {
    const toasts: Array<{ message: string; type?: string }> = [];
    const mockSelection = {
      getSelectionBlocks: () => [],
      getVisualDataColIndices: () => [],
    } as unknown as UseGridSelectionReturn;

    const exportHandler = useGridExport({
      getRows: () => [],
      getColumns: () => [{ name: 'id', dataType: 'int', nullable: false, ordinal: 0 }],
      selection: mockSelection,
      showToast: (message, type) => {
        toasts.push({ message, type });
      },
    });

    // Test TSV copy
    exportHandler.copyAsTsv();
    assert.equal(toasts.length, 1);
    assert.match(toasts[0]!.message, /查無資料可供複製/);

    // Test CSV copy
    exportHandler.copyAsCsv();
    assert.equal(toasts.length, 2);
    assert.match(toasts[1]!.message, /查無資料可供複製/);

    // Test JSON copy
    exportHandler.copyAsJson();
    assert.equal(toasts.length, 3);
    assert.match(toasts[2]!.message, /查無資料可供複製/);

    // Test Markdown copy
    exportHandler.copyAsMarkdown();
    assert.equal(toasts.length, 4);
    assert.match(toasts[3]!.message, /查無資料可供複製/);

    // Test copy selected cells
    exportHandler.copySelectedCells();
    assert.equal(toasts.length, 5);
    assert.match(toasts[4]!.message, /查無資料可供選取與複製/);
  });

  test('ResultGridItem binds hasRows check to quick filter and editing actions', () => {
    const source = readSource('src/components/results/ResultGridItem.vue');

    assert.match(
      source,
      /const hasRows = computed\(\(\) => \(props\.resultSet\?\.rows\?\.length \?\? 0\) > 0\);/,
      'hasRows computed property must be defined'
    );

    assert.match(
      source,
      /:disabled="!hasRows"/,
      'quick filter input must be disabled when hasRows is false'
    );

    assert.match(
      source,
      /:disabled="modifiedCount === 0 \|\| !hasRows"/,
      'revert and commit buttons must check hasRows'
    );
  });
});
