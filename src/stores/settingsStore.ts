import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface AppSettings {
  editorFontSize: number;
  editorFontFamily: string;
  editorWordWrap: 'on' | 'off';
  editorTabSize: number;
  maxResultTabs: number;
  defaultMaxRows: number | null;
  editorHighlightColor: string;
  activeSqlTabBgColor: string;
  activeSqlTabTextColor: string;
  activeResultTabBgColor: string;
  activeResultTabTextColor: string;
  erTheme: 'dark' | 'light';
}

const STORAGE_KEY = 'sqlight_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 13,
  editorFontFamily: '"Fira Code", Consolas, Monaco, monospace',
  editorWordWrap: 'on',
  editorTabSize: 2,
  maxResultTabs: 10,
  defaultMaxRows: 10000,
  editorHighlightColor: '#feffe0',
  activeSqlTabBgColor: '#1e40af',
  activeSqlTabTextColor: '#ffffff',
  activeResultTabBgColor: '#065f46',
  activeResultTabTextColor: '#ffffff',
  erTheme: 'dark',
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load app settings from localStorage:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = loadSettings();

  const editorFontSize = ref<number>(initial.editorFontSize);
  const editorFontFamily = ref<string>(initial.editorFontFamily);
  const editorWordWrap = ref<'on' | 'off'>(initial.editorWordWrap);
  const editorTabSize = ref<number>(initial.editorTabSize);
  const maxResultTabs = ref<number>(initial.maxResultTabs);
  const defaultMaxRows = ref<number | null>(initial.defaultMaxRows);
  const editorHighlightColor = ref<string>(initial.editorHighlightColor || '#feffe0');
  const activeSqlTabBgColor = ref<string>(initial.activeSqlTabBgColor || '#1e40af');
  const activeSqlTabTextColor = ref<string>(initial.activeSqlTabTextColor || '#ffffff');
  const activeResultTabBgColor = ref<string>(initial.activeResultTabBgColor || '#065f46');
  const activeResultTabTextColor = ref<string>(initial.activeResultTabTextColor || '#ffffff');
  const erTheme = ref<'dark' | 'light'>(initial.erTheme || 'dark');

  function saveSettings() {
    const data: AppSettings = {
      editorFontSize: editorFontSize.value,
      editorFontFamily: editorFontFamily.value,
      editorWordWrap: editorWordWrap.value,
      editorTabSize: editorTabSize.value,
      maxResultTabs: maxResultTabs.value,
      defaultMaxRows: defaultMaxRows.value,
      editorHighlightColor: editorHighlightColor.value,
      activeSqlTabBgColor: activeSqlTabBgColor.value,
      activeSqlTabTextColor: activeSqlTabTextColor.value,
      activeResultTabBgColor: activeResultTabBgColor.value,
      activeResultTabTextColor: activeResultTabTextColor.value,
      erTheme: erTheme.value,
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
      editorFontSize,
      editorFontFamily,
      editorWordWrap,
      editorTabSize,
      maxResultTabs,
      defaultMaxRows,
      editorHighlightColor,
      activeSqlTabBgColor,
      activeSqlTabTextColor,
      activeResultTabBgColor,
      activeResultTabTextColor,
      erTheme,
    ],
    () => {
      saveSettings();
    }
  );

  function resetToDefaults() {
    editorFontSize.value = DEFAULT_SETTINGS.editorFontSize;
    editorFontFamily.value = DEFAULT_SETTINGS.editorFontFamily;
    editorWordWrap.value = DEFAULT_SETTINGS.editorWordWrap;
    editorTabSize.value = DEFAULT_SETTINGS.editorTabSize;
    maxResultTabs.value = DEFAULT_SETTINGS.maxResultTabs;
    defaultMaxRows.value = DEFAULT_SETTINGS.defaultMaxRows;
    editorHighlightColor.value = DEFAULT_SETTINGS.editorHighlightColor;
    activeSqlTabBgColor.value = DEFAULT_SETTINGS.activeSqlTabBgColor;
    activeSqlTabTextColor.value = DEFAULT_SETTINGS.activeSqlTabTextColor;
    activeResultTabBgColor.value = DEFAULT_SETTINGS.activeResultTabBgColor;
    activeResultTabTextColor.value = DEFAULT_SETTINGS.activeResultTabTextColor;
    erTheme.value = DEFAULT_SETTINGS.erTheme;
  }

  return {
    editorFontSize,
    editorFontFamily,
    editorWordWrap,
    editorTabSize,
    maxResultTabs,
    defaultMaxRows,
    editorHighlightColor,
    activeSqlTabBgColor,
    activeSqlTabTextColor,
    activeResultTabBgColor,
    activeResultTabTextColor,
    erTheme,
    saveSettings,
    resetToDefaults,
  };
});
