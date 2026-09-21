import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ColumnDef, CellValue } from '@/types/query';
import type { DataViewPayload } from '@/types/dataView';
import {
  formatDataViewFields,
  filterDataViewFields,
  formatRowForJson,
  formatRowForTsv,
  formatRowForMarkdown,
} from '@/utils/dataViewFormatters';

export const useDataViewStore = defineStore('dataView', () => {
  // 視窗可見性與狀態
  const isOpen = ref(false);
  const isMinimized = ref(false);
  const isMaximized = ref(false);

  // 資料核心
  const columns = ref<ColumnDef[]>([]);
  const currentRow = ref<CellValue[] | null>(null);
  const rowIndex = ref<number>(-1);
  const totalRows = ref<number>(0);
  const allRows = ref<CellValue[][]>([]);
  const tableName = ref<string>('');
  const sourceTitle = ref<string>('');

  // 互動狀態（最小化與最大化時完整保留）
  const filterText = ref<string>('');
  const scrollTop = ref<number>(0);

  // 全部欄位陣列
  const allFields = computed(() => {
    if (!currentRow.value || !columns.value.length) return [];
    return formatDataViewFields(columns.value, currentRow.value);
  });

  // 過濾後欄位陣列
  const filteredFields = computed(() => {
    return filterDataViewFields(allFields.value, filterText.value);
  });

  // 導覽狀態
  const hasPrevRow = computed(() => {
    return rowIndex.value > 0 && allRows.value.length > 0;
  });

  const hasNextRow = computed(() => {
    return (
      rowIndex.value >= 0 &&
      allRows.value.length > 0 &&
      rowIndex.value < allRows.value.length - 1
    );
  });

  const currentDisplayIndex = computed(() => {
    return rowIndex.value >= 0 ? rowIndex.value + 1 : 1;
  });

  function openDataView(payload: DataViewPayload) {
    columns.value = payload.columns;
    currentRow.value = payload.row;
    rowIndex.value = payload.rowIndex ?? -1;
    totalRows.value = payload.totalRows ?? payload.allRows?.length ?? 1;
    allRows.value = payload.allRows ?? [];
    tableName.value = payload.tableName ?? '';
    sourceTitle.value = payload.sourceTitle ?? '';

    // 開啟時展開
    isOpen.value = true;
    isMinimized.value = false;
  }

  function closeDataView() {
    isOpen.value = false;
    isMinimized.value = false;
    isMaximized.value = false;
    filterText.value = '';
    scrollTop.value = 0;
    currentRow.value = null;
    allRows.value = [];
  }

  function minimize() {
    isMinimized.value = true;
  }

  function restore() {
    isMinimized.value = false;
  }

  function toggleMaximize() {
    isMaximized.value = !isMaximized.value;
  }

  function setFilterText(text: string) {
    filterText.value = text;
  }

  function setScrollTop(top: number) {
    scrollTop.value = top;
  }

  function goToPrevRow() {
    if (!hasPrevRow.value) return;
    const prevIdx = rowIndex.value - 1;
    const prevRow = allRows.value[prevIdx];
    if (prevRow) {
      rowIndex.value = prevIdx;
      currentRow.value = prevRow;
    }
  }

  function goToNextRow() {
    if (!hasNextRow.value) return;
    const nextIdx = rowIndex.value + 1;
    const nextRow = allRows.value[nextIdx];
    if (nextRow) {
      rowIndex.value = nextIdx;
      currentRow.value = nextRow;
    }
  }

  // 複製方法（共用原查詢結果之複製格式）
  async function copyAsJson(): Promise<boolean> {
    if (!currentRow.value || !columns.value.length) return false;
    const jsonStr = formatRowForJson(columns.value, currentRow.value);
    await navigator.clipboard.writeText(jsonStr);
    return true;
  }

  async function copyAsTsv(): Promise<boolean> {
    if (!currentRow.value) return false;
    const tsvStr = formatRowForTsv(currentRow.value);
    await navigator.clipboard.writeText(tsvStr);
    return true;
  }

  async function copyAsMarkdown(): Promise<boolean> {
    if (!currentRow.value || !columns.value.length) return false;
    const mdStr = formatRowForMarkdown(columns.value, currentRow.value);
    await navigator.clipboard.writeText(mdStr);
    return true;
  }

  return {
    isOpen,
    isMinimized,
    isMaximized,
    columns,
    currentRow,
    rowIndex,
    totalRows,
    allRows,
    tableName,
    sourceTitle,
    filterText,
    scrollTop,
    allFields,
    filteredFields,
    hasPrevRow,
    hasNextRow,
    currentDisplayIndex,
    openDataView,
    closeDataView,
    minimize,
    restore,
    toggleMaximize,
    setFilterText,
    setScrollTop,
    goToPrevRow,
    goToNextRow,
    copyAsJson,
    copyAsTsv,
    copyAsMarkdown,
  };
});
