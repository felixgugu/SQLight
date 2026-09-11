/**
 * Utility functions for exporting tabular data to modern formats:
 * - JSON Object Array
 * - Single JSON Object
 * - GitHub Flavored Markdown (GFM) Table
 */

export interface ExportColumn {
  name: string;
}

/**
 * Format a cell value into a clean JSON-serializable value or readable string
 */
export function formatCellValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object' && value !== null && 'type' in value && (value as any).type === 'binary') {
    return `[Binary ${(value as any).length ?? 0} Bytes]`;
  }
  return value;
}

/**
 * Export a single row as a formatted JSON object string
 */
export function exportRowAsJson(columns: ExportColumn[], row: unknown[]): string {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, idx) => {
    obj[col.name] = formatCellValue(row[idx]);
  });
  return JSON.stringify(obj, null, 2);
}

/**
 * Export rows as a formatted JSON array of objects string
 */
export function exportRowsAsJson(columns: ExportColumn[], rows: unknown[][]): string {
  const array = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      obj[col.name] = formatCellValue(row[idx]);
    });
    return obj;
  });
  return JSON.stringify(array, null, 2);
}

/**
 * Format a cell specifically for Markdown table cells
 * - Escapes pipe character `|` to `\|`
 * - Replaces newlines with `<br>` to maintain table row integrity
 * - Treats null/undefined as `NULL`
 */
function formatMarkdownCell(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'object' && value !== null && 'type' in value && (value as any).type === 'binary') {
    return `*[Binary ${(value as any).length ?? 0} B]*`;
  }
  if (typeof value === 'boolean') {
    return value ? '`TRUE`' : '`FALSE`';
  }
  const str = String(value);
  return str.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

/**
 * Export columns and rows as a GitHub Flavored Markdown (GFM) table
 */
export function exportRowsAsMarkdown(columns: ExportColumn[], rows: unknown[][]): string {
  if (!columns.length) return '';

  const headerRow = `| ${columns.map((c) => c.name.replace(/\|/g, '\\|')).join(' | ')} |`;
  const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`;

  if (!rows.length) {
    return `${headerRow}\n${separatorRow}\n`;
  }

  const dataRows = rows.map((row) => {
    const cells = columns.map((_, idx) => formatMarkdownCell(row[idx]));
    return `| ${cells.join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}
