import Aura from '@primevue/themes/aura';
import Lara from '@primevue/themes/lara';
import Nora from '@primevue/themes/nora';
import Material from '@primevue/themes/material';
import { usePreset, updatePrimaryPalette, updateSurfacePalette, palette } from '@primevue/themes';
import type { AppSettings } from '@/stores/settingsStore';

export type ThemePresetName = 'Aura' | 'Lara' | 'Nora' | 'Material';

export const PRESET_MAP: Record<ThemePresetName, any> = {
  Aura,
  Lara,
  Nora,
  Material,
};

export interface ThemeColorOption {
  name: string;
  label: string;
  color: string;
  token: string;
}

export const PRIMARY_COLOR_OPTIONS: ThemeColorOption[] = [
  { name: 'blue', label: '科技藍 (Blue)', color: '#3b82f6', token: '{blue}' },
  { name: 'emerald', label: '翡翠綠 (Emerald)', color: '#10b981', token: '{emerald}' },
  { name: 'green', label: '自然綠 (Green)', color: '#22c55e', token: '{green}' },
  { name: 'teal', label: '藍綠色 (Teal)', color: '#14b8a6', token: '{teal}' },
  { name: 'cyan', label: '青藍色 (Cyan)', color: '#06b6d4', token: '{cyan}' },
  { name: 'sky', label: '天空藍 (Sky)', color: '#0ea5e9', token: '{sky}' },
  { name: 'indigo', label: '深靛藍 (Indigo)', color: '#6366f1', token: '{indigo}' },
  { name: 'violet', label: '紫羅蘭 (Violet)', color: '#8b5cf6', token: '{violet}' },
  { name: 'purple', label: '高貴紫 (Purple)', color: '#a855f7', token: '{purple}' },
  { name: 'amber', label: '琥珀金 (Amber)', color: '#f59e0b', token: '{amber}' },
  { name: 'orange', label: '活力橘 (Orange)', color: '#f97316', token: '{orange}' },
  { name: 'rose', label: '玫瑰紅 (Rose)', color: '#f43f5e', token: '{rose}' },
];

export interface SurfaceOption {
  name: string;
  label: string;
  sampleDark: string;
  sampleLight: string;
  token: string;
}

export const SURFACE_OPTIONS: SurfaceOption[] = [
  { name: 'slate', label: '微藍冷調 (Slate)', sampleDark: '#0f172a', sampleLight: '#f8fafc', token: '{slate}' },
  { name: 'gray', label: '中性經典 (Gray)', sampleDark: '#111827', sampleLight: '#f9fafb', token: '{gray}' },
  { name: 'zinc', label: '現代金屬 (Zinc)', sampleDark: '#18181b', sampleLight: '#fafafa', token: '{zinc}' },
  { name: 'neutral', label: '極簡純淨 (Neutral)', sampleDark: '#171717', sampleLight: '#fafafa', token: '{neutral}' },
  { name: 'stone', label: '微暖石灰 (Stone)', sampleDark: '#1c1917', sampleLight: '#fafaf9', token: '{stone}' },
];

export const themeManager = {
  /**
   * Apply Theme Preset (Aura, Lara, Nora, Material)
   */
  applyThemePreset(presetName: ThemePresetName, primaryColor?: string, surfaceColor?: string) {
    const preset = PRESET_MAP[presetName] || Aura;
    try {
      usePreset(preset);
      if (primaryColor) {
        this.applyPrimaryColor(primaryColor);
      }
      if (surfaceColor) {
        this.applySurfaceColor(surfaceColor);
      }
    } catch (e) {
      console.warn(`[themeManager] Failed to apply preset "${presetName}":`, e);
    }
  },

  /**
   * Apply Primary Color Palette
   */
  applyPrimaryColor(colorNameOrHex: string) {
    if (!colorNameOrHex) return;
    try {
      const match = PRIMARY_COLOR_OPTIONS.find((c) => c.name === colorNameOrHex || c.color === colorNameOrHex);
      if (match) {
        updatePrimaryPalette(palette(match.token));
      } else if (colorNameOrHex.startsWith('#')) {
        updatePrimaryPalette(palette(colorNameOrHex));
      } else {
        updatePrimaryPalette(palette(`{${colorNameOrHex}}`));
      }
    } catch (e) {
      console.warn(`[themeManager] Failed to update primary palette "${colorNameOrHex}":`, e);
    }
  },

  /**
   * Apply Surface Color Palette
   */
  applySurfaceColor(surfaceName: string) {
    if (!surfaceName) return;
    try {
      const match = SURFACE_OPTIONS.find((s) => s.name === surfaceName);
      const token = match ? match.token : `{${surfaceName}}`;
      const pal = palette(token) as Record<string, any>;
      updateSurfacePalette({
        0: '#ffffff',
        ...pal,
      });
    } catch (e) {
      console.warn(`[themeManager] Failed to update surface palette "${surfaceName}":`, e);
    }
  },

  /**
   * Apply Dark / Light Color Mode
   */
  applyColorMode(mode: 'dark' | 'light') {
    const isDark = mode === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
  },

  /**
   * Apply Ripple Effect
   */
  applyRipple(enabled: boolean, primevueConfig?: any) {
    if (primevueConfig) {
      primevueConfig.ripple = enabled;
    }
  },

  /**
   * Initialize all theme settings from stored preferences
   */
  initTheme(settings: AppSettings, primevueConfig?: any) {
    this.applyColorMode(settings.colorMode || 'dark');
    this.applyThemePreset(settings.themePreset || 'Aura');
    this.applyPrimaryColor(settings.primaryColor || 'blue');
    this.applySurfaceColor(settings.surfaceColor || 'slate');
    this.applyRipple(settings.ripple ?? true, primevueConfig);
  },
};
