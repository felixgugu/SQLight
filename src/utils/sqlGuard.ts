/**
 * SQL Guard: Safe Guard and Dangerous SQL Command Detection Utilities
 */

export const DANGEROUS_SQL_KEYWORDS = [
  'UPDATE',
  'INSERT',
  'DELETE',
  'ALTER',
  'CREATE',
  'DROP',
  'TRUNCATE',
] as const;

export type DangerousSqlKeyword = typeof DANGEROUS_SQL_KEYWORDS[number];

export interface DangerousSqlDetectionResult {
  isDangerous: boolean;
  detectedKeywords: DangerousSqlKeyword[];
}

/**
 * Strips comments, string literals, and bracketed/quoted identifiers from SQL,
 * replacing their contents with space characters to preserve word boundaries.
 */
export function stripCommentsAndLiterals(sql: string): string {
  let result = '';
  let inSingleQuote = false;
  let inBracket = false;
  let inDoubleQuote = false;
  let commentDepth = 0;
  let inLineComment = false;

  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    const nextCh = i + 1 < len ? sql[i + 1] : '';

    // Handle line endings for line comments
    if (ch === '\n' || (ch === '\r' && nextCh === '\n')) {
      if (inLineComment) {
        inLineComment = false;
      }
      result += ch;
      i++;
      continue;
    }

    // Inside single-line comment: mask with spaces
    if (inLineComment) {
      result += ' ';
      i++;
      continue;
    }

    // Inside block comment: handle nested comments
    if (commentDepth > 0) {
      if (ch === '/' && nextCh === '*') {
        commentDepth++;
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '*' && nextCh === '/') {
        commentDepth--;
        result += '  ';
        i += 2;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    // Inside single-quoted string literal: '...' ('' is escaped quote)
    if (inSingleQuote) {
      if (ch === "'") {
        if (nextCh === "'") {
          result += '  ';
          i += 2;
          continue;
        }
        inSingleQuote = false;
        result += ' ';
        i++;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    // Inside bracketed identifier: [...] (]] is escaped bracket)
    if (inBracket) {
      if (ch === ']') {
        if (nextCh === ']') {
          result += '  ';
          i += 2;
          continue;
        }
        inBracket = false;
        result += ' ';
        i++;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    // Inside double-quoted identifier: "..." ("" is escaped double quote)
    if (inDoubleQuote) {
      if (ch === '"') {
        if (nextCh === '"') {
          result += '  ';
          i += 2;
          continue;
        }
        inDoubleQuote = false;
        result += ' ';
        i++;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    // Check for comment starts
    if (ch === '-' && nextCh === '-') {
      inLineComment = true;
      result += '  ';
      i += 2;
      continue;
    }

    if (ch === '/' && nextCh === '*') {
      commentDepth = 1;
      result += '  ';
      i += 2;
      continue;
    }

    // Check for quote / identifier starts
    if (ch === "'") {
      inSingleQuote = true;
      result += ' ';
      i++;
      continue;
    }

    if (ch === '[') {
      inBracket = true;
      result += ' ';
      i++;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      result += ' ';
      i++;
      continue;
    }

    // Regular SQL code character
    result += ch;
    i++;
  }

  return result;
}

/**
 * Analyzes SQL script and determines if it contains any dangerous modification statements
 * (UPDATE, INSERT, DELETE, ALTER, CREATE, DROP, TRUNCATE).
 *
 * It safely ignores string literals, comments, and bracketed/quoted identifiers.
 */
export function detectDangerousSqlStatements(sql: string): DangerousSqlDetectionResult {
  if (!sql || !sql.trim()) {
    return { isDangerous: false, detectedKeywords: [] };
  }

  const cleanCode = stripCommentsAndLiterals(sql);
  const found = new Set<DangerousSqlKeyword>();

  for (const keyword of DANGEROUS_SQL_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(cleanCode)) {
      found.add(keyword);
    }
  }

  return {
    isDangerous: found.size > 0,
    detectedKeywords: Array.from(found),
  };
}
