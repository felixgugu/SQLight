export interface TableAliasMap {
  // Key: alias or tableName (lowercase) -> Value: actual tableName
  aliases: Map<string, string>;
  // List of all referenced table names (lowercase) in the query
  referencedTables: Set<string>;
}

const RESERVED_NON_ALIAS = new Set([
  'where', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on',
  'group', 'by', 'order', 'having', 'union', 'all', 'intersect', 'except',
  'limit', 'offset', 'fetch', 'next', 'rows', 'only', 'with', 'nolock',
  'as', 'set', 'select', 'and', 'or', 'not', 'in', 'between', 'like', 'is',
  'null', 'values', 'into', 'from', 'table', 'when', 'then', 'else', 'end',
  'case', 'exec', 'execute', 'declare', 'go',
]);

const SQL_RESERVED_IDENTIFIERS = new Set([
  'order', 'group', 'user', 'table', 'key', 'index', 'check', 'constraint',
  'primary', 'foreign', 'references', 'default', 'view', 'schema', 'database',
  'cursor', 'procedure', 'function', 'trigger', 'transaction', 'column',
]);

/**
 * Parses all table references and aliases from a SQL query string.
 * Supports:
 * - FROM [schema].[Table] [AS] alias
 * - JOIN [schema].[Table] [AS] alias
 * - FROM Table1 a, Table2 b
 */
export function parseTableAliases(sql: string): TableAliasMap {
  const aliases = new Map<string, string>();
  const referencedTables = new Set<string>();

  if (!sql) {
    return { aliases, referencedTables };
  }

  // Strip single-line and multi-line comments
  const cleanSql = sql
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  // Regex matches: (FROM|JOIN)\s+([^\s,()]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_#@\[\]]+))?
  const fromJoinRegex = /\b(?:FROM|JOIN)\s+([a-zA-Z0-9_#@\.\[\]]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_#@\[\]]+))?/gi;

  let match: RegExpExecArray | null;
  while ((match = fromJoinRegex.exec(cleanSql)) !== null) {
    const rawTable = match[1];
    const rawAlias = match[2];

    if (!rawTable) continue;

    // Clean table name (e.g. [dbo].[Users] -> Users, dbo.Users -> Users)
    const tableParts = rawTable.split('.').map((p) => p.replace(/[\[\]]/g, '').trim());
    const tableName = tableParts[tableParts.length - 1] || '';
    if (!tableName) continue;

    const lowerTableName = tableName.toLowerCase();
    referencedTables.add(lowerTableName);
    // Self-mapping so "Users.col" works
    aliases.set(lowerTableName, tableName);

    // If schema is present (e.g. dbo.Users), map "dbo.users" -> "Users"
    if (tableParts.length > 1) {
      aliases.set(tableParts.join('.').toLowerCase(), tableName);
    }

    if (rawAlias) {
      const cleanAlias = rawAlias.replace(/[\[\]]/g, '').trim();
      const lowerAlias = cleanAlias.toLowerCase();
      if (!RESERVED_NON_ALIAS.has(lowerAlias)) {
        aliases.set(lowerAlias, tableName);
      }
    }
  }

  // Also check comma-separated tables in FROM clause: FROM TableA a, TableB b
  const commaFromRegex = /\bFROM\s+([^;]+?)(?:\bWHERE\b|\bGROUP\b|\bORDER\b|\bHAVING\b|\bJOIN\b|;|$)/i;
  const fromClauseMatch = commaFromRegex.exec(cleanSql);
  if (fromClauseMatch && fromClauseMatch[1]) {
    const tablesPart = fromClauseMatch[1];
    const items = tablesPart.split(',');
    for (const item of items) {
      const tokens = item.trim().split(/\s+/).filter(Boolean);
      if (tokens.length >= 1) {
        const rawTable = tokens[0] ?? '';
        const tableParts = rawTable.split('.').map((p) => p.replace(/[\[\]]/g, '').trim());
        const tableName = tableParts[tableParts.length - 1] || '';
        if (tableName && !RESERVED_NON_ALIAS.has(tableName.toLowerCase())) {
          const lowerTableName = tableName.toLowerCase();
          referencedTables.add(lowerTableName);
          aliases.set(lowerTableName, tableName);

          // Check if alias provided: TableA a or TableA AS a
          let aliasToken = tokens.length === 2 ? tokens[1] : tokens.length === 3 && tokens[1]?.toUpperCase() === 'AS' ? tokens[2] : null;
          if (aliasToken) {
            const cleanAlias = aliasToken.replace(/[\[\]]/g, '').trim();
            const lowerAlias = cleanAlias.toLowerCase();
            if (!RESERVED_NON_ALIAS.has(lowerAlias)) {
              aliases.set(lowerAlias, tableName);
            }
          }
        }
      }
    }
  }

  return { aliases, referencedTables };
}

export type QueryContextType = 'table' | 'column_or_expr' | 'general';

export interface CursorContext {
  isDotTrigger: boolean;
  qualifier?: string;
  contextType: QueryContextType;
}

/**
 * Analyzes the line content up to the cursor to determine context.
 */
export function getCursorContext(lineUntilCursor: string): CursorContext {
  // Check if cursor is immediately after a dot: e.g. "u." or "Users." or "[dbo]." or "u.a"
  const dotMatch = lineUntilCursor.match(/([a-zA-Z0-9_#@\[\]]+)\.\s*([a-zA-Z0-9_#@\[\]]*)$/);
  if (dotMatch && dotMatch[1]) {
    const qualifier = dotMatch[1].replace(/[\[\]]/g, '').trim();
    return {
      isDotTrigger: true,
      qualifier,
      contextType: 'column_or_expr',
    };
  }

  // Find the last keyword before the cursor (excluding punctuation)
  const words = lineUntilCursor
    .replace(/[(),;]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lastWord = words.length > 0 ? (words[words.length - 1] ?? '').toUpperCase() : '';
  const secondLastWord = words.length > 1 ? (words[words.length - 2] ?? '').toUpperCase() : '';

  if (
    ['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE'].includes(lastWord) ||
    (lastWord === 'JOIN' && ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'].includes(secondLastWord))
  ) {
    return {
      isDotTrigger: false,
      contextType: 'table',
    };
  }

  if (['SELECT', 'WHERE', 'AND', 'OR', 'ON', 'SET', 'HAVING', 'BY'].includes(lastWord)) {
    return {
      isDotTrigger: false,
      contextType: 'column_or_expr',
    };
  }

  return {
    isDotTrigger: false,
    contextType: 'general',
  };
}

/**
 * Wraps identifier in square brackets if it contains spaces, special characters, or is a reserved keyword.
 */
export function wrapIdentifierIfNeeded(name: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    if (SQL_RESERVED_IDENTIFIERS.has(name.toLowerCase())) {
      return `[${name}]`;
    }
    return name;
  }
  return `[${name}]`;
}
