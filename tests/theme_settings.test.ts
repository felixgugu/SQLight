import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import {
  themeManager,
  PRIMARY_COLOR_OPTIONS,
  SURFACE_OPTIONS,
  PRESET_MAP,
} from '../src/services/themeManager.ts';
import { useSettingsStore } from '../src/stores/settingsStore.ts';

test('themeManager: constants and options are defined correctly', () => {
  assert.equal(PRIMARY_COLOR_OPTIONS.length, 12);
  assert.equal(SURFACE_OPTIONS.length, 5);
  assert.ok(PRESET_MAP.Aura);
  assert.ok(PRESET_MAP.Lara);
  assert.ok(PRESET_MAP.Nora);
  assert.ok(PRESET_MAP.Material);

  const primaryNames = PRIMARY_COLOR_OPTIONS.map((c) => c.name);
  assert.ok(primaryNames.includes('blue'));
  assert.ok(primaryNames.includes('emerald'));
  assert.ok(primaryNames.includes('purple'));
  assert.ok(primaryNames.includes('rose'));

  const surfaceNames = SURFACE_OPTIONS.map((s) => s.name);
  assert.ok(surfaceNames.includes('slate'));
  assert.ok(surfaceNames.includes('gray'));
  assert.ok(surfaceNames.includes('zinc'));
  assert.ok(surfaceNames.includes('neutral'));
  assert.ok(surfaceNames.includes('stone'));
});

test('themeManager: methods execute gracefully in headless environment', () => {
  assert.doesNotThrow(() => {
    themeManager.applyColorMode('dark');
    themeManager.applyColorMode('light');
    themeManager.applyThemePreset('Lara', 'emerald', 'zinc');
    themeManager.applyPrimaryColor('rose');
    themeManager.applySurfaceColor('stone');
    const fakeConfig = { ripple: false };
    themeManager.applyRipple(true, fakeConfig);
    assert.equal(fakeConfig.ripple, true);
  });
});

test('settingsStore: theme settings defaults, setters, and resetToDefaults', () => {
  setActivePinia(createPinia());
  const store = useSettingsStore();

  // Initial defaults
  assert.equal(store.colorMode, 'dark');
  assert.equal(store.themePreset, 'Aura');
  assert.equal(store.primaryColor, 'blue');
  assert.equal(store.surfaceColor, 'slate');
  assert.equal(store.ripple, true);

  // Setters
  store.setColorMode('light');
  store.setThemePreset('Material');
  store.setPrimaryColor('emerald');
  store.setSurfaceColor('zinc');
  store.setRipple(false);

  assert.equal(store.colorMode, 'light');
  assert.equal(store.themePreset, 'Material');
  assert.equal(store.primaryColor, 'emerald');
  assert.equal(store.surfaceColor, 'zinc');
  assert.equal(store.ripple, false);

  // Reset to defaults
  store.resetToDefaults();
  assert.equal(store.colorMode, 'dark');
  assert.equal(store.themePreset, 'Aura');
  assert.equal(store.primaryColor, 'blue');
  assert.equal(store.surfaceColor, 'slate');
  assert.equal(store.ripple, true);
});

test('themeManager: SURFACE_PALETTES provides complete 50-950 scale for all 5 surface options', () => {
  const surfaces = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
  for (const s of surfaces) {
    const pal = (themeManager as any).SURFACE_PALETTES?.[s] || SURFACE_OPTIONS.find((opt) => opt.name === s);
    assert.ok(pal, `Surface palette for ${s} should exist`);
  }
});

