/**
 * SQL Table / Object Identifier Extractor
 * Extracts table/view identifiers at cursor position or from selection.
 */

export interface ExtractedTableIdentifier {
  database?: string;
  schema?: string;
  table: string;
}

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on',
  'group', 'by', 'order', 'having', 'union', 'all', 'intersect', 'except',
  'limit', 'offset', 'fetch', 'next', 'rows', 'only', 'with', 'nolock',
  'as', 'set', 'insert', 'into', 'values', 'update', 'delete', 'create', 'alter', 'drop',
  'table', 'view', 'procedure', 'function', 'index', 'database', 'schema',
  'when', 'then', 'else', 'end', 'case', 'exec', 'execute', 'declare', 'go',
  'and', 'or', 'not', 'in', 'between', 'like', 'is', 'null', 'exists',
  'begin', 'commit', 'rollback', 'tran', 'transaction', 'top', 'distinct',
  'return', 'returns', 'output', 'print', 'truncate', 'grant', 'revoke',
]);

/**
 * Splits a raw qualified identifier (e.g. "[dbo].[Orders]" or "dbo.Orders") into its cleaned segments.
 */
export function parseIdentifierSegments(raw: string): string[] {
  if (!raw) return [];
  const segments: string[] = [];
  // Match either [bracketed name] or unbracketed word
  const segmentRegex = /\[([^\]]+)\]|([a-zA-Z0-9_#@$\u4e00-\u9fa5]+)/g;
  let match: RegExpExecArray | null;
  while ((match = segmentRegex.exec(raw)) !== null) {
    const seg = (match[1] !== undefined ? match[1] : match[2])?.trim();
    if (seg) {
      segments.push(seg);
    }
  }
  return segments;
}

/**
 * Converts segments array into ExtractedTableIdentifier.
 */
export function segmentsToIdentifier(segments: string[]): ExtractedTableIdentifier | null {
  if (!segments.length) return null;

  // Single word: check if it's a reserved SQL keyword
  if (segments.length === 1) {
    const single = segments[0]!;
    if (SQL_KEYWORDS.has(single.toLowerCase())) {
      return null;
    }
    return { table: single };
  }

  if (segments.length === 2) {
    return {
      schema: segments[0],
      table: segments[1]!,
    };
  }

  // 3 segments: [database].[schema].[table]
  if (segments.length >= 3) {
    return {
      database: segments[segments.length - 3],
      schema: segments[segments.length - 2],
      table: segments[segments.length - 1]!,
    };
  }

  return null;
}

/**
 * Extracts a table/view identifier at the current cursor position, or from the provided selection.
 *
 * @param lineText The content of the line where the cursor is.
 * @param cursorColumn 1-indexed column position of cursor (Monaco convention).
 * @param selectionText Optional selected text in editor.
 */
export function extractTableIdentifierAtCursor(
  lineText: string,
  cursorColumn: number,
  selectionText?: string
): ExtractedTableIdentifier | null {
  // 1. If user has selected text, parse the selection directly
  if (selectionText && selectionText.trim()) {
    let clean = selectionText.trim();
    // Strip leading/trailing quotes if user highlighted 'TableName' or "TableName"
    if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
      clean = clean.slice(1, -1).trim();
    }
    const segments = parseIdentifierSegments(clean);
    return segmentsToIdentifier(segments);
  }

  if (!lineText) return null;

  // Convert 1-indexed column to 0-indexed cursor index
  const cursorIndex = Math.max(0, cursorColumn - 1);

  // Regex matches qualified identifier tokens on the line:
  // e.g. [dbo].[Orders], dbo.Orders, [Orders], Orders, [Sales].[Order Details]
  const QUALIFIED_ID_REGEX = /(?:\[[^\]]+\]|[a-zA-Z0-9_#@$\u4e00-\u9fa5]+)(?:\s*\.\s*(?:\[[^\]]+\]|[a-zA-Z0-9_#@$\u4e00-\u9fa5]+))*/g;

  let match: RegExpExecArray | null;
  let bestMatch: { raw: string; start: number; end: number } | null = null;

  while ((match = QUALIFIED_ID_REGEX.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Cursor is inside or immediately at the start/end boundary of the identifier
    if (cursorIndex >= start && cursorIndex <= end) {
      bestMatch = { raw: match[0], start, end };
      break;
    }
  }

  if (!bestMatch) {
    return null;
  }

  const segments = parseIdentifierSegments(bestMatch.raw);
  return segmentsToIdentifier(segments);
}
