import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAB_CATEGORY_THEMES, getTabThemeStyle } from '../src/utils/tabTheme';
import type { TabType } from '../src/types/workspace';

const ALL_TAB_TYPES: TabType[] = [
  'sql_editor',
  'table_data',
  'table_structure',
  'execution_plan',
  'er_diagram',
];

test('TAB_CATEGORY_THEMES defines distinct color schemes for all 5 workspace tab types', () => {
  assert.equal(Object.keys(TAB_CATEGORY_THEMES).length, 5);

  const activeBgs = new Set<string>();
  const topAccents = new Set<string>();
  const iconColors = new Set<string>();

  for (const type of ALL_TAB_TYPES) {
    const theme = TAB_CATEGORY_THEMES[type];
    assert.ok(theme, `Theme for ${type} must exist`);
    assert.equal(theme.type, type);
    assert.ok(theme.label, `Label for ${type} must exist`);

    // Verify Active properties
    assert.ok(theme.active.bg);
    assert.ok(theme.active.border);
    assert.ok(theme.active.topAccent);
    assert.ok(theme.active.text);
    assert.ok(theme.active.badgeBg);

    // Verify Inactive properties
    assert.ok(theme.inactive.bg);
    assert.ok(theme.inactive.border);
    assert.ok(theme.inactive.topAccent);
    assert.ok(theme.inactive.text);
    assert.ok(theme.inactive.hoverBg);
    assert.ok(theme.inactive.hoverBorder);
    assert.ok(theme.inactive.hoverText);

    // Each category must have a unique active background and top accent
    activeBgs.add(theme.active.bg);
    topAccents.add(theme.inactive.topAccent);
    iconColors.add(theme.iconColor);
  }

  // All 5 categories must be visually distinct
  assert.equal(activeBgs.size, 5, 'All 5 categories must have unique active backgrounds');
  assert.equal(topAccents.size, 5, 'All 5 categories must have unique inactive top accents');
  assert.equal(iconColors.size, 5, 'All 5 categories must have unique icon colors');
});

test('getTabThemeStyle produces expected CSS variables for Active and Inactive states', () => {
  // 1. Table Data Inactive
  const inactiveDataStyle = getTabThemeStyle('table_data', false);
  assert.equal(inactiveDataStyle['--tab-top-accent'], '#10b981');
  assert.ok(inactiveDataStyle['--tab-bg'].includes('rgba'));
  assert.ok(inactiveDataStyle['--tab-hover-bg'].includes('rgba'));
  assert.equal(inactiveDataStyle['--tab-icon-color'], '#34d399');

  // 2. Table Data Active
  const activeDataStyle = getTabThemeStyle('table_data', true);
  assert.equal(activeDataStyle['--tab-bg'], '#065f46');
  assert.equal(activeDataStyle['--tab-text'], '#ffffff');
  assert.equal(activeDataStyle['--tab-top-accent'], '#34d399');

  // 3. ER Diagram Inactive vs Active
  const inactiveErStyle = getTabThemeStyle('er_diagram', false);
  assert.equal(inactiveErStyle['--tab-top-accent'], '#06b6d4');
  assert.equal(inactiveErStyle['--tab-icon-color'], '#22d3ee');

  const activeErStyle = getTabThemeStyle('er_diagram', true);
  assert.equal(activeErStyle['--tab-bg'], '#155e75');
  assert.equal(activeErStyle['--tab-border'], '#06b6d4');
});

test('getTabThemeStyle allows custom SQL colors to override sql_editor active tab only', () => {
  const customBg = '#4338ca';
  const customText = '#fef08a';

  // sql_editor with custom colors
  const activeSqlStyle = getTabThemeStyle('sql_editor', true, customBg, customText);
  assert.equal(activeSqlStyle['--tab-bg'], customBg);
  assert.equal(activeSqlStyle['--tab-text'], customText);
  assert.equal(activeSqlStyle['--tab-border'], customBg);

  // table_data active should NOT be overridden by custom SQL colors
  const activeDataStyle = getTabThemeStyle('table_data', true, customBg, customText);
  assert.equal(activeDataStyle['--tab-bg'], '#065f46');
  assert.equal(activeDataStyle['--tab-text'], '#ffffff');

  // er_diagram active should NOT be overridden by custom SQL colors
  const activeErStyle = getTabThemeStyle('er_diagram', true, customBg, customText);
  assert.equal(activeErStyle['--tab-bg'], '#155e75');
});
