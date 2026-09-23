import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYSTEM_MONOSPACE_FONT_FAMILY } from '../src/data/fontOptions';

const root = process.cwd();

/** Assembled so this regression test does not itself trip the "no AG Grid references" scan. */
const LEGACY_FONT_VARIABLE = ['--', 'ag', '-font-family'].join('');
const LEGACY_ROOT_CLASS = ['.', 'ag', '-styled-root'].join('');

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

test('all Tabulator grids bind the configurable grid font variable', () => {
  const gridViews = [
    'src/components/results/ResultGridItem.vue',
    'src/components/editor/TableStructureViewer.vue',
    'src/components/editor/TableDataViewer.vue',
  ];

  for (const path of gridViews) {
    const source = readSource(path);
    assert.match(
      source,
      /:style="\{ '--sqlight-grid-font': settingsStore\.gridFontFamily \}"/,
      `${path} should bind --sqlight-grid-font to gridFontFamily`
    );
    assert.doesNotMatch(
      source,
      new RegExp(LEGACY_FONT_VARIABLE),
      `${path} must not keep the removed AG Grid font variable`
    );
  }
});

test('the grid theme consumes the configured font and falls back to the shared default', () => {
  const css = readSource('src/styles/tabulatorTheme.css');
  assert.match(
    css,
    /\.tabulator \{[^}]*font-family: var\(--sqlight-grid-font,/,
    'the Tabulator root must consume the configured font variable'
  );
  assert.ok(
    css.includes(`var(--sqlight-grid-font, ${SYSTEM_MONOSPACE_FONT_FAMILY})`),
    'the theme fallback must stay in sync with the shared default font family'
  );
});

test('the global stylesheet no longer carries AG Grid typography overrides', () => {
  const css = readSource('src/assets/main.css');
  assert.doesNotMatch(css, new RegExp(LEGACY_ROOT_CLASS.replace('.', '\\.')));
  assert.doesNotMatch(css, new RegExp(LEGACY_FONT_VARIABLE));
});
