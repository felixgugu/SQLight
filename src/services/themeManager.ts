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
  // `sampleLight` mirrors the light canvas (palette 100) so the swatch shows the soft grey the
  // theme actually paints, not the near-white overlay tone.
  { name: 'slate', label: '微藍冷調 (Slate)', sampleDark: '#0f172a', sampleLight: '#f1f5f9', token: '{slate}' },
  { name: 'gray', label: '中性經典 (Gray)', sampleDark: '#111827', sampleLight: '#f3f4f6', token: '{gray}' },
  { name: 'zinc', label: '現代金屬 (Zinc)', sampleDark: '#18181b', sampleLight: '#f4f4f5', token: '{zinc}' },
  { name: 'neutral', label: '極簡純淨 (Neutral)', sampleDark: '#171717', sampleLight: '#f5f5f5', token: '{neutral}' },
  { name: 'stone', label: '微暖石灰 (Stone)', sampleDark: '#1c1917', sampleLight: '#f5f5f4', token: '{stone}' },
];

export interface GlobalFontOption {
  name: string;
  label: string;
  value: string;
  description: string;
}

export const GLOBAL_FONT_OPTIONS: GlobalFontOption[] = [
  {
    name: 'default',
    label: '預設 (Inter / System)',
    value: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei UI", "Noto Sans TC", sans-serif',
    description: '沿用 PuffSQL 預設字型，缺少指定字型時自動回退至系統字型。',
  },
  {
    name: 'system',
    label: '系統預設 (System UI)',
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei UI", "Noto Sans TC", sans-serif',
    description: '跟隨 Windows 或 macOS 的系統介面字型。',
  },
  {
    name: 'jhenghei',
    label: '微軟正黑體 (Microsoft JhengHei)',
    value: '"Microsoft JhengHei UI", "Microsoft JhengHei", system-ui, sans-serif',
    description: 'Windows 繁體中文環境常用的清晰介面字型。',
  },
  {
    name: 'noto-sans-tc',
    label: 'Noto Sans TC',
    value: '"Noto Sans TC", "Microsoft JhengHei UI", system-ui, sans-serif',
    description: '適合繁體中文閱讀的無襯線字型，需系統已安裝。',
  },
  {
    name: 'pingfang',
    label: '蘋方 (PingFang TC)',
    value: '"PingFang TC", "Microsoft JhengHei UI", system-ui, sans-serif',
    description: 'macOS 繁體中文預設字型，未安裝時回退至系統字型。',
  },
  {
    name: 'segoe-ui',
    label: 'Segoe UI',
    value: '"Segoe UI", "Microsoft JhengHei UI", system-ui, sans-serif',
    description: 'Windows 標準介面字型，拉丁文字顯示較為緊湊。',
  },
];

export const DEFAULT_GLOBAL_FONT_FAMILY = GLOBAL_FONT_OPTIONS[0]!.value;

export type SurfaceShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';
export type SurfacePalette = Record<SurfaceShade, string>;

/**
 * Theme-aware semantic accent colours.
 *
 * Every hue used for text/icons must resolve per colour mode: the light values are the
 * 600/700 steps (>= 4.5:1 on white) and the dark values are the 300/400 steps
 * (>= 4.5:1 on the darkest and on the raised surface). Components must use the
 * `text-accent` / `text-ok` / ... Tailwind aliases instead of raw `text-ok`
 * so both themes keep the same perceived intent.
 */
export const THEME_ROLE_COLORS: Record<string, { dark: string; light: string }> = {
  accent: { dark: '#60a5fa', light: '#1d4ed8' },
  ok: { dark: '#34d399', light: '#065f46' },
  danger: { dark: '#fb7185', light: '#9f1239' },
  warn: { dark: '#fbbf24', light: '#92400e' },
  info: { dark: '#38bdf8', light: '#075985' },
  plan: { dark: '#c084fc', light: '#6d28d9' },
  er: { dark: '#22d3ee', light: '#155e75' },
  structure: { dark: '#a5b4fc', light: '#4338ca' },
};

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
  const vars = buildThemeTokens(surfaceName, mode);

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

