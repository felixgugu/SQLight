import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf-8');
}

/**
 * The "全域介面字型" setting writes --app-font-sans, which only reaches elements styled with
 * Tailwind's font-sans utility. Any surface that hardcodes a monospace stack silently opts out
 * of the setting, which is how the Explorer tree and the ER diagram used to behave.
 */
const GLOBAL_FONT_SURFACES = [
  'src/components/layout/AppSidebar.vue',
  'src/components/layout/SqlFolderExplorer.vue',
  'src/components/layout/SqlFileTreeNode.vue',
  'src/components/editor/ErTableNode.vue',
  'src/components/editor/ErDiagramViewer.vue',
];

test('no Explorer or ER diagram surface pins text to a hardcoded monospace font', () => {
  for (const path of GLOBAL_FONT_SURFACES) {
    const source = readSource(path);
    assert.doesNotMatch(
      source,
      /font-mono/,
      `${path} must not use the font-mono utility; it must follow the global UI font`
    );
    assert.doesNotMatch(
      source,
      /'monospace'/,
      `${path} must not hardcode a monospace font family`
    );
  }
});

test('the font-sans utility resolves to the configurable global font variable', () => {
  const config = readSource('tailwind.config.js');
  assert.match(
    config,
    /sans:\s*\['var\(--app-font-sans\)'\]/,
    "Tailwind's font-sans must map to var(--app-font-sans) for the setting to take effect"
  );
});

test('the Explorer tree content area opts into the global UI font', () => {
  const source = readSource('src/components/layout/AppSidebar.vue');
  assert.match(
    source,
    /<div class="flex-1 overflow-y-auto px-1\.5 py-2 text-xs font-sans">/,
    'the tree content container must declare font-sans'
  );
});

test('ER cardinality badges read their font from the global font setting', () => {
  const source = readSource('src/components/editor/ErDiagramViewer.vue');
  assert.match(
    source,
    /fontFamily: erCanvasFontFamily\.value/,
    'canvas labels must bind the configured global font family'
  );
  assert.match(
    source,
    /settingsStore\.globalFontFamily \|\| DEFAULT_GLOBAL_FONT_FAMILY/,
    'canvas labels must fall back to the shared default global font'
  );
});

/**
 * Explorer text is intentionally unweighted: hierarchy comes from indentation, icons and
 * colour, so node labels stay at the regular weight instead of turning bold.
 */
const EXPLORER_TEXT_FILES = [
  'src/components/layout/AppSidebar.vue',
  'src/components/layout/SqlFolderExplorer.vue',
  'src/components/layout/SqlFileTreeNode.vue',
];

test('Explorer text is never bold', () => {
  for (const path of EXPLORER_TEXT_FILES) {
    const source = readSource(path);
    assert.doesNotMatch(
      source,
      /font-(medium|semibold|bold)\b/,
      `${path} must not apply a bold text weight inside the Explorer`
    );
  }
});

test('the Explorer status tag overrides the bold PrimeVue tag weight', () => {
  const source = readSource('src/components/layout/AppSidebar.vue');
  assert.match(
    source,
    /value="使用中"[\s\S]{0,200}?class="[^"]*!font-normal/,
    'the 使用中 tag must be explicitly reset to the regular weight'
  );
});
