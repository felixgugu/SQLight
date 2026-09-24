import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

describe('Query Result Panel Consolidation and Status Bar Enhancement', () => {
  test('AppBottomPanel removes the outer header tab row and uses a single consolidated tabs bar', () => {
    const bottomPanelSource = readSource('src/components/layout/AppBottomPanel.vue');

    // 1. The old outer h-8 tabs row with Results/Messages/History/Stats button array is removed
    assert.doesNotMatch(
      bottomPanelSource,
      /<div class="h-8 bg-dark-850 border-b border-dark-700 flex items-center justify-between px-2 text-xs flex-shrink-0">/,
      'Old outer h-8 tabs row must be removed'
    );

    // 2. The consolidated header is h-9, flex items-center justify-between, and has overflow-hidden (no horizontal scrollbar on the full row)
    assert.match(
      bottomPanelSource,
      /class="h-9 bg-dark-850 border-b border-dark-750 flex items-center justify-between px-1\.5 select-none flex-shrink-0 overflow-hidden"/,
      'The single consolidated header row must be overflow-hidden with no horizontal scroll'
    );

    // 3. Left section contains resultsTabsBarRef with internal horizontal scrolling
    assert.match(
      bottomPanelSource,
      /ref="resultsTabsBarRef"[\s\S]*?overflow-x-auto/,
      'Left section must have horizontal scrolling for SQL result tabs'
    );

    // 4. Right section contains text-only tabs without Badge component
    assert.doesNotMatch(
      bottomPanelSource,
      /<Badge[\s\S]*?tab\.badge/,
      'Right panel tabs must not display badge counts'
    );

    // 5. Right tabs list only contains messages, history, and stats (results tab is integrated on the left)
    assert.doesNotMatch(
      bottomPanelSource,
      /id:\s*'results'[\s\S]*?id:\s*'messages'/,
      'Right panelTabs must not contain results tab'
    );
    assert.match(
      bottomPanelSource,
      /id:\s*'messages'/,
      'Right panelTabs must contain messages'
    );
    assert.match(
      bottomPanelSource,
      /id:\s*'history'/,
      'Right panelTabs must contain history'
    );
    assert.match(
      bottomPanelSource,
      /id:\s*'stats'/,
      'Right panelTabs must contain stats'
    );
  });

  test('ResultGridItem moves duration to status bar and removes selection tip', () => {
    const itemSource = readSource('src/components/results/ResultGridItem.vue');

    // 1. selectionTip is removed
    assert.doesNotMatch(
      itemSource,
      /\$t\('results\.selectionTip'\)/,
      'results.selectionTip must be removed from status bar'
    );

    // 2. Duration is placed in the status bar alongside total rows and columns
    assert.match(
      itemSource,
      /Duration:[\s\S]*?\{\{\s*displayDuration\s*\}\}ms/,
      'Duration must be displayed in the status bar'
    );

    // 3. ResultGridItem accepts durationMs prop
    assert.match(
      itemSource,
      /durationMs\?: number;/,
      'ResultGridItem must accept optional durationMs prop'
    );

    // 4. Duplicate row count indicator in toolbar is removed
    assert.doesNotMatch(
      itemSource,
      /resultSet\.rows\.length\.toLocaleString\(\)\s*\}\}<\/strong>\s*\{\{\s*\$t\('results\.rowCount'/,
      'Toolbar must not contain duplicate row count indicator'
    );
  });

  test('ResultGrid passes durationMs to ResultGridItem instances', () => {
    const gridSource = readSource('src/components/results/ResultGrid.vue');

    assert.match(
      gridSource,
      /durationMs\?: number;/,
      'ResultGrid must accept durationMs prop'
    );

    const matches = gridSource.match(/:duration-ms="durationMs"/g);
    assert.ok(matches && matches.length >= 3, 'ResultGrid must pass duration-ms to all ResultGridItem instances');
  });

  test('AppBottomPanel provides compact text action: 顯示工具列, and ResultGrid supports double-click equal heights on splitters', () => {
    const bottomPanelSource = readSource('src/components/layout/AppBottomPanel.vue');

    // 1. Show/hide toolbar action is present in header right area
    assert.match(
      bottomPanelSource,
      /isToolbarHidden \? \$t\('results\.showToolbars'\) : \$t\('results\.hideToolbars'\)/,
      'AppBottomPanel must contain show/hide toolbars toggle button'
    );

    // 2. Middle multi-results header and buttons (equalHeights, ssmsStacked/tabbed) are removed
    assert.doesNotMatch(
      bottomPanelSource,
      /\$t\('results\.equalHeights'\)/,
      'equalHeights button must be removed from header toolbar'
    );
    assert.doesNotMatch(
      bottomPanelSource,
      /\$t\('results\.ssmsStacked'\)/,
      'ssmsStacked button must be removed from header toolbar'
    );

    // 3. ResultGrid has no middle sub-toolbar and has pure SSMS stacked view with double-click equal heights
    const gridSource = readSource('src/components/results/ResultGrid.vue');
    assert.doesNotMatch(
      gridSource,
      /results\.resultSetsCount/,
      'ResultGrid must not have the middle result sets count toolbar'
    );
    assert.match(
      gridSource,
      /@dblclick="resetEqualHeights"/,
      'ResizableSplitter in ResultGrid must support double-click to reset equal heights'
    );
  });
});
