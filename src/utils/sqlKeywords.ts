export interface SqlKeywordItem {
  name: string;
  detail?: string;
  documentation?: string;
  snippet?: string;
}

export const SQL_KEYWORDS: SqlKeywordItem[] = [
  { name: 'SELECT', detail: 'Clause: Query projection', snippet: 'SELECT ' },
  { name: 'FROM', detail: 'Clause: Table source', snippet: 'FROM ' },
  { name: 'WHERE', detail: 'Clause: Filter condition', snippet: 'WHERE ' },
  { name: 'JOIN', detail: 'Clause: Table join', snippet: 'JOIN ' },
  { name: 'INNER JOIN', detail: 'Clause: Inner join', snippet: 'INNER JOIN ' },
  { name: 'LEFT JOIN', detail: 'Clause: Left outer join', snippet: 'LEFT JOIN ' },
  { name: 'RIGHT JOIN', detail: 'Clause: Right outer join', snippet: 'RIGHT JOIN ' },
  { name: 'FULL OUTER JOIN', detail: 'Clause: Full outer join', snippet: 'FULL OUTER JOIN ' },
  { name: 'CROSS JOIN', detail: 'Clause: Cartesian product', snippet: 'CROSS JOIN ' },
  { name: 'ON', detail: 'Clause: Join condition', snippet: 'ON ' },
  { name: 'GROUP BY', detail: 'Clause: Grouping', snippet: 'GROUP BY ' },
  { name: 'HAVING', detail: 'Clause: Group filter', snippet: 'HAVING ' },
  { name: 'ORDER BY', detail: 'Clause: Sort order', snippet: 'ORDER BY ' },
  { name: 'ASC', detail: 'Order: Ascending' },
  { name: 'DESC', detail: 'Order: Descending' },
  { name: 'AS', detail: 'Alias keyword', snippet: 'AS ' },
  { name: 'DISTINCT', detail: 'Modifier: Unique rows' },
  { name: 'TOP', detail: 'Modifier: Limit rows', snippet: 'TOP ${1:100} ' },
  { name: 'INSERT INTO', detail: 'DML: Insert rows', snippet: 'INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});' },
  { name: 'VALUES', detail: 'DML: Values list', snippet: 'VALUES (${1:values})' },
  { name: 'UPDATE', detail: 'DML: Update rows', snippet: 'UPDATE ${1:table}\nSET ${2:col} = ${3:val}\nWHERE ${4:condition};' },
  { name: 'SET', detail: 'DML: Update assignment', snippet: 'SET ' },
  { name: 'DELETE FROM', detail: 'DML: Delete rows', snippet: 'DELETE FROM ${1:table} WHERE ${2:condition};' },
  { name: 'AND', detail: 'Logical operator' },
  { name: 'OR', detail: 'Logical operator' },
  { name: 'NOT', detail: 'Logical negation' },
  { name: 'IN', detail: 'Predicate: List inclusion', snippet: 'IN (${1:list})' },
  { name: 'BETWEEN', detail: 'Predicate: Range check', snippet: 'BETWEEN ${1:min} AND ${2:max}' },
  { name: 'LIKE', detail: 'Predicate: Pattern matching', snippet: "LIKE '%${1:pattern}%'" },
  { name: 'IS NULL', detail: 'Predicate: Null test' },
  { name: 'IS NOT NULL', detail: 'Predicate: Not null test' },
  { name: 'EXISTS', detail: 'Predicate: Subquery check', snippet: 'EXISTS (${1:subquery})' },
  { name: 'UNION', detail: 'Set operator: Union distinct' },
  { name: 'UNION ALL', detail: 'Set operator: Union all' },
  { name: 'INTERSECT', detail: 'Set operator: Intersection' },
  { name: 'EXCEPT', detail: 'Set operator: Difference' },
  { name: 'CASE', detail: 'Expression: Conditional', snippet: 'CASE\n\tWHEN ${1:condition} THEN ${2:result}\n\tELSE ${3:result}\nEND' },
  { name: 'WHEN', detail: 'Expression: Case condition' },
  { name: 'THEN', detail: 'Expression: Case result' },
  { name: 'ELSE', detail: 'Expression: Case fallback' },
  { name: 'END', detail: 'Expression: End block' },
  { name: 'WITH (NOLOCK)', detail: 'Table hint: Read uncommitted', snippet: 'WITH (NOLOCK)' },
  { name: 'OVER', detail: 'Window specification', snippet: 'OVER (PARTITION BY ${1:col} ORDER BY ${2:col})' },
  { name: 'PARTITION BY', detail: 'Window partitioning', snippet: 'PARTITION BY ' },
  { name: 'OFFSET', detail: 'Pagination: Offset', snippet: 'OFFSET ${1:0} ROWS' },
  { name: 'FETCH NEXT', detail: 'Pagination: Fetch count', snippet: 'FETCH NEXT ${1:50} ROWS ONLY' },
  { name: 'CREATE TABLE', detail: 'DDL: Create table' },
  { name: 'ALTER TABLE', detail: 'DDL: Alter table' },
  { name: 'DROP TABLE', detail: 'DDL: Drop table' },
  { name: 'TRUNCATE TABLE', detail: 'DDL: Truncate table' },
  { name: 'EXEC', detail: 'Execute stored procedure', snippet: 'EXEC ' },
  { name: 'DECLARE', detail: 'Variable declaration', snippet: 'DECLARE @${1:var} ${2:INT};' },
];

