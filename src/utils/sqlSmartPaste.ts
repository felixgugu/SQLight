import { wrapIdentifierIfNeeded } from './sqlParser';

export interface SmartPasteResult {
  textToInsert: string;
  selectPlaceholder?: boolean;
  placeholderOffset?: number;
  placeholderLength?: number;
}

const COMPARISON_OPERATORS = new Set([
  '=', '<>', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'IS', 'BETWEEN',
]);

const CONDITION_STARTERS = new Set([
  'WHERE', 'ON', 'HAVING', 'AND', 'OR', 'NOT', '(',
]);

/**
 * Strips comments from SQL while maintaining character length where possible or simplifying for token parsing.
 */
function cleanSqlForAnalysis(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

/**
 * Analyzes the SQL surrounding the cursor position to determine smart paste formatting
 * for column names:
 * 1. In SELECT list: whether to add leading or trailing comma ','
 * 2. In WHERE / ON / SET / HAVING: whether to add ' = ?' and select the '?' placeholder
 * 3. Fallback: ensures at least whitespace separation from adjacent word characters
 */
export function analyzeSmartPasteContext(
  fullSql: string,
  cursorOffset: number,
  rawColName: string
): SmartPasteResult {
  const colName = wrapIdentifierIfNeeded(rawColName);

  if (!fullSql) {
    return { textToInsert: colName };
  }

  const cleaned = cleanSqlForAnalysis(fullSql);
  const textBefore = cleaned.slice(0, cursorOffset);
  const textAfter = cleaned.slice(cursorOffset);

  // Raw text before & after for immediate whitespace check
  const rawBefore = fullSql.slice(0, cursorOffset);
  const rawAfter = fullSql.slice(cursorOffset);

  const charImmediatelyBefore = rawBefore.slice(-1);
  const charImmediatelyAfter = rawAfter.slice(0, 1);

  const isAdjacentBeforeWord = /[a-zA-Z0-9_\]]/.test(charImmediatelyBefore);
  const isAdjacentAfterWord = /[a-zA-Z0-9_\[]/.test(charImmediatelyAfter);

  // Extract non-whitespace tokens before cursor (look back up to ~50 tokens)
  const trimmedBefore = textBefore.trimEnd();
  const tokensBefore = trimmedBefore ? trimmedBefore.split(/\s+/) : [];
  const lastTokenBefore = tokensBefore.length > 0 ? (tokensBefore[tokensBefore.length - 1] ?? '') : '';
  const upperLastTokenBefore = lastTokenBefore.toUpperCase();

  // Extract non-whitespace tokens after cursor
  const trimmedAfter = textAfter.trimStart();
  const tokensAfter = trimmedAfter ? trimmedAfter.split(/\s+/) : [];
  const firstTokenAfter = tokensAfter.length > 0 ? (tokensAfter[0] ?? '') : '';
  const upperFirstTokenAfter = firstTokenAfter.toUpperCase();

  // Find the last major clause keyword before the cursor
  // Major clause keywords: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, JOIN, ON, SET, VALUES, INTO
  const clauseRegex = /\b(SELECT|FROM|WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|JOIN|ON|SET|VALUES|INTO)\b/gi;
  let lastClause: string | null = null;
  let clauseMatch: RegExpExecArray | null;

  while ((clauseMatch = clauseRegex.exec(textBefore)) !== null) {
    lastClause = clauseMatch[1]?.toUpperCase() ?? null;
  }

  // =========================================================================
  // Case 1: In SELECT clause (between SELECT and FROM/WHERE/etc.)
  // =========================================================================
  if (lastClause === 'SELECT') {
    // Check if cursor is right after SELECT / TOP n / DISTINCT
    const tokensAfterSelect: string[] = [];
    const lastSelectIdx = textBefore.toUpperCase().lastIndexOf('SELECT');
    if (lastSelectIdx !== -1) {
      const textFromSelect = textBefore.slice(lastSelectIdx + 6).trim();
      if (textFromSelect) {
        tokensAfterSelect.push(...textFromSelect.split(/\s+/));
      }
    }

    const isInitialSelectList =
      tokensAfterSelect.length === 0 ||
      (tokensAfterSelect.length === 1 && ['DISTINCT', 'ALL'].includes(tokensAfterSelect[0]!.toUpperCase())) ||
      (tokensAfterSelect.length === 2 && tokensAfterSelect[0]!.toUpperCase() === 'TOP');

    // Does it need a comma before?
    // If not initial select list, and previous token does NOT end with a comma
    let needsLeadingComma = false;
    let needsLeadingSpace = false;

    if (!isInitialSelectList) {
      if (trimmedBefore.endsWith(',')) {
        // Comma already present before cursor, ensure space if not already there
        needsLeadingSpace = !/\s$/.test(rawBefore);
      } else {
        // There is an expression before cursor without comma
        needsLeadingComma = true;
      }
    } else {
      needsLeadingSpace = !/\s$/.test(rawBefore);
    }

    // Does it need a comma after?
    // Check if textAfter starts with another column or expression (and not FROM, INTO, WHERE, ;, or comma)
    let needsTrailingComma = false;
    let needsTrailingSpace = false;

    if (
      firstTokenAfter &&
      !trimmedAfter.startsWith(',') &&
      !['FROM', 'INTO', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'JOIN', ';'].includes(upperFirstTokenAfter)
    ) {
      needsTrailingComma = true;
    } else {
      needsTrailingSpace = !/^\s/.test(rawAfter) && rawAfter.length > 0;
    }

    let result = colName;
    if (needsLeadingComma) {
      result = (isAdjacentBeforeWord ? ', ' : ', ') + result;
    } else if (needsLeadingSpace) {
      result = ' ' + result;
    }

    if (needsTrailingComma) {
      result = result + ', ';
    } else if (needsTrailingSpace) {
      result = result + ' ';
    }

    return { textToInsert: result };
  }

  // =========================================================================
  // Case 2: In WHERE, ON, HAVING, or SET clause
  // =========================================================================
  if (lastClause && ['WHERE', 'ON', 'HAVING', 'SET'].includes(lastClause)) {
    // Check if cursor is at the beginning of a predicate:
    // e.g. preceded by WHERE, ON, HAVING, SET, AND, OR, NOT, or '('
    const isAtPredicateStart =
      CONDITION_STARTERS.has(upperLastTokenBefore) ||
      upperLastTokenBefore.endsWith('(') ||
      (lastClause === 'SET' && (upperLastTokenBefore === 'SET' || trimmedBefore.endsWith(',')));

    // Check if cursor is followed immediately by an existing comparison operator:
    // e.g. "WHERE | = 10" or "WHERE | LIKE 'abc%'"
    const isFollowedByOperator = COMPARISON_OPERATORS.has(upperFirstTokenAfter) || trimmedAfter.startsWith('=');

    // Check if cursor is preceded by an operator:
    // e.g. "WHERE id = |"
    const isPrecededByOperator =
      COMPARISON_OPERATORS.has(upperLastTokenBefore) ||
      trimmedBefore.endsWith('=') ||
      trimmedBefore.endsWith('<') ||
      trimmedBefore.endsWith('>');

    if (isAtPredicateStart && !isFollowedByOperator && !isPrecededByOperator) {
      // Add " = ?"
      let prefix = '';
      if (!/\s$/.test(rawBefore) && rawBefore.length > 0) {
        prefix = ' ';
      }

      let suffix = ' = ?';
      if (!/^\s/.test(rawAfter) && rawAfter.length > 0 && !rawAfter.startsWith(';') && !rawAfter.startsWith(')')) {
        suffix = ' = ? ';
      }

      const textToInsert = `${prefix}${colName}${suffix}`;
      const qIndex = textToInsert.indexOf('?');

      return {
        textToInsert,
        selectPlaceholder: true,
        placeholderOffset: qIndex,
        placeholderLength: 1,
      };
    }
  }

  // =========================================================================
  // Case 3: Fallback / General ("如無法判斷最少要加上空白")
  // =========================================================================
  let prefix = '';
  let suffix = '';

  if (isAdjacentBeforeWord && !/\s$/.test(rawBefore)) {
    prefix = ' ';
  }
  if (isAdjacentAfterWord && !/^\s/.test(rawAfter)) {
    suffix = ' ';
  }

  return {
    textToInsert: `${prefix}${colName}${suffix}`,
  };
}
