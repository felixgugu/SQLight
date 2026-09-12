export interface ExtractedStatement {
  sql: string;
  isSelection: boolean;
  range?: {
    startLineNumber: number;
    endLineNumber: number;
  };
}

interface LineMeta {
  lineIndex: number;
  codeOnly: string;
  isGo: boolean;
  isBlank: boolean;
}

/**
 * Parses SQL text character-by-character to mask:
 * - String literals: '...' (with '' escapes)
 * - Bracketed identifiers: [...] (with ]] escapes)
 * - Quoted identifiers: "..." (with "" escapes)
 * - Single line comments: -- ...
 * - Multi-line comments: /* ... *\/ (including nested comments!)
 *
 * This accurately detects GO batch boundaries and statement boundaries.
 */
function parseSqlLines(fullText: string): { lines: string[]; lineMetas: LineMeta[] } {
  const lines = fullText.split(/\r?\n/);
  const lineMetas: LineMeta[] = [];

  let inSingleQuote = false;
  let inBracket = false;
  let inDoubleQuote = false;
  let commentDepth = 0;
  let inLineComment = false;

  let currentLineIndex = 0;
  let currentLineCode = '';

  let i = 0;
  const len = fullText.length;

  while (i < len) {
    const ch = fullText[i];
    const nextCh = i + 1 < len ? fullText[i + 1] : '';

    if (ch === '\n' || (ch === '\r' && nextCh === '\n')) {
      if (ch === '\r') i++;
      if (inLineComment) inLineComment = false;

      const trimmedCode = currentLineCode.trim();
      const isGo =
        commentDepth === 0 &&
        !inSingleQuote &&
        !inBracket &&
        !inDoubleQuote &&
        /^GO(\s+\d+)?(\s+--.*)?$/i.test(trimmedCode);
      const isBlank = (lines[currentLineIndex] ?? '').trim() === '';

      lineMetas.push({
        lineIndex: currentLineIndex,
        codeOnly: currentLineCode,
        isGo,
        isBlank,
      });

      currentLineIndex++;
      currentLineCode = '';
      i++;
      continue;
    }

    if (inLineComment) {
      i++;
      continue;
    }

    if (commentDepth > 0) {
      if (ch === '/' && nextCh === '*') {
        commentDepth++;
        i += 2;
        continue;
      }
      if (ch === '*' && nextCh === '/') {
        commentDepth--;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (ch === "'") {
        if (nextCh === "'") {
          i += 2;
          continue;
        }
        inSingleQuote = false;
      }
      i++;
      continue;
    }

    if (inBracket) {
      if (ch === ']') {
        if (nextCh === ']') {
          i += 2;
          continue;
        }
        inBracket = false;
      }
      i++;
      continue;
    }

    if (inDoubleQuote) {
      if (ch === '"') {
        if (nextCh === '"') {
          i += 2;
          continue;
        }
        inDoubleQuote = false;
      }
      i++;
      continue;
    }

    if (ch === '-' && nextCh === '-') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && nextCh === '*') {
      commentDepth = 1;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      i++;
      continue;
    }

    if (ch === '[') {
      inBracket = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      i++;
      continue;
    }

    currentLineCode += ch;
    i++;
  }

  if (currentLineIndex < lines.length) {
    const trimmedCode = currentLineCode.trim();
    const isGo =
      commentDepth === 0 &&
      !inSingleQuote &&
      !inBracket &&
      !inDoubleQuote &&
      /^GO(\s+\d+)?(\s+--.*)?$/i.test(trimmedCode);
    const isBlank = (lines[currentLineIndex] ?? '').trim() === '';

    lineMetas.push({
      lineIndex: currentLineIndex,
      codeOnly: currentLineCode,
      isGo,
      isBlank,
    });
  }

  return { lines, lineMetas };
}

/**
 * Extracts the single SQL statement or execution unit at the current cursor position,
 * or returns the active selection if present.
 */
