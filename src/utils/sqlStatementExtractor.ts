export interface ExtractedStatement {
  sql: string;
  isSelection: boolean;
  range?: {
    startLineNumber: number;
    endLineNumber: number;
  };
}

/**
 * Checks if a line ends with a semicolon (ignoring trailing whitespace and single line comments).
 */
function lineEndsWithSemicolon(line: string): boolean {
  // Remove single line comments: -- ...
  const withoutComment = line.replace(/--.*$/, '').trim();
  return withoutComment.endsWith(';');
}

/**
 * Checks if a line is a batch separator (e.g. GO).
 */
function isBatchSeparator(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return trimmed === 'GO';
}

/**
 * Checks if a line is blank or whitespace-only.
 */
function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

/**
 * Extracts the single SQL statement at the current cursor position,
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

  if (!fullText.trim()) {
    return { sql: '', isSelection: false };
  }

  const lines = fullText.split(/\r?\n/);
  const totalLines = lines.length;

  let targetLine = Math.max(1, Math.min(cursorLineNumber, totalLines));

  // If current line is blank, look for the nearest non-blank line
  if (isBlankLine(lines[targetLine - 1] ?? '')) {
    let found = false;
    // Search downwards
    for (let i = targetLine; i <= totalLines; i++) {
      if (!isBlankLine(lines[i - 1] ?? '')) {
        targetLine = i;
        found = true;
        break;
      }
    }
    // If not found downwards, search upwards
    if (!found) {
      for (let i = targetLine - 1; i >= 1; i--) {
        if (!isBlankLine(lines[i - 1] ?? '')) {
          targetLine = i;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return { sql: '', isSelection: false };
    }
  }

  // 2. Scan upwards to find statement start
  let startLine = targetLine;
  while (startLine > 1) {
    const prevLine = lines[startLine - 2] ?? '';
    if (isBlankLine(prevLine) || isBatchSeparator(prevLine) || lineEndsWithSemicolon(prevLine)) {
      break;
    }
    startLine--;
  }

  // 3. Scan downwards to find statement end
  let endLine = targetLine;
  while (endLine <= totalLines) {
    const currLine = lines[endLine - 1] ?? '';

    // If current line itself ends with semicolon, this is the end of statement
    if (lineEndsWithSemicolon(currLine)) {
      break;
    }

    // If reached last line, stop
    if (endLine === totalLines) {
      break;
    }

    const nextLine = lines[endLine] ?? '';
    // If next line is blank, GO, or starts a new block
    if (isBlankLine(nextLine) || isBatchSeparator(nextLine)) {
      break;
    }

    endLine++;
  }

  const statementLines = lines.slice(startLine - 1, endLine);
  const sql = statementLines.join('\n').trim();

  return {
    sql,
    isSelection: false,
    range: {
      startLineNumber: startLine,
      endLineNumber: endLine,
    },
  };
}
