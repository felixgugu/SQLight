export interface FontFamilyOption {
  label: string;
  value: string;
}

export const SYSTEM_MONOSPACE_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const DEFAULT_GRID_FONT_FAMILY = SYSTEM_MONOSPACE_FONT_FAMILY;

export const EDITOR_FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { label: 'Fira Code (預設推薦，支援連字)', value: '"Fira Code", Consolas, Monaco, monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, Monaco, monospace' },
  { label: 'Cascadia Code', value: '"Cascadia Code", Consolas, monospace' },
  { label: 'Consolas', value: 'Consolas, Monaco, monospace' },
  { label: 'Monaco', value: 'Monaco, "Courier New", monospace' },
  { label: 'System Monospace', value: 'monospace' },
];

export const DEFAULT_EDITOR_FONT_FAMILY = EDITOR_FONT_FAMILY_OPTIONS[0]!.value;

export const GRID_FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { label: 'AG Grid 系統等寬（預設）', value: DEFAULT_GRID_FONT_FAMILY },
  ...EDITOR_FONT_FAMILY_OPTIONS,
];
