import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

/**
 * Tab labels are only emphasised for the tab in use. Inactive editor tabs, bottom-panel tabs
 * and query result tabs must stay at the regular weight.
 */
test('inactive editor tabs carry no bold weight class', () => {
  const source = readSource('src/components/layout/AppMain.vue');
  assert.match(
    source,
    /workspaceStore\.activeTabId === tab\.id \? 'font-medium shadow-sm active-tab' : 'inactive-tab shadow-xs'/,
    'only the active editor tab may take font-medium; the inactive branch must stay unweighted'
  );
});

test('editor tab titles are only bolded while their tab is active', () => {
  const source = readSource('src/components/layout/AppMain.vue');
  assert.match(
    source,
    /if \(workspaceStore\.activeTabId === tab\.id\) \{\s*style\.fontWeight = '600';\s*\}/,
    'getTabTitleStyle must gate the title weight on the active tab'
  );
  assert.doesNotMatch(
    source,
    /return \{\s*color,\s*fontWeight: '600',\s*\}/,
    'getTabTitleStyle must not bold every tab that has a connection colour'
  );
});

test('the connection alias tag drops to the regular weight on inactive tabs', () => {
  const source = readSource('src/components/layout/AppMain.vue');
  assert.match(
    source,
    /:class="workspaceStore\.activeTabId === tab\.id \? '' : '!font-normal'"/,
    'the alias tag must be reset to the regular weight outside the active tab'
  );
});

test('bottom panel tabs are only bold while selected', () => {
  const source = readSource('src/components/layout/AppBottomPanel.vue');
  assert.match(
    source,
    /:class="workspaceStore\.bottomPanelTab === tab\.id \? '!font-medium' : '!font-normal'"/,
    'the bottom panel tab weight must follow the selected tab'
  );
  assert.doesNotMatch(
    source,
    /class="!h-6 !px-2 !py-0 !text-xs !font-medium"/,
    'the panel tab button must not force font-medium on every tab'
  );
});

test('inactive query result tabs carry no bold weight class', () => {
  const source = readSource('src/components/layout/AppBottomPanel.vue');
  const conditional = source.match(
    /queryStore\.activeResultTabId === rtab\.id\s*\?\s*'([^']*)'\s*:\s*'([^']*)'/
  );
  assert.ok(conditional, 'the active/inactive result tab classes must be easy to locate');
  assert.match(conditional[1]!, /font-medium/, 'the active result tab keeps its emphasis');
  assert.doesNotMatch(
    conditional[2]!,
    /font-(medium|semibold|bold)/,
    'the inactive result tab must not be bold'
  );
});

test('result set tabs only gain weight when selected', () => {
  const source = readSource('src/components/results/ResultGrid.vue');
  assert.doesNotMatch(
    source,
    /'h-5\.5 px-2 rounded text-xxs font-medium/,
    'the result set tab base classes must not bold every tab'
  );
  assert.match(
    source,
    /activeTabIndex === idx\s*\?\s*'bg-primary\/15 text-primary border border-primary\/40 font-semibold shadow-xs'/,
    'the selected result set tab keeps its emphasis'
  );
});

test('the multi result set grid badge drops the theme bold weight', () => {
  const source = readSource('src/components/results/ResultGridItem.vue');
  assert.match(
    source,
    /v-if="totalSets > 1"[\s\S]{0,200}?Result #\$\{setIndex \+ 1\}/,
    'the badge must stay gated to multi result set grids'
  );

  const badge = source.match(/Result #\$\{setIndex \+ 1\}[\s\S]{0,200}?class="([^"]*)"/);
  assert.ok(badge, 'the badge class list must stay easy to locate');
  assert.match(
    badge![1]!,
    /!font-normal/,
    'the Aura tag theme bolds every .p-tag, so this badge has to reset the weight'
  );
  assert.doesNotMatch(badge![1]!, /font-(medium|semibold|bold)/);
});
