import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  type FilterRule,
  type FilterTarget,
  type HiddenTableRule,
  isTableHiddenByRules,
  isDatabaseHiddenByRules,
  testFilterPatternByRules,
  testTablePatternByRules,
} from '@/utils/tableFilter';

import {
  DEFAULT_GLOBAL_FONT_FAMILY,
  themeManager,
  type ThemePresetName,
} from '@/services/themeManager';
import { DEFAULT_GRID_FONT_FAMILY } from '@/data/fontOptions';

export type { FilterRule, FilterTarget, HiddenTableRule, ThemePresetName };

export interface AppSettings {
  // Theme & Appearance
  colorMode: 'dark' | 'light';
  themePreset: ThemePresetName;
  primaryColor: string;
  surfaceColor: string;
  ripple: boolean;
  globalFontFamily: string;

  editorFontSize: number;
  editorFontFamily: string;
  editorWordWrap: 'on' | 'off';
  editorTabSize: number;
  maxResultTabs: number;
  defaultMaxRows: number | null;
  editorHighlightColor: string;
  activeSqlTabBgColor: string;
  activeSqlTabTextColor: string;
  gridFontFamily: string;
  erTheme: 'dark' | 'light';
  hiddenTableRules?: FilterRule[];
}

const STORAGE_KEY = 'sqlight_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  colorMode: 'dark',
  themePreset: 'Aura',
  primaryColor: 'blue',
  surfaceColor: 'slate',
  ripple: true,
  globalFontFamily: DEFAULT_GLOBAL_FONT_FAMILY,

  editorFontSize: 13,
  editorFontFamily: '"Fira Code", Consolas, Monaco, monospace',
  editorWordWrap: 'on',
  editorTabSize: 2,
  maxResultTabs: 10,
  defaultMaxRows: 10000,
  editorHighlightColor: '#feffe0',
  activeSqlTabBgColor: '#1e40af',
  activeSqlTabTextColor: '#ffffff',
  gridFontFamily: DEFAULT_GRID_FONT_FAMILY,
  erTheme: 'dark',
  hiddenTableRules: [],
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.hiddenTableRules)) {
        parsed.hiddenTableRules = parsed.hiddenTableRules.map((r: any) => ({
          ...r,
          target: r.target || 'all',
        }));
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load app settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadSettings();

  const colorMode = ref<'dark' | 'light'>(initial.colorMode || 'dark');
  const themePreset = ref<ThemePresetName>(initial.themePreset || 'Aura');
  const primaryColor = ref<string>(initial.primaryColor || 'blue');
  const surfaceColor = ref<string>(initial.surfaceColor || 'slate');
  const ripple = ref<boolean>(initial.ripple ?? true);
  const globalFontFamily = ref<string>(initial.globalFontFamily || DEFAULT_GLOBAL_FONT_FAMILY);

  const editorFontSize = ref<number>(initial.editorFontSize);
  const editorFontFamily = ref<string>(initial.editorFontFamily);
  const editorWordWrap = ref<'on' | 'off'>(initial.editorWordWrap);
  const editorTabSize = ref<number>(initial.editorTabSize);
  const maxResultTabs = ref<number>(initial.maxResultTabs);
  const defaultMaxRows = ref<number | null>(initial.defaultMaxRows);
  const editorHighlightColor = ref<string>(initial.editorHighlightColor || '#feffe0');
  const activeSqlTabBgColor = ref<string>(initial.activeSqlTabBgColor || '#1e40af');
  const activeSqlTabTextColor = ref<string>(initial.activeSqlTabTextColor || '#ffffff');
  const gridFontFamily = ref<string>(initial.gridFontFamily || DEFAULT_GRID_FONT_FAMILY);
  const erTheme = ref<'dark' | 'light'>(initial.erTheme || 'dark');
  const hiddenTableRules = ref<FilterRule[]>(
    initial.hiddenTableRules
      ? initial.hiddenTableRules.map((r) => ({ ...r, target: r.target || 'all' }))
      : []
  );

  function setColorMode(mode: 'dark' | 'light') {
    colorMode.value = mode;
    erTheme.value = mode;
    themeManager.applyColorMode(mode);
  }

  function setThemePreset(preset: ThemePresetName) {
    themePreset.value = preset;
    themeManager.applyThemePreset(preset, primaryColor.value, surfaceColor.value);
  }

  function setPrimaryColor(color: string) {
    primaryColor.value = color;
    themeManager.applyPrimaryColor(color);
  }

  function setSurfaceColor(surface: string) {
    surfaceColor.value = surface;
    themeManager.applySurfaceColor(surface);
  }

  function setRipple(enabled: boolean, primevueConfig?: any) {
    ripple.value = enabled;
    themeManager.applyRipple(enabled, primevueConfig);
  }

  function setGlobalFontFamily(fontFamily: string) {
    globalFontFamily.value = fontFamily;
    themeManager.applyGlobalFontFamily(fontFamily);
  }

  function addFilterRule(pattern: string, target: FilterTarget = 'all', description?: string) {
    const trimmed = pattern.trim();
    if (!trimmed) return;
    hiddenTableRules.value.push({
      id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      pattern: trimmed,
      target,
      enabled: true,
      description: description?.trim() || undefined,
    });
  }

  function addHiddenTableRule(pattern: string, description?: string) {
    addFilterRule(pattern, 'all', description);
  }

  function removeHiddenTableRule(id: string) {
    hiddenTableRules.value = hiddenTableRules.value.filter((r) => r.id !== id);
  }

  function toggleHiddenTableRule(id: string, enabled?: boolean) {
    const rule = hiddenTableRules.value.find((r) => r.id === id);
    if (rule) {
      rule.enabled = enabled !== undefined ? enabled : !rule.enabled;
    }
  }

  function updateFilterRule(
    id: string,
    updates: {
      pattern?: string;
      target?: FilterTarget;
      enabled?: boolean;
      description?: string;
    }
  ) {
    const rule = hiddenTableRules.value.find((r) => r.id === id);
    if (!rule) return;
    if (updates.pattern !== undefined) {
      const trimmed = updates.pattern.trim();
      if (trimmed) {
        rule.pattern = trimmed;
      }
    }
    if (updates.target !== undefined) {
      rule.target = updates.target;
    }
    if (updates.enabled !== undefined) {
      rule.enabled = updates.enabled;
    }
    if (updates.description !== undefined) {
      rule.description = updates.description.trim() || undefined;
    }
  }

  function isTableHidden(tableName: string, schema?: string): boolean {
    return isTableHiddenByRules(hiddenTableRules.value, tableName, schema);
  }

  function isDatabaseHidden(databaseName: string): boolean {
    return isDatabaseHiddenByRules(hiddenTableRules.value, databaseName);
  }

  function testFilterPattern(
    name: string,
    target: 'database' | 'table',
    schema?: string
  ): { isHidden: boolean; matchedPattern?: string; matchedTarget?: FilterTarget } {
    return testFilterPatternByRules(hiddenTableRules.value, name, target, schema);
  }

  function testTablePattern(tableName: string, schema?: string): { isHidden: boolean; matchedPattern?: string } {
    return testTablePatternByRules(hiddenTableRules.value, tableName, schema);
  }

  function saveSettings() {
    const data: AppSettings = {
      colorMode: colorMode.value,
      themePreset: themePreset.value,
      primaryColor: primaryColor.value,
      surfaceColor: surfaceColor.value,
      ripple: ripple.value,
      globalFontFamily: globalFontFamily.value,
      editorFontSize: editorFontSize.value,
      editorFontFamily: editorFontFamily.value,
      editorWordWrap: editorWordWrap.value,
      editorTabSize: editorTabSize.value,
      maxResultTabs: maxResultTabs.value,
      defaultMaxRows: defaultMaxRows.value,
      editorHighlightColor: editorHighlightColor.value,
      activeSqlTabBgColor: activeSqlTabBgColor.value,
      activeSqlTabTextColor: activeSqlTabTextColor.value,
      gridFontFamily: gridFontFamily.value,
      erTheme: erTheme.value,
      hiddenTableRules: hiddenTableRules.value,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to persist settings:', e);
    }
  }

  // Watch for any changes to auto-persist
  watch(
    [
      colorMode,
      themePreset,
      primaryColor,
      surfaceColor,
      ripple,
      globalFontFamily,
      editorFontSize,
      editorFontFamily,
      editorWordWrap,
      editorTabSize,
      maxResultTabs,
      defaultMaxRows,
      editorHighlightColor,
      activeSqlTabBgColor,
      activeSqlTabTextColor,
      gridFontFamily,
      erTheme,
      hiddenTableRules,
    ],
    () => {
      saveSettings();
    },
    { deep: true }
  );

  function resetToDefaults() {
    setColorMode(DEFAULT_SETTINGS.colorMode);
    setThemePreset(DEFAULT_SETTINGS.themePreset);
    setPrimaryColor(DEFAULT_SETTINGS.primaryColor);
    setSurfaceColor(DEFAULT_SETTINGS.surfaceColor);
    setRipple(DEFAULT_SETTINGS.ripple);
    setGlobalFontFamily(DEFAULT_SETTINGS.globalFontFamily);

    editorFontSize.value = DEFAULT_SETTINGS.editorFontSize;
    editorFontFamily.value = DEFAULT_SETTINGS.editorFontFamily;
    editorWordWrap.value = DEFAULT_SETTINGS.editorWordWrap;
    editorTabSize.value = DEFAULT_SETTINGS.editorTabSize;
    maxResultTabs.value = DEFAULT_SETTINGS.maxResultTabs;
    defaultMaxRows.value = DEFAULT_SETTINGS.defaultMaxRows;
    editorHighlightColor.value = DEFAULT_SETTINGS.editorHighlightColor;
    activeSqlTabBgColor.value = DEFAULT_SETTINGS.activeSqlTabBgColor;
    activeSqlTabTextColor.value = DEFAULT_SETTINGS.activeSqlTabTextColor;
    gridFontFamily.value = DEFAULT_SETTINGS.gridFontFamily;
    erTheme.value = DEFAULT_SETTINGS.erTheme;
    hiddenTableRules.value = [];
  }

  return {
    colorMode,
    themePreset,
    primaryColor,
    surfaceColor,
    ripple,
    globalFontFamily,
    setColorMode,
    setThemePreset,
    setPrimaryColor,
    setSurfaceColor,
    setRipple,
    setGlobalFontFamily,
    editorFontSize,
    editorFontFamily,
    editorWordWrap,
    editorTabSize,
    maxResultTabs,
    defaultMaxRows,
    editorHighlightColor,
    activeSqlTabBgColor,
    activeSqlTabTextColor,
    gridFontFamily,
    erTheme,
    hiddenTableRules,
    addFilterRule,
    addHiddenTableRule,
    updateFilterRule,
    removeFilterRule: removeHiddenTableRule,
    removeHiddenTableRule,
    toggleFilterRule: toggleHiddenTableRule,
    toggleHiddenTableRule,
    isTableHidden,
    isDatabaseHidden,
    testFilterPattern,
    testTablePattern,
    saveSettings,
    resetToDefaults,
  };
});
