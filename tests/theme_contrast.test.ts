import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SURFACE_PALETTES,
  THEME_ROLE_COLORS,
  buildThemeTokens,
} from '../src/services/themeManager';
import { buildEditorTheme } from '../src/utils/editorThemeTokens';
import { TAB_CATEGORY_THEMES } from '../src/utils/tabTheme';
import {
  contrastRatio,
  mixRgb,
  parseHexColor,
  resolveConnectionLabelColor,
  type RgbColor,
} from '../src/utils/connectionColor';

const SURFACES = Object.keys(SURFACE_PALETTES);
const TEXT_STEPS = ['100', '200', '300', '400', '500'] as const;
const BACKGROUND_STEPS = ['750', '800', '850', '900'] as const;

function channelsToRgb(value: string): RgbColor {
  const [r, g, b] = value.trim().split(/\s+/).map(Number);
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0 };
}

function tokensToRgba(hexOrChannels: string): RgbColor {
  const hex = parseHexColor(hexOrChannels);
  if (hex) return hex;
  return channelsToRgb(hexOrChannels);
}

function ratioForTokens(foreground: string, background: string): number {
  return contrastRatio(tokensToRgba(foreground), tokensToRgba(background));
}

test('every surface palette keeps the text steps at or above 4.5:1 in both colour modes', () => {
  for (const surface of SURFACES) {
    for (const mode of ['dark', 'light'] as const) {
      const tokens = buildThemeTokens(surface, mode);
      for (const step of TEXT_STEPS) {
        for (const background of BACKGROUND_STEPS) {
          const ratio = ratioForTokens(tokens[`--color-dark-${step}`]!, tokens[`--color-dark-${background}`]!);
          assert.ok(
            ratio >= 4.5,
            `${surface}/${mode}: dark-${step} on dark-${background} is ${ratio.toFixed(2)}:1`
          );
        }
      }
    }
  }
});

