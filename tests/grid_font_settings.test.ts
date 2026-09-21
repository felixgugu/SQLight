import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

test('all AG Grid instances bind the configurable grid font variable', () => {
  const gridViews = [
    'src/components/results/ResultGridItem.vue',
    'src/components/editor/TableStructureViewer.vue',
    'src/components/editor/TableDataViewer.vue',
  ];

  for (const path of gridViews) {
    const source = readSource(path);
    assert.match(
      source,
      /:style="\{ '--ag-font-family': settingsStore\.gridFontFamily \}"/,
      `${path} should bind --ag-font-family to gridFontFamily`
    );
  }
});

test('AG Grid CSS overrides explicit Tailwind mono cells', () => {
  const css = readSource('src/assets/main.css');
  assert.match(
    css,
    /\.ag-styled-root \.font-mono \{\s*font-family: var\(--ag-font-family\) !important;/,
  );
});

test('AG Grid theme fallback uses the shared default font', () => {
  const source = readSource('src/styles/gridTheme.ts');
  assert.match(
    source,
    /import \{ DEFAULT_GRID_FONT_FAMILY \} from '@\/data\/fontOptions';/,
  );
  assert.equal((source.match(/fontFamily: DEFAULT_GRID_FONT_FAMILY/g) || []).length, 2);
});
