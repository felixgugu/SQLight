/**
 * Pure helpers for the font-family pickers.
 *
 * These utilities have no side effects and do not depend on Vue state or the
 * backend IPC layer, so they can be reused and unit tested in isolation.
 */

/** Sentinel value used by the picker to represent "custom font" mode. */
export const CUSTOM_FONT_VALUE = '__custom__';

/**
 * Returns true when `value` exactly matches one of the preset font values.
 * Empty or whitespace-only values are never considered a preset.
 */
export function isPresetFontFamily(
  value: string | null | undefined,
  options: ReadonlyArray<{ value: string }>
): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  return options.some((option) => option.value === trimmed);
}

/**
 * Normalizes a user-entered font string, falling back when it is blank.
 */
export function normalizeFontFamily(
  value: string | null | undefined,
  fallback: string
): string {
  return (value ?? '').trim() || fallback;
}