test('the separator step clears 3:1 as a non-text affordance and is never a body text colour', () => {
  for (const surface of SURFACES) {
    for (const mode of ['dark', 'light'] as const) {
      const tokens = buildThemeTokens(surface, mode);
      const ratio = ratioForTokens(tokens['--color-dark-600']!, tokens['--color-dark-900']!);
      assert.ok(ratio >= 3, `${surface}/${mode}: dark-600 on dark-900 is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('role accent colours clear 4.5:1 on the light surfaces and on the dark surfaces', () => {
  const lightTokens = buildThemeTokens('slate', 'light');
  const darkTokens = buildThemeTokens('slate', 'dark');
  const lightSurfaces = ['--color-dark-900', '--color-dark-800'];
  const darkSurfaces = ['--color-dark-900', '--color-dark-750'];

  for (const role of Object.keys(THEME_ROLE_COLORS)) {
    for (const background of lightSurfaces) {
      const ratio = ratioForTokens(lightTokens[`--color-${role}`]!, lightTokens[background]!);
      assert.ok(ratio >= 4.5, `light ${role} on ${background} is ${ratio.toFixed(2)}:1`);
    }
    for (const background of darkSurfaces) {
      const ratio = ratioForTokens(darkTokens[`--color-${role}`]!, darkTokens[background]!);
      assert.ok(ratio >= 4.5, `dark ${role} on ${background} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('role accent colours stay readable on their own 15-25% status chip tints', () => {
  const lightTokens = buildThemeTokens('slate', 'light');
  const white = parseHexColor('#ffffff')!;
  // The 500 step of each hue is what the `bg-<hue>-500/15|25` status chips paint with.
  const hue500: Record<string, string> = {
    accent: '#3b82f6',
    ok: '#10b981',
    danger: '#f43f5e',
    warn: '#f59e0b',
    info: '#0ea5e9',
    plan: '#a855f7',
    er: '#06b6d4',
    structure: '#6366f1',
  };

  for (const [role, hue] of Object.entries(hue500)) {
    for (const alpha of [0.15, 0.25]) {
      const surface = mixRgb(white, parseHexColor(hue)!, alpha);
      const ratio = contrastRatio(tokensToRgba(lightTokens[`--color-${role}`]!), surface);
      assert.ok(
        ratio >= 4.5,
        `light ${role} on its ${alpha * 100}% tint is ${ratio.toFixed(2)}:1`
      );
    }
  }
});

test('role colour definitions stay in sync between themeManager and the stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/assets/main.css'), 'utf-8');
  const darkBlock = /html\.dark,\s*\n\s*\.dark \{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? '';
  const rootBlock = /:root \{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? '';

  for (const [role, colors] of Object.entries(THEME_ROLE_COLORS)) {
    const darkRgb = channelsToRgb(colors.dark ? hexToChannels(colors.dark) : '0 0 0');
    const lightRgb = channelsToRgb(colors.light ? hexToChannels(colors.light) : '0 0 0');
    assert.match(
      darkBlock,
      new RegExp(`--color-${role}: ${darkRgb.r} ${darkRgb.g} ${darkRgb.b};`),
      `dark --color-${role} drifted from THEME_ROLE_COLORS`
    );
    assert.match(
      rootBlock,
      new RegExp(`--color-${role}: ${lightRgb.r} ${lightRgb.g} ${lightRgb.b};`),
      `light --color-${role} drifted from THEME_ROLE_COLORS`
    );
  }
});

function hexToChannels(hex: string): string {
  const rgb = parseHexColor(hex)!;
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

test('inactive workspace tabs keep 3:1 icons in light mode', () => {
  // Composite of the inactive light tab background (rgba(226,232,240,0.6) over slate-100).
  const tabStripSurface = { r: 232, g: 237, b: 244 };
  for (const theme of Object.values(TAB_CATEGORY_THEMES)) {
    const ratio = contrastRatio(parseHexColor(theme.iconColorLight)!, tabStripSurface);
    assert.ok(ratio >= 3, `${theme.type} light icon is ${ratio.toFixed(2)}:1`);

    const darkRatio = contrastRatio(parseHexColor(theme.iconColor)!, parseHexColor('#252530')!);
    assert.ok(darkRatio >= 3, `${theme.type} dark icon is ${darkRatio.toFixed(2)}:1`);
  }
});

test('Monaco themes keep syntax and gutter colours readable', () => {
  for (const surface of SURFACES) {
    const dark = buildEditorTheme(surface, 'dark');
    // Monaco rejects hex strings without a leading '#' and silently falls back to #FF0000.
    for (const value of Object.values(dark.colors)) {
      assert.ok(
        /^#[0-9a-fA-F]{3,8}$/.test(value),
        `dark theme colour "${value}" must be a #-prefixed hex value`
      );
    }
    const darkBackground = parseHexColor(dark.colors['editor.background'])!;
    assert.ok(darkBackground, 'dark editor background must parse');
    for (const rule of dark.rules) {
      const ratio = contrastRatio(parseHexColor(`#${rule.foreground}`)!, darkBackground);
      assert.ok(ratio >= 4.5, `dark ${rule.token} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
    assert.ok(
      contrastRatio(parseHexColor(dark.colors['editorLineNumber.foreground'])!, darkBackground) >= 3,
      `dark line numbers on ${surface} lost their 3:1 affordance`
    );

    const light = buildEditorTheme(surface, 'light');
    for (const value of Object.values(light.colors)) {
      assert.ok(
        /^#[0-9a-fA-F]{3,8}$/.test(value),
        `light theme colour "${value}" must be a #-prefixed hex value`
      );
    }
    const lightBackground = parseHexColor(light.colors['editor.background'])!;
    for (const rule of light.rules) {
      const ratio = contrastRatio(parseHexColor(`#${rule.foreground}`)!, lightBackground);
      assert.ok(ratio >= 4.5, `light ${rule.token} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
    assert.ok(
      contrastRatio(parseHexColor(light.colors['editorLineNumber.foreground'])!, lightBackground) >= 3,
      `light line numbers on ${surface} lost their 3:1 affordance`
    );
  }
});

test('connection labels stay readable in light mode without touching the stored colour', () => {
  const presets = ['#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  const panelSurface = parseHexColor('#f1f5f9')!;

  for (const preset of presets) {
    assert.equal(resolveConnectionLabelColor(preset, 'dark'), preset, 'dark mode keeps the raw colour');
    const light = resolveConnectionLabelColor(preset, 'light')!;
    const ratio = contrastRatio(parseHexColor(light)!, panelSurface);
    assert.ok(ratio >= 4.5, `${preset} -> ${light} is ${ratio.toFixed(2)}:1 on the light panel`);
  }

  assert.equal(resolveConnectionLabelColor(undefined, 'light'), undefined);
  assert.equal(resolveConnectionLabelColor('not-a-colour', 'light'), 'not-a-colour');
});

test('tabulator value styling keeps its contrast in both themes', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles/tabulatorTheme.css'), 'utf-8');
  const darkBlock = /html\.dark \.tabulator \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const lightBlock = /html:not\(\.dark\) \.tabulator \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

  const readVar = (block: string, name: string) =>
    new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim() ?? '';

  const darkBg = parseHexColor(readVar(darkBlock, 'sq-grid-bg'))!;
  const darkHeader = parseHexColor(readVar(darkBlock, 'sq-grid-header-bg'))!;
  const lightBg = parseHexColor(readVar(lightBlock, 'sq-grid-bg'))!;
  const lightHeader = parseHexColor(readVar(lightBlock, 'sq-grid-header-bg'))!;

  for (const [label, fg, bg] of [
    ['dark muted', readVar(darkBlock, 'sq-grid-muted'), darkBg],
    ['dark null cell', readVar(darkBlock, 'sq-grid-muted'), darkBg],
    ['dark bool true', readVar(darkBlock, 'sq-grid-bool-true-accent'), darkBg],
    ['dark bool false', readVar(darkBlock, 'sq-grid-bool-false-accent'), darkBg],
    ['dark binary', readVar(darkBlock, 'sq-grid-binary-accent'), darkBg],
    ['light muted', readVar(lightBlock, 'sq-grid-muted'), lightBg],
    ['light bool true', readVar(lightBlock, 'sq-grid-bool-true-accent'), lightBg],
    ['light bool false', readVar(lightBlock, 'sq-grid-bool-false-accent'), lightBg],
    ['light binary', readVar(lightBlock, 'sq-grid-binary-accent'), lightBg],
  ] as const) {
    const ratio = contrastRatio(parseHexColor(fg)!, bg);
    assert.ok(ratio >= 4.5, `${label} is ${ratio.toFixed(2)}:1`);
  }

  for (const [label, icon, background] of [
    ['dark sort arrow', readVar(darkBlock, 'sq-grid-sort-icon'), darkHeader],
    ['light sort arrow', readVar(lightBlock, 'sq-grid-sort-icon'), lightHeader],
  ] as const) {
    const ratio = contrastRatio(parseHexColor(icon)!, background);
    assert.ok(ratio >= 3, `${label} is ${ratio.toFixed(2)}:1`);
  }

  // The modified-cell tint is translucent, so measure the composed colour, not the raw text value.
  // rgba(245,158,11,0.15) composited over the row surface.
  const darkTint = mixRgb(darkBg, parseHexColor('#f59e0b')!, 0.15);
  const lightTint = mixRgb(lightBg, parseHexColor('#f59e0b')!, 0.15);
  assert.ok(
    contrastRatio(parseHexColor(readVar(darkBlock, 'sq-grid-modified-text'))!, darkTint) >= 4.5,
    'dark modified cells lost their readability'
  );
  assert.ok(
    contrastRatio(parseHexColor(readVar(lightBlock, 'sq-grid-modified-text'))!, lightTint) >= 4.5,
    'light modified cells lost their readability'
  );

  const sortOpacity = /\[aria-sort='none'\][\s\S]*?\.tabulator-col-sorter \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.doesNotMatch(
    sortOpacity,
    /opacity/,
    'the inactive sort arrow must not fade below its measured contrast'
  );
});

test('index.html resolves the persisted colour mode before first paint', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8');
  assert.match(html, /sqlight_app_settings/);
  assert.match(html, /classList\.toggle\('dark'/);
  assert.match(html, /style\.colorScheme/);
});

test('the stylesheet declares a colour-scheme for both modes', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/assets/main.css'), 'utf-8');
  assert.match(css, /color-scheme: light/);
  assert.match(css, /color-scheme: dark/);
});
