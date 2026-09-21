import { themeQuartz, colorSchemeDark, colorSchemeLight } from 'ag-grid-community';
import { DEFAULT_GRID_FONT_FAMILY } from '@/data/fontOptions';

export const sqlightDarkGridTheme = themeQuartz
  .withPart(colorSchemeDark)
  .withParams({
    backgroundColor: '#18181b',
    headerBackgroundColor: '#202024',
    headerTextColor: '#a1a1aa',
    foregroundColor: '#e4e4e7',
    borderColor: '#2e2e33',
    rowHoverColor: '#27272a',
    selectedRowBackgroundColor: '#27272a',
    fontFamily: DEFAULT_GRID_FONT_FAMILY,
    fontSize: 12,
    headerFontSize: 11,
    rowHeight: 28,
    headerHeight: 30,
    accentColor: '#0284c7',
  });

export const sqlightLightGridTheme = themeQuartz
  .withPart(colorSchemeLight)
  .withParams({
    backgroundColor: '#ffffff',
    headerBackgroundColor: '#f8fafc',
    headerTextColor: '#475569',
    foregroundColor: '#0f172a',
    borderColor: '#e2e8f0',
    rowHoverColor: '#f1f5f9',
    selectedRowBackgroundColor: '#e0f2fe',
    fontFamily: DEFAULT_GRID_FONT_FAMILY,
    fontSize: 12,
    headerFontSize: 11,
    rowHeight: 28,
    headerHeight: 30,
    accentColor: '#0284c7',
  });

// Backward compatibility alias
export const sqlightGridTheme = sqlightDarkGridTheme;