/**
 * Builds every `--color-*` custom property for one surface palette + colour mode.
 *
 * Kept as a pure function (no DOM access) so the contrast regression test can assert the
 * same values the runtime applies. The text steps (100-600) are shifted by one so the muted
 * step stays >= 4.5:1 in both modes; the surface steps are described inline below.
 */
export function buildThemeTokens(surfaceName: string, mode: 'dark' | 'light'): Record<string, string> {
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

  const vars: Record<string, string> = isDark
    ? {
        '--color-dark-950': rgbStr(p950),
        '--color-dark-900': rgbStr(p900),
        '--color-dark-850': rgbStr(blendRgb(p900, p800, 0.4)),
        '--color-dark-800': rgbStr(p800),
        '--color-dark-750': rgbStr(blendRgb(p800, p700, 0.4)),
        '--color-dark-700': rgbStr(p700),
        '--color-dark-600': rgbStr(p500),
        '--color-dark-500': rgbStr(p400),
        '--color-dark-400': rgbStr(p300),
        '--color-dark-300': rgbStr(p200),
        '--color-dark-200': rgbStr(p100),
        '--color-dark-100': rgbStr(p50),
        '--color-raised': rgbStr(p800),
      }
    : {
        // Light mode runs the ramp from the canvas downwards: the main background is a soft grey
        // (never pure white, which is harsh at full-screen brightness) and each lower step deepens
        // the tone so panels, hover states and inset wells stay distinguishable from it.
        '--color-dark-950': rgbStr(blendRgb(p200, p300, 0.35)), // inset wells (code previews)
        '--color-dark-900': rgbStr(p100), // main app canvas (editor, grid, results)
        '--color-dark-850': rgbStr(blendRgb(p100, p200, 0.55)), // chrome (header, sidebar, tab bar)
        '--color-dark-800': rgbStr(p200), // panels, menus, inputs
        '--color-dark-750': rgbStr(blendRgb(p200, p300, 0.5)), // hover / active rows, dividers
        '--color-dark-700': rgbStr(p300),
        '--color-dark-600': rgbStr(p500),
        '--color-dark-500': rgbStr(p600),
        '--color-dark-400': rgbStr(p700),
        '--color-dark-300': rgbStr(p800),
        '--color-dark-200': rgbStr(p900),
        '--color-dark-100': rgbStr(p950),
        // The only surface lighter than the canvas: menus, popovers, tooltips and dialogs.
        '--color-raised': rgbStr(p50),
      };

  for (const [role, colors] of Object.entries(THEME_ROLE_COLORS)) {
    vars[`--color-${role}`] = rgbStr(hexToRgb(isDark ? colors.dark : colors.light));
  }

  return vars;
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
      // PrimeVue uses `surface.0` for light-mode form fields, content and overlay backgrounds and
      // for dark-mode text. The light scheme therefore gets the palette's 50 step (a soft grey
      // instead of pure white) while the dark scheme keeps the pure white text colour.
      updateSurfacePalette({
        light: {
          0: pal['50'],
          ...pal,
        },
        dark: {
          0: '#ffffff',
          ...pal,
        },
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
   * Apply the global UI font family without affecting explicitly monospace areas
   * or the SQL editor, which uses its own editor font settings.
   */
  applyGlobalFontFamily(fontFamily: string) {
    if (typeof document === 'undefined') return;
    const value = fontFamily?.trim() || DEFAULT_GLOBAL_FONT_FAMILY;
    document.documentElement.style.setProperty('--app-font-sans', value);
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
    this.applyGlobalFontFamily(settings.globalFontFamily || DEFAULT_GLOBAL_FONT_FAMILY);
  },
};
