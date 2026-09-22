import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CUSTOM_FONT_VALUE,
  isPresetFontFamily,
  normalizeFontFamily,
} from '../src/utils/fontFamily';

const OPTIONS = [
  { label: 'Consolas', value: 'Consolas, Monaco, monospace' },
  { label: 'System', value: 'monospace' },
];

describe('Font family picker utilities', () => {
  test('CUSTOM_FONT_VALUE is a non-font sentinel', () => {
    assert.equal(typeof CUSTOM_FONT_VALUE, 'string');
    assert.ok(CUSTOM_FONT_VALUE.length > 0);
    assert.ok(!OPTIONS.some((option) => option.value === CUSTOM_FONT_VALUE));
  });

  test('isPresetFontFamily matches preset values exactly', () => {
    assert.equal(isPresetFontFamily('monospace', OPTIONS), true);
    assert.equal(isPresetFontFamily('  monospace  ', OPTIONS), true);
    assert.equal(
      isPresetFontFamily('Consolas, Monaco, monospace', OPTIONS),
      true
    );
  });

  test('isPresetFontFamily treats custom and blank values as non-preset', () => {
    assert.equal(isPresetFontFamily('"Noto Sans TC", sans-serif', OPTIONS), false);
    assert.equal(isPresetFontFamily('', OPTIONS), false);
    assert.equal(isPresetFontFamily('   ', OPTIONS), false);
    assert.equal(isPresetFontFamily(null, OPTIONS), false);
    assert.equal(isPresetFontFamily(undefined, OPTIONS), false);
  });

  test('normalizeFontFamily trims and falls back when blank', () => {
    assert.equal(normalizeFontFamily('  monospace  ', 'fallback'), 'monospace');
    assert.equal(normalizeFontFamily('"Noto Sans TC"', 'fallback'), '"Noto Sans TC"');
    assert.equal(normalizeFontFamily('', 'fallback'), 'fallback');
    assert.equal(normalizeFontFamily('   ', 'fallback'), 'fallback');
    assert.equal(normalizeFontFamily(null, 'fallback'), 'fallback');
    assert.equal(normalizeFontFamily(undefined, 'fallback'), 'fallback');
  });

  test('SettingsModal uses the FontFamilyPicker for all three font settings', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/modals/SettingsModal.vue'),
      'utf-8'
    );
    const usages = source.match(/<FontFamilyPicker/g) || [];
    assert.equal(usages.length, 3);
    assert.match(source, /import FontFamilyPicker from '@\/components\/common\/FontFamilyPicker\.vue';/);
    for (const binding of [
      'settingsStore.globalFontFamily',
      'settingsStore.editorFontFamily',
      'settingsStore.gridFontFamily',
    ]) {
      assert.ok(source.includes(binding), `expected binding for ${binding}`);
    }
  });
});
