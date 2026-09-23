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
  goCount?: number;
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
      const goMatch =
        commentDepth === 0 &&
        !inSingleQuote &&
        !inBracket &&
        !inDoubleQuote &&
        /^GO(?:\s+(\d+))?(?:\s+--.*)?$/i.exec(trimmedCode);
      const isGo = Boolean(goMatch);
      const goCount = goMatch && goMatch[1] ? parseInt(goMatch[1], 10) : 1;
      const isBlank = (lines[currentLineIndex] ?? '').trim() === '';

      lineMetas.push({
        lineIndex: currentLineIndex,
        codeOnly: currentLineCode,
        isGo,
        goCount: isGo ? goCount : undefined,
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
    const goMatch =
      commentDepth === 0 &&
      !inSingleQuote &&
      !inBracket &&
      !inDoubleQuote &&
      /^GO(?:\s+(\d+))?(?:\s+--.*)?$/i.exec(trimmedCode);
    const isGo = Boolean(goMatch);
    const goCount = goMatch && goMatch[1] ? parseInt(goMatch[1], 10) : 1;
    const isBlank = (lines[currentLineIndex] ?? '').trim() === '';

    lineMetas.push({
      lineIndex: currentLineIndex,
      codeOnly: currentLineCode,
      isGo,
      goCount: isGo ? goCount : undefined,
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

export interface SqlBatchItem {
  sql: string;
  startLine: number;
  repeatCount: number;
}

/**
 * Splits a full SQL script into separate executable batches with line numbers and repeat counts.
 */
export function splitSqlBatchesWithMeta(fullText: string): SqlBatchItem[] {
  if (!fullText || !fullText.trim()) return [];

  const { lines, lineMetas } = parseSqlLines(fullText);
  if (lineMetas.length === 0) return [];

  const batches: SqlBatchItem[] = [];
  let currentBatchLines: { lineIndex: number; text: string }[] = [];

  for (let i = 0; i < lineMetas.length; i++) {
    const meta = lineMetas[i];
    if (meta?.isGo) {
      const repeatCount = meta.goCount && meta.goCount > 0 ? meta.goCount : 1;
      const flushed = flushBatchItem(currentBatchLines, repeatCount);
      if (flushed) {
        batches.push(flushed);
      }
      currentBatchLines = [];
    } else {
      currentBatchLines.push({ lineIndex: i, text: lines[i] ?? '' });
    }
  }

  const finalFlushed = flushBatchItem(currentBatchLines, 1);
  if (finalFlushed) {
    batches.push(finalFlushed);
  }

  return batches;
}

function flushBatchItem(
  batchLines: { lineIndex: number; text: string }[],
  repeatCount: number
): SqlBatchItem | null {
  if (batchLines.length === 0) return null;

  const firstIdx = batchLines.findIndex((l) => l.text.trim() !== '');
  if (firstIdx === -1) return null;

  let lastIdx = batchLines.length - 1;
  while (lastIdx >= firstIdx && (batchLines[lastIdx]?.text ?? '').trim() === '') {
    lastIdx--;
  }

  if (firstIdx > lastIdx) return null;

  const selected = batchLines.slice(firstIdx, lastIdx + 1);
  const sql = selected.map((l) => l.text).join('\n').trim();
  if (!sql) return null;

  return {
    sql,
    startLine: (selected[0]?.lineIndex ?? 0) + 1,
    repeatCount,
  };
}

/**
 * Splits a full SQL script into separate executable batches by detecting GO boundaries.
 * Accurately ignores 'GO' inside string literals, comments, or bracketed identifiers.
 * Respects repeat count (e.g. GO 5 repeats the batch 5 times).
 */
export function splitSqlBatches(fullText: string): string[] {
  const metaBatches = splitSqlBatchesWithMeta(fullText);
  const result: string[] = [];
  for (const b of metaBatches) {
    for (let r = 0; r < b.repeatCount; r++) {
      result.push(b.sql);
    }
  }
  return result;
}

/**
 * Splits SQL text into individual statements by top-level semicolons.
 * Protects semicolons inside:
 * - Single-quoted strings: '...' (with '' escapes)
 * - Bracketed identifiers: [...] (with ]] escapes)
 * - Quoted identifiers: "..." (with "" escapes)
 * - Single-line comments: -- ...
 * - Multi-line comments: /* ... *\/ (including nested)
 */
export function splitSqlStatements(fullText: string): string[] {
  if (!fullText || !fullText.trim()) return [];

  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inBracket = false;
  let inDoubleQuote = false;
  let commentDepth = 0;
  let inLineComment = false;

  const len = fullText.length;
  for (let i = 0; i < len; i++) {
    const ch = fullText[i]!;
    const nextCh = i + 1 < len ? fullText[i + 1]! : '';

    if (inLineComment) {
      current += ch;
      if (ch === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (commentDepth > 0) {
      current += ch;
      if (ch === '/' && nextCh === '*') {
        commentDepth++;
        current += nextCh;
        i++;
      } else if (ch === '*' && nextCh === '/') {
        commentDepth--;
        current += nextCh;
        i++;
      }
      continue;
    }

    if (ch === '-' && nextCh === '-') {
      inLineComment = true;
      current += ch + nextCh;
      i++;
      continue;
    }

    if (ch === '/' && nextCh === '*') {
      commentDepth = 1;
      current += ch + nextCh;
      i++;
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      if (ch === "'") {
        if (nextCh === "'") {
          current += nextCh;
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inBracket) {
      current += ch;
      if (ch === ']') {
        if (nextCh === ']') {
          current += nextCh;
          i++;
        } else {
          inBracket = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += ch;
      if (ch === '"') {
        if (nextCh === '"') {
          current += nextCh;
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      continue;
    }

    if (ch === '[') {
      inBracket = true;
      current += ch;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      current += ch;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed) {
    statements.push(finalTrimmed);
  }

  return statements;
}
