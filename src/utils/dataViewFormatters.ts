import type { ColumnDef, CellValue } from '@/types/query';
import type { DataViewFieldItem, DataViewSpecialType } from '@/types/dataView';
import { exportRowAsJson, exportRowsAsMarkdown } from './exportFormatters';
import { formatCellForExport } from '@/composables/useColumnAutoWidth';

/**
 * 判斷資料格之特殊資料型別與格式化顯示文字
 */
export function detectSpecialType(value: CellValue): {
  specialType: DataViewSpecialType;
  displayValue: string;
  formattedJson?: string;
} {
  if (value === null || value === undefined) {
    return { specialType: 'null', displayValue: 'NULL' };
  }

  if (typeof value === 'boolean') {
    return {
      specialType: 'boolean',
      displayValue: value ? 'TRUE' : 'FALSE',
    };
  }

  if (typeof value === 'string' && value === '') {
    return { specialType: 'empty', displayValue: '' };
  }

  if (
    typeof value === 'object' &&
    'type' in (value as object) &&
    (value as { type: string; length?: number }).type === 'binary'
  ) {
    const len = (value as { type: string; length?: number }).length ?? 0;
    return {
      specialType: 'binary',
      displayValue: `[Binary ${len} B]`,
    };
  }

  // 檢查是否為 JSON 物件或 JSON 字串
  if (typeof value === 'object') {
    try {
      const formattedJson = JSON.stringify(value, null, 2);
      return { specialType: 'json', displayValue: formattedJson, formattedJson };
    } catch {
      return { specialType: 'normal', displayValue: String(value) };
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          const formattedJson = JSON.stringify(parsed, null, 2);
          return { specialType: 'json', displayValue: value, formattedJson };
        }
      } catch {
        // Not JSON, treat as normal string
      }
    }
    return { specialType: 'normal', displayValue: value };
  }

  return { specialType: 'normal', displayValue: String(value) };
}

/**
 * 將查詢結果的欄位與單列轉換為直式資料檢視之欄位陣列
 */
export function formatDataViewFields(
  columns: ColumnDef[],
  row: CellValue[],
  primaryKeyColumns?: Set<string>,
  identityColumns?: Set<string>
): DataViewFieldItem[] {
  return columns.map((col, idx) => {
    const val = row[idx] ?? null;
    const { specialType, displayValue, formattedJson } = detectSpecialType(val);
    const colNameLower = col.name.toLowerCase();

    return {
      index: idx,
      name: col.name,
      dataType: col.dataType || 'nvarchar',
      nullable: col.nullable ?? true,
      isPrimaryKey: primaryKeyColumns?.has(colNameLower) ?? false,
      isIdentity: identityColumns?.has(colNameLower) ?? false,
      value: val,
      displayValue,
      specialType,
      formattedJson,
    };
  });
}

/**
 * 即時過濾資料欄位：同時搜尋欄位名稱與欄位值，不區分大小寫
 */
export function filterDataViewFields(
  fields: DataViewFieldItem[],
  query: string
): DataViewFieldItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return fields;

  return fields.filter((field) => {
    const nameMatch = field.name.toLowerCase().includes(q);
    const valueMatch = field.displayValue.toLowerCase().includes(q);
    return nameMatch || valueMatch;
  });
}

/**
 * 複製單列資料為 JSON 物件（格式與既有資料列複製一致）
 */
export function formatRowForJson(columns: ColumnDef[], row: CellValue[]): string {
  return exportRowAsJson(columns, row);
}

/**
 * 複製單列資料為 TSV（Excel）（格式與既有資料列複製一致）
 */
export function formatRowForTsv(row: CellValue[]): string {
  return row.map(formatCellForExport).join('\t');
}

/**
 * 複製單列資料為 Markdown 表格（格式與既有資料列複製一致）
 */
export function formatRowForMarkdown(columns: ColumnDef[], row: CellValue[]): string {
  return exportRowsAsMarkdown(columns, [row]);
}