export const SQL_FUNCTIONS: SqlKeywordItem[] = [
  // Aggregate
  { name: 'COUNT', detail: 'Aggregate: Count rows', snippet: 'COUNT(${1:*})', documentation: 'Returns the number of items in a group.' },
  { name: 'SUM', detail: 'Aggregate: Total sum', snippet: 'SUM(${1:expression})', documentation: 'Returns the sum of all the values in an expression.' },
  { name: 'AVG', detail: 'Aggregate: Average value', snippet: 'AVG(${1:expression})', documentation: 'Returns the average of values in a group.' },
  { name: 'MIN', detail: 'Aggregate: Minimum value', snippet: 'MIN(${1:expression})', documentation: 'Returns the minimum value in an expression.' },
  { name: 'MAX', detail: 'Aggregate: Maximum value', snippet: 'MAX(${1:expression})', documentation: 'Returns the maximum value in an expression.' },
  { name: 'STRING_AGG', detail: 'Aggregate: Concatenate strings', snippet: "STRING_AGG(${1:expression}, '${2:,}')", documentation: 'Concatenates values of string expressions.' },

  // Conditional / Null Handling
  { name: 'ISNULL', detail: 'Function: Replace NULL', snippet: 'ISNULL(${1:check_expression}, ${2:replacement_value})', documentation: 'Replaces NULL with the specified replacement value.' },
  { name: 'COALESCE', detail: 'Function: First non-null', snippet: 'COALESCE(${1:val1}, ${2:val2})', documentation: 'Evaluates arguments in order and returns first non-null.' },
  { name: 'NULLIF', detail: 'Function: Return NULL if equal', snippet: 'NULLIF(${1:exp1}, ${2:exp2})', documentation: 'Returns NULL if the two expressions are equal.' },
  { name: 'IIF', detail: 'Function: Inline IF', snippet: 'IIF(${1:condition}, ${2:true_val}, ${3:false_val})', documentation: 'Returns one of two values depending on condition.' },

  // Conversion
  { name: 'CAST', detail: 'Function: Type conversion', snippet: 'CAST(${1:expression} AS ${2:INT})', documentation: 'Converts an expression of one data type to another.' },
  { name: 'CONVERT', detail: 'Function: Type conversion with style', snippet: 'CONVERT(${1:VARCHAR(50)}, ${2:expression}, ${3:120})', documentation: 'Converts an expression to another data type.' },
  { name: 'TRY_CAST', detail: 'Function: Safe type conversion', snippet: 'TRY_CAST(${1:expression} AS ${2:INT})', documentation: 'Returns value cast to specified data type or NULL.' },

  // String
  { name: 'LEN', detail: 'Function: String length', snippet: 'LEN(${1:string})', documentation: 'Returns the number of characters of the specified string.' },
  { name: 'SUBSTRING', detail: 'Function: Substring', snippet: 'SUBSTRING(${1:string}, ${2:start}, ${3:length})', documentation: 'Returns part of a character expression.' },
  { name: 'TRIM', detail: 'Function: Remove whitespace', snippet: 'TRIM(${1:string})', documentation: 'Removes leading and trailing space characters.' },
  { name: 'UPPER', detail: 'Function: Convert to uppercase', snippet: 'UPPER(${1:string})', documentation: 'Returns character expression with lowercase to uppercase.' },
  { name: 'LOWER', detail: 'Function: Convert to lowercase', snippet: 'LOWER(${1:string})', documentation: 'Returns character expression with uppercase to lowercase.' },
  { name: 'CHARINDEX', detail: 'Function: Find substring index', snippet: 'CHARINDEX(${1:substring}, ${2:string})', documentation: 'Searches an expression for another expression.' },
  { name: 'REPLACE', detail: 'Function: Replace substring', snippet: 'REPLACE(${1:string}, ${2:old_sub}, ${3:new_sub})', documentation: 'Replaces all occurrences of a specified string value.' },
  { name: 'CONCAT', detail: 'Function: Concatenate strings', snippet: 'CONCAT(${1:val1}, ${2:val2})', documentation: 'Returns string resulting from concatenation.' },

  // Date & Time
  { name: 'GETDATE', detail: 'Function: Current datetime', snippet: 'GETDATE()', documentation: 'Returns current database system timestamp.' },
  { name: 'GETUTCDATE', detail: 'Function: Current UTC datetime', snippet: 'GETUTCDATE()', documentation: 'Returns current database system timestamp in UTC.' },
  { name: 'DATEADD', detail: 'Function: Add interval to date', snippet: 'DATEADD(${1:day}, ${2:number}, ${3:date})', documentation: 'Adds a specified number interval to a date.' },
  { name: 'DATEDIFF', detail: 'Function: Difference between dates', snippet: 'DATEDIFF(${1:day}, ${2:startdate}, ${3:enddate})', documentation: 'Returns difference between two dates.' },
  { name: 'FORMAT', detail: 'Function: Format value', snippet: "FORMAT(${1:value}, '${2:yyyy-MM-dd}')", documentation: 'Returns value formatted with specified format.' },
  { name: 'EOMONTH', detail: 'Function: End of month date', snippet: 'EOMONTH(${1:date})', documentation: 'Returns the last day of the month containing the date.' },

  // Window / Ranking
  { name: 'ROW_NUMBER', detail: 'Window: Row numbering', snippet: 'ROW_NUMBER() OVER (ORDER BY ${1:col})', documentation: 'Numbers the output of a result set.' },
  { name: 'RANK', detail: 'Window: Rank with gaps', snippet: 'RANK() OVER (ORDER BY ${1:col})', documentation: 'Returns the rank of each row in partition.' },
  { name: 'DENSE_RANK', detail: 'Window: Rank without gaps', snippet: 'DENSE_RANK() OVER (ORDER BY ${1:col})', documentation: 'Returns the rank of each row without gaps.' },
];

