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

export type SurfaceShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';
export type SurfacePalette = Record<SurfaceShade, string>;

export const SURFACE_PALETTES: Record<string, SurfacePalette> = {
  slate: {
    '50': '#f8fafc',
    '100': '#f1f5f9',
    '200': '#e2e8f0',
    '300': '#cbd5e1',
    '400': '#94a3b8',
    '500': '#64748b',
    '600': '#475569',
    '700': '#334155',
    '800': '#1e293b',
    '900': '#0f172a',
    '950': '#020617',
  },
  gray: {
    '50': '#f9fafb',
    '100': '#f3f4f6',
    '200': '#e5e7eb',
    '300': '#d1d5db',
    '400': '#9ca3af',
    '500': '#6b7280',
    '600': '#4b5563',
    '700': '#374151',
    '800': '#1f2937',
    '900': '#111827',
    '950': '#030712',
  },
  zinc: {
    '50': '#fafafa',
    '100': '#f4f4f5',
    '200': '#e4e4e7',
    '300': '#d4d4d8',
    '400': '#a1a1aa',
    '500': '#71717a',
    '600': '#52525b',
    '700': '#3f3f46',
    '800': '#27272a',
    '900': '#18181b',
    '950': '#09090b',
  },
  neutral: {
    '50': '#fafafa',
    '100': '#f5f5f5',
    '200': '#e5e5e5',
    '300': '#d4d4d4',
    '400': '#a3a3a3',
    '500': '#737373',
    '600': '#525252',
    '700': '#404040',
    '800': '#262626',
    '900': '#171717',
    '950': '#0a0a0a',
  },
  stone: {
    '50': '#fafaf9',
    '100': '#f5f5f4',
    '200': '#e7e5e4',
    '300': '#d6d3d1',
    '400': '#a8a29e',
    '500': '#78716c',
    '600': '#57534e',
    '700': '#44403c',
    '800': '#292524',
    '900': '#1c1917',
    '950': '#0c0a09',
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

function rgbStr(rgb: [number, number, number]): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function blendRgb(c1: [number, number, number], c2: [number, number, number], ratio = 0.5): [number, number, number] {
  return [
    Math.round(c1[0] * (1 - ratio) + c2[0] * ratio),
    Math.round(c1[1] * (1 - ratio) + c2[1] * ratio),
    Math.round(c1[2] * (1 - ratio) + c2[2] * ratio),
  ];
}

export function applyGlobalSurfaceVariables(surfaceName: string, mode: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const pal = (SURFACE_PALETTES[surfaceName] ?? SURFACE_PALETTES['slate'])!;
  const isDark = mode === 'dark';

  const p50 = hexToRgb(pal['50']);
  const p100 = hexToRgb(pal['100']);
  const p200 = hexToRgb(pal['200']);
  const p300 = hexToRgb(pal['300']);
  const p400 = hexToRgb(pal['400']);
  const p500 = hexToRgb(pal['500']);
  const p600 = hexToRgb(pal['600']);
  const p700 = hexToRgb(pal['700']);
  const p800 = hexToRgb(pal['800']);
  const p900 = hexToRgb(pal['900']);
  const p950 = hexToRgb(pal['950']);

  let vars: Record<string, string>;

  if (isDark) {
    vars = {
      '--color-dark-950': rgbStr(p950),
      '--color-dark-900': rgbStr(p900),
      '--color-dark-850': rgbStr(blendRgb(p900, p800, 0.4)),
      '--color-dark-800': rgbStr(p800),
      '--color-dark-750': rgbStr(blendRgb(p800, p700, 0.4)),
      '--color-dark-700': rgbStr(p700),
      '--color-dark-600': rgbStr(p600),
      '--color-dark-500': rgbStr(p500),
      '--color-dark-400': rgbStr(p400),
      '--color-dark-300': rgbStr(p300),
      '--color-dark-200': rgbStr(p200),
      '--color-dark-100': rgbStr(p100),
    };
  } else {
    vars = {
      '--color-dark-950': rgbStr(p100),
      '--color-dark-900': '255 255 255',
      '--color-dark-850': rgbStr(p50),
      '--color-dark-800': rgbStr(p100),
      '--color-dark-750': rgbStr(p200),
      '--color-dark-700': rgbStr(p300),
      '--color-dark-600': rgbStr(p400),
      '--color-dark-500': rgbStr(p500),
      '--color-dark-400': rgbStr(p600),
      '--color-dark-300': rgbStr(p700),
      '--color-dark-200': rgbStr(p800),
      '--color-dark-100': rgbStr(p900),
    };
  }

  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sqlight:surface-changed', {
        detail: { surface: surfaceName, mode, palette: pal },
      })
    );
  }
}

let currentMode: 'dark' | 'light' = 'dark';
let currentSurfaceName = 'slate';

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
    currentSurfaceName = surfaceName;
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

    applyGlobalSurfaceVariables(currentSurfaceName, currentMode);
  },

  /**
   * Apply Dark / Light Color Mode
   */
  applyColorMode(mode: 'dark' | 'light') {
    currentMode = mode;
    const isDark = mode === 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
    }
    applyGlobalSurfaceVariables(currentSurfaceName, currentMode);
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
    currentMode = settings.colorMode || 'dark';
    currentSurfaceName = settings.surfaceColor || 'slate';
    this.applyColorMode(currentMode);
    this.applyThemePreset(settings.themePreset || 'Aura');
    this.applyPrimaryColor(settings.primaryColor || 'blue');
    this.applySurfaceColor(currentSurfaceName);
    this.applyRipple(settings.ripple ?? true, primevueConfig);
  },
};

