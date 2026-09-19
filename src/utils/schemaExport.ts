import type { CellValue, ColumnDef, ResultSet } from '@/types/query';
import { saveTextWithPicker } from './fileStorage';

/**
 * Escapes database identifier for safe bracket quotation: [dbname]
 */
function escapeIdentifier(id: string): string {
  return id.replace(/\]/g, ']]');
}

/**
 * Escapes an individual cell value for standard RFC 4180 CSV
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object' && 'type' in val && (val as any).type === 'binary') {
    return `[Binary ${(val as any).length ?? 0} Bytes]`;
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a ResultSet (or columns + rows) into a CSV formatted string with UTF-8 BOM.
 */
export function resultSetToCsv(columns: ColumnDef[], rows: CellValue[][]): string {
  const header = columns.map((col) => escapeCsvValue(col.name)).join(',');
  const rowStrings = rows.map((row) =>
    columns.map((_, colIdx) => escapeCsvValue(row[colIdx])).join(',')
  );

  // Prefix with UTF-8 BOM so Excel opens Chinese/Unicode correctly without mojibake
  return '\uFEFF' + [header, ...rowStrings].join('\r\n');
}

/**
 * Combines multiple schema result sets into a single readable CSV with clear block dividers.
 */
export function combineResultSetsToCsv(
  sections: { title: string; columns: ColumnDef[]; rows: CellValue[][] }[]
): string {
  const parts: string[] = [];

  sections.forEach((sec, idx) => {
    parts.push(`"=== [區塊 ${idx + 1}] ${sec.title} (${sec.rows.length} 筆規格記錄) ==="`);
    const header = sec.columns.map((col) => escapeCsvValue(col.name)).join(',');
    parts.push(header);
    sec.rows.forEach((row) => {
      parts.push(sec.columns.map((_, cIdx) => escapeCsvValue(row[cIdx])).join(','));
    });
    parts.push(''); // blank line between sections
  });

  return '\uFEFF' + parts.join('\r\n');
}

/**
 * 查詢 1: 資料表與欄位規格 (Tables & Columns)
 */
export function getTablesAndColumnsSql(database: string): string {
  const safeDb = escapeIdentifier(database);
  return `USE [${safeDb}];

SELECT 
    s.name AS [Schema],
    t.name AS [Table],
    c.name AS [Column],
    c.column_id AS [ColId],
    ty.name AS [Type],
    c.max_length AS [ByteLen],
    c.precision AS [Precision],
    c.scale AS [Scale],
    c.is_nullable AS [Nullable],
    c.is_identity AS [Identity],
    ISNULL(dc.definition, '') AS [DefaultValue],
    ISNULL(c.collation_name, '') AS [Collation]
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
INNER JOIN sys.columns c ON c.object_id = t.object_id
INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
WHERE t.is_ms_shipped = 0
ORDER BY [Schema], [Table], [ColId];`;
}

/**
 * 查詢 2: 索引與鍵值規格 (Indexes & Keys)
 * 相容於 SQL Server 2012 ~ 2025 (使用 FOR XML PATH 實現多欄位逗號串接)
 */
export function getIndexesAndKeysSql(database: string): string {
  const safeDb = escapeIdentifier(database);
  return `USE [${safeDb}];

SELECT 
    s.name AS [Schema],
    t.name AS [Table],
    i.name AS [IndexName],
    i.type_desc AS [IndexType],
    i.is_unique AS [IsUnique],
    i.is_primary_key AS [IsPK],
    ISNULL(STUFF((
        SELECT ', ' + c2.name + CASE WHEN ic2.is_descending_key = 1 THEN ' DESC' ELSE ' ASC' END
        FROM sys.index_columns ic2
        INNER JOIN sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
        WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
        ORDER BY ic2.key_ordinal
        FOR XML PATH('')
    ), 1, 2, ''), '') AS [KeyColumns],
    ISNULL(STUFF((
        SELECT ', ' + c3.name
        FROM sys.index_columns ic3
        INNER JOIN sys.columns c3 ON c3.object_id = ic3.object_id AND c3.column_id = ic3.column_id
        WHERE ic3.object_id = i.object_id AND ic3.index_id = i.index_id AND ic3.is_included_column = 1
        ORDER BY ic3.index_column_id
        FOR XML PATH('')
    ), 1, 2, ''), '') AS [IncludedColumns]
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
INNER JOIN sys.indexes i ON i.object_id = t.object_id
WHERE t.is_ms_shipped = 0 AND i.name IS NOT NULL
ORDER BY [Schema], [Table], [IndexName];`;
}

/**
 * 查詢 3: 程式化物件雜湊 (Views, Stored Procedures, Functions Code Hash)
 */
export function getProgrammabilityHashSql(database: string): string {
  const safeDb = escapeIdentifier(database);
  return `USE [${safeDb}];

SELECT 
    s.name AS [Schema],
    o.name AS [ObjectName],
    o.type_desc AS [ObjectType],
    o.create_date AS [CreateDate],
    o.modify_date AS [ModifyDate],
    ISNULL(CONVERT(NVARCHAR(64), HASHBYTES('SHA2_256', m.definition), 2), '') AS [CodeHash]
FROM sys.sql_modules m
INNER JOIN sys.objects o ON o.object_id = m.object_id
INNER JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.is_ms_shipped = 0
ORDER BY [Schema], [ObjectType], [ObjectName];`;
}

export interface SchemaExportItem {
  key: 'tables_columns' | 'indexes' | 'programmability';
  title: string;
  defaultFileName: string;
  sql: string;
  status: 'pending' | 'running' | 'success' | 'error';
  errorMessage?: string;
  durationMs?: number;
  result?: ResultSet;
  csvContent?: string;
  fileSizeBytes?: number;
}

/**
 * Saves multiple files directly into a user-selected folder via File System Access API
 */
export async function saveFilesToDirectory(
  dirHandle: any,
  files: { fileName: string; content: string }[]
): Promise<{ fileName: string; size: number }[]> {
  const savedList: { fileName: string; size: number }[] = [];

  for (const file of files) {
    const fileHandle = await dirHandle.getFileHandle(file.fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file.content);
    await writable.close();
    const blob = new Blob([file.content]);
    savedList.push({ fileName: file.fileName, size: blob.size });
  }

  return savedList;
}

/**
 * Saves a single CSV file with the native Save As dialog
 */
export async function saveSingleCsvWithPicker(
  content: string,
  suggestedName: string
): Promise<{ saved: boolean; fileName?: string }> {
  return saveTextWithPicker(content, {
    suggestedName: suggestedName.endsWith('.csv') ? suggestedName : `${suggestedName}.csv`,
    fileDescription: 'CSV 檔案 (*.csv)',
    mimeType: 'text/csv',
    extensions: ['.csv', '.txt'],
  });
}

/**
 * Helper to format byte counts into readable string (e.g. 12.5 KB)
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