export function extractStatementAtCursor(
  fullText: string,
  cursorLineNumber: number,
  selectionText?: string
): ExtractedStatement {
  // 1. If user has actively selected text, return the selection directly
  if (selectionText && selectionText.trim()) {
    return {
      sql: selectionText.trim(),
      isSelection: true,
    };
  }

  if (!fullText || !fullText.trim()) {
    return { sql: '', isSelection: false };
  }

  const { lines, lineMetas } = parseSqlLines(fullText);
  if (lineMetas.length === 0) {
    return { sql: '', isSelection: false };
  }

  const targetLineIdx = Math.max(0, Math.min(cursorLineNumber - 1, lineMetas.length - 1));

  // If cursor is on a GO separator line itself, execute nothing
  if (lineMetas[targetLineIdx]?.isGo) {
    return { sql: '', isSelection: false };
  }

  // 2. Identify the batch boundary enclosing the target line
  let batchStart = 0;
  for (let k = targetLineIdx; k >= 0; k--) {
    if (lineMetas[k]?.isGo) {
      batchStart = k + 1;
      break;
    }
  }

  let batchEnd = lineMetas.length - 1;
  for (let k = targetLineIdx; k < lineMetas.length; k++) {
    if (lineMetas[k]?.isGo) {
      batchEnd = k - 1;
      break;
    }
  }

  if (batchStart > batchEnd) {
    return { sql: '', isSelection: false };
  }

  // 3. Check if batch contains control flow, transactions, or variables
  // In T-SQL, batches with transactions/control blocks must be kept intact
  const batchCode = lineMetas
    .slice(batchStart, batchEnd + 1)
    .map((m) => m.codeOnly)
    .join('\n');

  const hasControlFlowOrTransaction =
    /\b(BEGIN\s+TRAN|\bBEGIN\s+TRANSACTION|\bBEGIN\s+TRY|\bBEGIN\s+CATCH|\bIF\b|\bWHILE\b|\bDECLARE\b|\bSET\s+@)\b/i.test(
      batchCode
    );

  if (hasControlFlowOrTransaction) {
    let bStart = batchStart;
    while (bStart <= batchEnd && lineMetas[bStart]?.isBlank) bStart++;
    let bEnd = batchEnd;
    while (bEnd >= bStart && lineMetas[bEnd]?.isBlank) bEnd--;

    if (bStart > bEnd) {
      return { sql: '', isSelection: false };
    }

    const sql = lines.slice(bStart, bEnd + 1).join('\n').trim();
    return {
      sql,
      isSelection: false,
      range: {
        startLineNumber: bStart + 1,
        endLineNumber: bEnd + 1,
      },
    };
  }

  // 4. Batch does not have control flow: identify single statement around cursor
  // A statement begins after the previous ';' and ends at the next ';' or batch boundary.
  // Blank lines inside a query DO NOT terminate the statement.
  let stmtStart = targetLineIdx;
  while (stmtStart > batchStart) {
    if (lineMetas[stmtStart - 1]?.codeOnly.includes(';')) {
      break;
    }
    stmtStart--;
  }

  let stmtEnd = targetLineIdx;
  while (stmtEnd < batchEnd) {
    if (lineMetas[stmtEnd]?.codeOnly.includes(';')) {
      break;
    }
    stmtEnd++;
  }

  // Trim empty lines
  while (stmtStart <= stmtEnd && lineMetas[stmtStart]?.isBlank) stmtStart++;
  while (stmtEnd >= stmtStart && lineMetas[stmtEnd]?.isBlank) stmtEnd--;

  if (stmtStart > stmtEnd) {
    return { sql: '', isSelection: false };
  }

  const sql = lines.slice(stmtStart, stmtEnd + 1).join('\n').trim();

  return {
    sql,
    isSelection: false,
    range: {
      startLineNumber: stmtStart + 1,
      endLineNumber: stmtEnd + 1,
    },
  };
}
