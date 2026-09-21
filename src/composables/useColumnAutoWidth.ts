/**
 * Utilities and sizing helpers for AG Grid column auto-width calculation and value formatting.
 */

const HTML_CHARS_REGEX = /[&<>"']/;

export function escapeHtml(str: string): string {
  if (!HTML_CHARS_REGEX.test(str)) return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatValueForDisplay(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'object' && val !== null && 'type' in val && (val as { type: string; length?: number }).type === 'binary') {
    return `[Binary ${(val as { length?: number }).length ?? 0} B]`;
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  return String(val);
}

export function formatCellForExport(cell: unknown): string {
  if (cell === null || cell === undefined) return 'NULL';
  if (typeof cell === 'object' && cell !== null && 'type' in cell && (cell as { type: string; length?: number }).type === 'binary') {
    return `[Binary ${(cell as { length?: number }).length ?? 0}B]`;
  }
  return String(cell);
}

export function estimateTextWidth(text: string, isMono = true): number {
  let width = 0;
  const charWidth = isMono ? 7.8 : 7.2;
  for (let i = 0; i < text.length; i++) {
    width += text.charCodeAt(i) > 255 ? 15 : charWidth;
  }
  return width;
}

export function calculateColumnWidth(headerName: string, firstRowVal: unknown, isPk = false): number {
  const firstRowStr = firstRowVal !== undefined ? formatValueForDisplay(firstRowVal) : '';
  const pkExtra = isPk ? 22 : 0;
  const headerWidth = Math.ceil(estimateTextWidth(headerName, false) + 48 + pkExtra);
  const firstRowWidth =
    firstRowVal !== undefined && firstRowStr.length > 0
      ? Math.ceil(estimateTextWidth(firstRowStr, true) + 28)
      : 0;
  const calculated = Math.max(headerWidth, firstRowWidth);
  return Math.min(Math.max(calculated, 75), 600);
}