export const SQL_SNIPPETS = [
  {
    label: 'sel',
    detail: 'Snippet: SELECT * FROM table',
    snippet: 'SELECT\n\t${1:*}\nFROM ${2:table}\nWHERE ${3:1 = 1};',
    documentation: 'Select query template',
  },
  {
    label: 'seltop',
    detail: 'Snippet: SELECT TOP 100 * FROM table',
    snippet: 'SELECT TOP ${1:100}\n\t${2:*}\nFROM ${3:table}\nORDER BY ${4:1};',
    documentation: 'Select TOP N query template',
  },
  {
    label: 'join',
    detail: 'Snippet: JOIN table ON condition',
    snippet: 'JOIN ${1:table} ${2:t} ON ${2:t}.${3:id} = ${4:other}.${3:id}',
    documentation: 'JOIN clause template',
  },
  {
    label: 'leftjoin',
    detail: 'Snippet: LEFT JOIN table ON condition',
    snippet: 'LEFT JOIN ${1:table} ${2:t} ON ${2:t}.${3:id} = ${4:other}.${3:id}',
    documentation: 'LEFT JOIN clause template',
  },
  {
    label: 'cte',
    detail: 'Snippet: WITH CTE Common Table Expression',
    snippet: 'WITH ${1:CteName} AS (\n\tSELECT\n\t\t${2:*}\n\tFROM ${3:table}\n)\nSELECT * FROM ${1:CteName};',
    documentation: 'Common Table Expression (CTE) template',
  },
  {
    label: 'ins',
    detail: 'Snippet: INSERT INTO table VALUES',
    snippet: 'INSERT INTO ${1:table} (${2:col1, col2})\nVALUES (${3:val1, val2});',
    documentation: 'INSERT statement template',
  },
  {
    label: 'upd',
    detail: 'Snippet: UPDATE table SET WHERE',
    snippet: 'UPDATE ${1:table}\nSET ${2:col} = ${3:val}\nWHERE ${4:id} = ${5:val};',
    documentation: 'UPDATE statement template',
  },
  {
    label: 'del',
    detail: 'Snippet: DELETE FROM table WHERE',
    snippet: 'DELETE FROM ${1:table}\nWHERE ${2:condition};',
    documentation: 'DELETE statement template',
  },
];
