import { themeQuartz, colorSchemeDark } from 'ag-grid-community';

export const sqlightGridTheme = themeQuartz
  .withPart(colorSchemeDark)
  .withParams({
    backgroundColor: '#18181b',
    headerBackgroundColor: '#202024',
    headerTextColor: '#a1a1aa',
    foregroundColor: '#e4e4e7',
    borderColor: '#2e2e33',
    rowHoverColor: '#27272a',
    selectedRowBackgroundColor: '#27272a',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    headerFontSize: 11,
    rowHeight: 28,
    headerHeight: 30,
    accentColor: '#0284c7',
  });
