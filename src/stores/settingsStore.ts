import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface AppSettings {
  editorFontSize: number;
  editorFontFamily: string;
  editorWordWrap: 'on' | 'off';
  editorTabSize: number;
  maxResultTabs: number;
  defaultMaxRows: number | null;
}

const STORAGE_KEY = 'sqlight_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  editorFontSize: 13,
  editorFontFamily: '"Fira Code", Consolas, Monaco, monospace',
  editorWordWrap: 'on',
  editorTabSize: 2,
  maxResultTabs: 10,
  defaultMaxRows: 10000,
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

  function saveSettings() {
    const data: AppSettings = {
      editorFontSize: editorFontSize.value,
      editorFontFamily: editorFontFamily.value,
      editorWordWrap: editorWordWrap.value,
      editorTabSize: editorTabSize.value,
      maxResultTabs: maxResultTabs.value,
      defaultMaxRows: defaultMaxRows.value,
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
  }

  return {
    editorFontSize,
    editorFontFamily,
    editorWordWrap,
    editorTabSize,
    maxResultTabs,
    defaultMaxRows,
    resetToDefaults,
  };
});
