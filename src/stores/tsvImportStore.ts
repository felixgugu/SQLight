import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import { schemaService } from '@/services/schemaService';
import { tsvImportService } from '@/services/tsvImportService';
import { isGeneratedColumn, parseTsv, planImportColumns, validateImportRows } from '@/utils/tsvImport';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ColumnItem } from '@/types/schema';
import type {
  ImportCapabilities,
  ImportResult,
  ImportValidationResult,
  TsvImportTarget,
  UniqueKeyPlan,
} from '@/types/tsvImport';

export type TsvImportSourceMode = 'file' | 'paste';

export const useTsvImportStore = defineStore('tsvImport', () => {
  const isOpen = ref(false);
  const step = ref<1 | 2>(1);
  const target = ref<TsvImportTarget | null>(null);

  // Target metadata
  const rawColumns = ref<ColumnItem[]>([]);
  const capabilities = ref<ImportCapabilities | null>(null);
  const uniqueKeys = ref<UniqueKeyPlan[]>([]);
  const isLoadingMetadata = ref(false);
  const metadataError = ref('');

  // Step 1 state (kept when the user navigates back)
  const sourceMode = ref<TsvImportSourceMode>('file');
  const fileName = ref('');
  const fileContent = ref('');
  const pastedText = ref('');
  const skipHeader = ref(false);
  const manualIdentity = ref(false);
  const sourceError = ref('');

  // Step 2 state
  const isValidating = ref(false);
  const validation = ref<ImportValidationResult | null>(null);
  const isImporting = ref(false);
  const importProgress = ref<{ processedRows: number; totalRows: number }>({
    processedRows: 0,
    totalRows: 0,
  });
  const importResult = ref<ImportResult | null>(null);
  const importError = ref('');

  const sourceText = computed(() => (sourceMode.value === 'file' ? fileContent.value : pastedText.value));
  const sourceLabel = computed(() =>
    sourceMode.value === 'file' ? fileName.value || '未選擇檔案' : '貼上文字'
  );
  const importColumns = computed(() => planImportColumns(rawColumns.value));
  const identityColumnName = computed(() => capabilities.value?.identityColumn ?? null);
  const manualIdentityDisabledReason = computed(() => capabilities.value?.disabledReason ?? '');
  const manualIdentityAvailable = computed(() => !manualIdentityDisabledReason.value);
  const hasIdentityColumn = computed(() =>
    rawColumns.value.some((column) => column.isIdentity && !isGeneratedColumn(column))
  );
  /** Non blocking warning: without IDENTITY_INSERT the database rejects the identity values. */
  const identityInsertWarning = computed(() => {
    if (!hasIdentityColumn.value || manualIdentity.value) return '';
    const reason = manualIdentityDisabledReason.value;
    return reason
      ? `此表含識別欄位，且無法啟用 IDENTITY_INSERT（${reason}）；未勾選時識別值仍會送出，資料庫將拒絕寫入並整批回滾。`
      : '此表含識別欄位；未勾選時識別值仍會隨 INSERT 送出，資料庫將拒絕寫入並整批回滾（勾選「允許手動指定識別值」可寫入該欄）。';
  });
  const hasDataRows = computed(() => {
    const text = sourceText.value;
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (!skipHeader.value) return true;
    return /[\r\n]/.test(trimmed);
  });
  const canValidate = computed(
    () => !isLoadingMetadata.value && !metadataError.value && importColumns.value.length > 0 && hasDataRows.value
  );
  const hasBlockingErrors = computed(() => (validation.value?.errors.length ?? 0) > 0);
  const canImport = computed(
    () => !isImporting.value && !hasBlockingErrors.value && (validation.value?.payload.length ?? 0) > 0
  );
  const importProgressPercent = computed(() => {
    const total = importProgress.value.totalRows;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((importProgress.value.processedRows / total) * 100));
  });

  function resetWizardState() {
    step.value = 1;
    sourceMode.value = 'file';
    fileName.value = '';
    fileContent.value = '';
    pastedText.value = '';
    skipHeader.value = false;
    manualIdentity.value = false;
    sourceError.value = '';
    isValidating.value = false;
    validation.value = null;
    isImporting.value = false;
    importProgress.value = { processedRows: 0, totalRows: 0 };
    importResult.value = null;
    importError.value = '';
  }

  async function loadMetadata() {
    const currentTarget = target.value;
    if (!currentTarget) return;
    isLoadingMetadata.value = true;
    metadataError.value = '';
    try {
      const [columns, caps] = await Promise.all([
        schemaService.getColumns(
          currentTarget.connId,
          currentTarget.schema,
          currentTarget.table,
          currentTarget.database
        ),
        tsvImportService.getCapabilities(currentTarget),
      ]);
      rawColumns.value = columns;
      capabilities.value = caps;
      if (columns.length === 0) {
        metadataError.value = '無法取得資料表欄位定義';
      } else if (planImportColumns(columns).length === 0) {
        metadataError.value = '此資料表沒有可寫入的欄位（全部為自動產生欄位）';
      }
      uniqueKeys.value = await tsvImportService.getUniqueKeys(currentTarget);
    } catch (err) {
      metadataError.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoadingMetadata.value = false;
    }
  }

  async function open(nextTarget: TsvImportTarget) {
    target.value = nextTarget;
    rawColumns.value = [];
    capabilities.value = null;
    uniqueKeys.value = [];
    metadataError.value = '';
    resetWizardState();
    isOpen.value = true;
    await loadMetadata();
  }

  function close() {
    if (isImporting.value) return;
    isOpen.value = false;
    target.value = null;
    rawColumns.value = [];
    capabilities.value = null;
    uniqueKeys.value = [];
    metadataError.value = '';
    resetWizardState();
  }

  function setSourceMode(mode: TsvImportSourceMode) {
    if (sourceMode.value === mode) return;
    sourceMode.value = mode;
    sourceError.value = '';
    validation.value = null;
    if (mode === 'file') pastedText.value = '';
    else {
      fileName.value = '';
      fileContent.value = '';
    }
  }

  function setFile(nextFileName: string, content: string) {
    fileName.value = nextFileName;
    fileContent.value = content;
    sourceError.value = '';
    validation.value = null;
  }

  function setPastedText(text: string) {
    pastedText.value = text;
    sourceError.value = '';
    validation.value = null;
  }

  function setSkipHeader(value: boolean) {
    skipHeader.value = value;
    validation.value = null;
  }

  function setManualIdentity(value: boolean) {
    if (!value) {
      manualIdentity.value = false;
      validation.value = null;
      return;
    }
    if (!manualIdentityAvailable.value) return;
    manualIdentity.value = true;
    validation.value = null;
  }

  async function validate(): Promise<boolean> {
    if (!canValidate.value || isValidating.value) return false;
    isValidating.value = true;
    validation.value = null;
    importResult.value = null;
    importError.value = '';
    await nextTick();
    try {
      const parsed = parseTsv(sourceText.value, { skipHeader: skipHeader.value });
      if (parsed.rows.length === 0) {
        sourceError.value = '沒有可匯入的資料列';
        return false;
      }
      validation.value = validateImportRows({
        rows: parsed.rows,
        blankLines: parsed.blankLines,
        columns: importColumns.value,
        rawColumns: rawColumns.value,
        uniqueKeys: uniqueKeys.value,
      });
      step.value = 2;
      return true;
    } catch (err) {
      sourceError.value = err instanceof Error ? err.message : String(err);
      return false;
    } finally {
      isValidating.value = false;
    }
  }

  function backToSource() {
    if (isImporting.value) return;
    step.value = 1;
    validation.value = null;
    importResult.value = null;
    importError.value = '';
  }

  async function startImport(): Promise<void> {
    const currentTarget = target.value;
    const currentValidation = validation.value;
    if (!currentTarget || !currentValidation || !canImport.value) return;

    const workspaceStore = useWorkspaceStore();
    const importId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    isImporting.value = true;
    importResult.value = null;
    importError.value = '';
    importProgress.value = { processedRows: 0, totalRows: currentValidation.payload.length };

    try {
      const result = await tsvImportService.importRows({
        target: currentTarget,
        columns: importColumns.value.map((column) => column.name),
        rows: currentValidation.payload,
        manualIdentity: manualIdentity.value,
        importId,
        onProgress: (progress) => {
          importProgress.value = {
            processedRows: progress.processedRows,
            totalRows: progress.totalRows,
          };
        },
      });
      importResult.value = result;
      if (result.rolledBack) {
        workspaceStore.showToast('TSV 匯入失敗，本次未寫入任何資料', 'error', 4000);
      } else {
        workspaceStore.showToast(
          `TSV 匯入完成，共新增 ${result.insertedCount.toLocaleString()} 筆`,
          'success',
          3000
        );
        workspaceStore.bumpTableDataVersion(
          currentTarget.connId,
          currentTarget.database,
          currentTarget.schema,
          currentTarget.table
        );
      }
    } catch (err) {
      importError.value = err instanceof Error ? err.message : String(err);
      workspaceStore.showToast('TSV 匯入失敗，本次未寫入任何資料', 'error', 4000);
    } finally {
      isImporting.value = false;
    }
  }

  return {
    isOpen,
    step,
    target,
    rawColumns,
    capabilities,
    uniqueKeys,
    isLoadingMetadata,
    metadataError,
    sourceMode,
    fileName,
    fileContent,
    pastedText,
    skipHeader,
    manualIdentity,
    sourceError,
    isValidating,
    validation,
    isImporting,
    importProgress,
    importResult,
    importError,
    sourceText,
    sourceLabel,
    importColumns,
    identityColumnName,
    manualIdentityAvailable,
    manualIdentityDisabledReason,
    hasIdentityColumn,
    identityInsertWarning,
    canValidate,
    hasBlockingErrors,
    canImport,
    importProgressPercent,
    loadMetadata,
    open,
    close,
    setSourceMode,
    setFile,
    setPastedText,
    setSkipHeader,
    setManualIdentity,
    validate,
    backToSource,
    startImport,
  };
});
