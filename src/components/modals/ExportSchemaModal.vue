<template>
  <Dialog
    :visible="isOpen"
    modal
    :closable="step !== 'running'"
    :dismissable-mask="step !== 'running'"
    class="w-full max-w-xl font-sans"
    @update:visible="val => !val && handleClose()"
  >
    <template #header>
      <div class="flex items-center space-x-2">
        <div class="w-7 h-7 rounded-lg bg-brand-500/15 flex items-center justify-center text-accent">
          <i class="pi pi-file-export text-sm" />
        </div>
        <div>
          <span class="font-semibold text-sm text-dark-100">匯出資料庫結構 CSV</span>
          <span class="ml-2 text-xxs text-dark-400 font-normal">
            {{ stepTitle }}
          </span>
        </div>
      </div>
    </template>

    <!-- Modal Body -->
    <div class="space-y-4 text-xs py-1">
      <!-- Target Environment & Database Info -->
      <div class="flex items-center space-x-2 text-xxs font-mono bg-dark-900 p-2 rounded border border-dark-750">
        <div class="flex items-center space-x-1.5 text-dark-300">
          <span class="text-dark-500">連線:</span>
          <span class="font-semibold text-dark-100">{{ connectionName || connectionId }}</span>
        </div>
        <span class="text-dark-600">/</span>
        <div class="flex items-center space-x-1.5 text-dark-300">
          <span class="text-dark-500">資料庫:</span>
          <span class="font-semibold text-accent">{{ database }}</span>
        </div>
      </div>

      <!-- Step 1: Confirm -->
      <template v-if="step === 'confirm'">
        <div class="p-3 bg-dark-850/80 rounded-lg border border-dark-750 space-y-2.5">
          <p class="text-dark-200 leading-relaxed text-xs">
            此功能將擷取資料庫「<strong class="text-accent font-semibold">{{ database }}</strong>」之完整結構規格，以供輸出 CSV 進行版本控管或與其他環境資料庫進行結構比對。
          </p>
          <div class="text-xxs text-dark-400">
            即將執行下列 3 項標準系統目錄探勘查詢：
          </div>

          <!-- 3 Queries Overview List -->
          <div class="space-y-2">
            <div
              v-for="(item, idx) in exportItems"
              :key="item.key"
              class="p-2.5 rounded bg-dark-900/90 border border-dark-750/70 hover:border-dark-700 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <span class="w-4 h-4 rounded-full bg-brand-500/20 text-accent font-mono text-[10px] flex items-center justify-center font-bold">
                    {{ idx + 1 }}
                  </span>
                  <span class="font-medium text-dark-200 text-xs">{{ item.title }}</span>
                </div>
                <span class="text-xxs font-mono text-dark-400 bg-dark-800 px-1.5 py-0.5 rounded">
                  {{ item.defaultFileName }}
                </span>
              </div>
              <div class="mt-1 pl-6 text-xxs text-dark-400 leading-normal">
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsible SQL Preview -->
        <div class="border border-dark-750 rounded-lg overflow-hidden bg-dark-900/50">
          <button
            type="button"
            @click="showSqlPreview = !showSqlPreview"
            class="w-full flex items-center justify-between px-3 py-2 text-xxs text-dark-400 hover:text-dark-200 hover:bg-dark-800/60 transition-colors"
          >
            <span class="flex items-center space-x-1.5">
              <i class="pi pi-code text-xs text-accent" />
              <span>檢視即將執行的 SQL 語句 (3 段查詢)</span>
            </span>
            <i :class="['pi text-xxs transition-transform duration-200', showSqlPreview ? 'pi-chevron-down' : 'pi-chevron-right']" />
          </button>

          <div v-if="showSqlPreview" class="p-3 border-t border-dark-750 space-y-3 max-h-60 overflow-y-auto">
            <div v-for="(item, idx) in exportItems" :key="item.key" class="space-y-1">
              <div class="text-xxs font-semibold text-dark-300">{{ idx + 1 }}. {{ item.title }}</div>
              <pre class="bg-dark-950 p-2 rounded border border-dark-800 font-mono text-[11px] text-dark-300 overflow-x-auto select-text">{{ item.sql }}</pre>
            </div>
          </div>
        </div>
      </template>

      <!-- Step 2: Running / Executing -->
      <template v-else-if="step === 'running'">
        <div class="space-y-3">
          <div class="flex items-center space-x-2 text-dark-300 text-xs py-1">
            <i class="pi pi-spin pi-spinner text-accent" />
            <span>正在自資料庫查詢結構規格，請稍候...</span>
          </div>

          <!-- Progress Items -->
          <div class="space-y-2">
            <div
              v-for="(item, idx) in exportItems"
              :key="item.key"
              class="p-3 rounded-lg border transition-all"
              :class="[
                item.status === 'running'
                  ? 'bg-brand-500/10 border-brand-500/40'
                  : item.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : item.status === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-dark-900 border-dark-750 opacity-60'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <!-- Status Icon -->
                  <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                    <i
                      v-if="item.status === 'running'"
                      class="pi pi-spin pi-spinner text-accent text-xs"
                    />
                    <i
                      v-else-if="item.status === 'success'"
                      class="pi pi-check text-ok text-xs font-bold"
                    />
                    <i
                      v-else-if="item.status === 'error'"
                      class="pi pi-times text-danger text-xs font-bold"
                    />
                    <span
                      v-else
                      class="text-xxs font-mono text-dark-500 font-semibold"
                    >
                      {{ idx + 1 }}
                    </span>
                  </div>

                  <div>
                    <div class="font-medium text-dark-200 text-xs flex items-center space-x-2">
                      <span>{{ item.title }}</span>
                      <span
                        v-if="item.status === 'running'"
                        class="text-[10px] text-accent animate-pulse"
                      >
                        查詢中...
                      </span>
                    </div>
                    <div class="text-xxs text-dark-400 font-mono">
                      {{ item.defaultFileName }}
                    </div>
                  </div>
                </div>

                <!-- Right badge / summary -->
                <div class="text-right">
                  <div v-if="item.status === 'success'" class="text-ok font-semibold font-mono text-xs">
                    {{ item.result?.rowCount ?? 0 }} 列
                  </div>
                  <div v-if="item.durationMs" class="text-xxs text-dark-500 font-mono">
                    {{ item.durationMs }} ms
                  </div>
                </div>
              </div>

              <!-- Error Message if failed -->
              <div
                v-if="item.status === 'error'"
                class="mt-2 text-xxs text-danger bg-rose-50 dark:bg-rose-950/40 p-2 rounded border border-rose-200 dark:border-rose-800/50 leading-normal"
              >
                {{ item.errorMessage || '查詢執行失敗' }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Step 3: Save Location Prompt -->
      <template v-else-if="step === 'save_prompt'">
        <div class="space-y-3.5">
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center space-x-2.5">
            <i class="pi pi-check-circle text-ok text-lg flex-shrink-0" />
            <div class="text-xs text-ok">
              <span class="font-semibold">3 項結構查詢已成功擷取！</span>
              <span class="text-xxs text-ok block mt-0.5">
                請選擇儲存位置與存檔方式以匯出 CSV。
              </span>
            </div>
          </div>

          <!-- Result Items Summary Card -->
          <div class="space-y-2">
            <div
              v-for="(item, idx) in exportItems"
              :key="item.key"
              class="p-2.5 bg-dark-900 rounded-lg border border-dark-750 flex items-center justify-between"
            >
              <div class="flex items-center space-x-2.5">
                <span class="w-5 h-5 rounded bg-brand-500/15 text-accent font-mono text-xxs flex items-center justify-center font-bold">
                  {{ idx + 1 }}
                </span>
                <div>
                  <div class="text-xs font-medium text-dark-200">{{ item.title }}</div>
                  <div class="text-xxs font-mono text-dark-400">{{ item.defaultFileName }}</div>
                </div>
              </div>

              <div class="flex items-center space-x-3">
                <div class="text-right">
                  <div class="text-xs font-mono font-semibold text-dark-100">
                    {{ item.result?.rowCount ?? 0 }} 筆記錄
                  </div>
                  <div class="text-xxs text-dark-400 font-mono">
                    {{ formatByteSize(item.fileSizeBytes || 0) }}
                  </div>
                </div>

                <!-- Individual Save Button -->
                <Button
                  type="button"
                  size="small"
                  text
                  severity="secondary"
                  class="!p-1 text-dark-300 hover:text-dark-100"
                  title="個別另存此 CSV 檔案"
                  @click="handleSaveSingle(item)"
                >
                  <i class="pi pi-download text-xs" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Save Options Box -->
          <div class="p-3 bg-dark-850 rounded-lg border border-dark-750 space-y-2.5">
            <div class="text-xs font-semibold text-dark-200 flex items-center space-x-1.5">
              <i class="pi pi-folder-open text-accent" />
              <span>請選擇存檔方式：</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <!-- Choice A: Folder Picker (Recommended) -->
              <button
                type="button"
                @click="handleSaveToDirectory"
                :disabled="isSaving"
                class="flex flex-col items-start p-3 rounded-lg border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-left transition-colors group cursor-pointer"
              >
                <div class="flex items-center space-x-2 text-accent font-semibold text-xs mb-1">
                  <i class="pi pi-folder text-sm text-accent group-hover:scale-110 transition-transform" />
                  <span>選擇資料夾儲存 (推薦)</span>
                </div>
                <div class="text-xxs text-dark-300 leading-normal">
                  一次存入 3 個獨立 CSV 檔案至指定目錄
                </div>
              </button>

              <!-- Choice B: Combined Single CSV -->
              <button
                type="button"
                @click="handleSaveCombined"
                :disabled="isSaving"
                class="flex flex-col items-start p-3 rounded-lg border border-dark-700 bg-dark-900/80 hover:bg-dark-800 text-left transition-colors group cursor-pointer"
              >
                <div class="flex items-center space-x-2 text-dark-200 font-semibold text-xs mb-1">
                  <i class="pi pi-file text-sm text-dark-400 group-hover:scale-110 transition-transform" />
                  <span>合併為單一 CSV 檔案</span>
                </div>
                <div class="text-xxs text-dark-400 leading-normal">
                  包含 3 個區塊規格之單一整合 CSV
                </div>
              </button>
            </div>

            <div class="text-xxs text-dark-400 flex items-center space-x-1 pt-1">
              <i class="pi pi-info-circle text-[11px] text-dark-500" />
              <span>所有 CSV 檔案均自動內嵌 UTF-8 BOM，支援 Microsoft Excel 直接開啟無亂碼。</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Step 4: Completed -->
      <template v-else-if="step === 'completed'">
        <div class="space-y-4 text-center py-2">
          <div class="w-12 h-12 rounded-full bg-emerald-500/20 text-ok flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
            <i class="pi pi-check text-2xl font-bold" />
          </div>

          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-dark-100">資料庫結構 CSV 匯出完成！</h3>
            <p class="text-xs text-dark-300">
              已成功儲存下列檔案：
            </p>
          </div>

          <!-- Saved Files List -->
          <div class="text-left bg-dark-900 p-3 rounded-lg border border-dark-750 space-y-1.5">
            <div
              v-for="file in savedFilesList"
              :key="file.fileName"
              class="flex items-center justify-between text-xs font-mono py-1 px-1.5 rounded hover:bg-dark-800/60"
            >
              <div class="flex items-center space-x-2 text-dark-200 truncate">
                <i class="pi pi-file-excel text-ok text-xs flex-shrink-0" />
                <span class="truncate">{{ file.fileName }}</span>
              </div>
              <span class="text-xxs text-dark-400 flex-shrink-0 ml-2">
                {{ formatByteSize(file.size) }}
              </span>
            </div>

            <div v-if="savedDirectoryName" class="mt-2 pt-2 border-t border-dark-750/70 text-xxs text-dark-400">
              儲存資料夾：<span class="text-dark-200 font-mono font-semibold">{{ savedDirectoryName }}</span>
            </div>
          </div>

          <!-- Comparison Tip Box -->
          <div class="text-left bg-dark-850 p-2.5 rounded border border-dark-750 text-xxs text-dark-300 space-y-1 leading-relaxed">
            <div class="font-semibold text-accent flex items-center space-x-1">
              <i class="pi pi-lightbulb text-warn" />
              <span>結構比對技巧：</span>
            </div>
            <div>
              若要比對兩資料庫，可使用此功能分別匯出兩個資料庫的 CSV，接著透過 <strong>WinMerge</strong>、<strong>Beyond Compare</strong> 或 <strong>VS Code (選取兩檔案右鍵 Compare)</strong> 即可秒速揪出欄位型態、長度或索引差異！
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Modal Footer -->
    <template #footer>
      <div class="flex items-center justify-between w-full pt-2">
        <!-- Left button -->
        <div>
          <Button
            v-if="step === 'confirm'"
            type="button"
            label="取消 (Esc)"
            severity="secondary"
            size="small"
            text
            @click="handleClose"
          />
          <Button
            v-else-if="step === 'save_prompt'"
            type="button"
            label="重新執行查詢"
            icon="pi pi-refresh"
            severity="secondary"
            size="small"
            text
            @click="startExecution"
          />
          <Button
            v-else-if="step === 'completed'"
            type="button"
            label="另存其他位置"
            icon="pi pi-replay"
            severity="secondary"
            size="small"
            text
            @click="step = 'save_prompt'"
          />
        </div>

        <!-- Right button -->
        <div>
          <Button
            v-if="step === 'confirm'"
            type="button"
            label="開始執行匯出"
            icon="pi pi-play"
            severity="warn"
            size="small"
            @click="startExecution"
          />
          <Button
            v-else-if="step === 'running' && hasError"
            type="button"
            label="重試"
            icon="pi pi-refresh"
            severity="warn"
            size="small"
            @click="startExecution"
          />
          <Button
            v-else-if="step === 'completed'"
            type="button"
            label="完成"
            icon="pi pi-check"
            severity="primary"
            size="small"
            @click="handleClose"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { queryService } from '@/services/queryService';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  getTablesAndColumnsSql,
  getIndexesAndKeysSql,
  getProgrammabilityHashSql,
  resultSetToCsv,
  combineResultSetsToCsv,
  saveFilesToDirectory,
  saveSingleCsvWithPicker,
  formatByteSize,
  type SchemaExportItem,
} from '@/utils/schemaExport';

interface Props {
  isOpen: boolean;
  connectionId: string;
  database: string;
  connectionName?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const workspaceStore = useWorkspaceStore();

type Step = 'confirm' | 'running' | 'save_prompt' | 'completed';
const step = ref<Step>('confirm');
const showSqlPreview = ref(false);
const isSaving = ref(false);
const savedDirectoryName = ref<string>('');
const savedFilesList = ref<{ fileName: string; size: number }[]>([]);

const exportItems = reactive<
  (SchemaExportItem & { description: string })[]
>([
  {
    key: 'tables_columns',
    title: '資料表與欄位規格 (Tables & Columns)',
    description: '欄位名稱、資料型態、長度、Precision、Scale、Nullable、Identity、預設值、定序 Collation',
    defaultFileName: '',
    sql: '',
    status: 'pending',
  },
  {
    key: 'indexes',
    title: '索引與鍵值規格 (Indexes & Keys)',
    description: '索引名稱、類型 (Clustered/Non-Clustered)、主鍵 PK、唯一性 Unique、鍵值欄位順序、包含欄位 Included',
    defaultFileName: '',
    sql: '',
    status: 'pending',
  },
  {
    key: 'programmability',
    title: '程式化物件雜湊 (Views / SP / Functions)',
    description: '檢視表、預存程序、函式、觸發程序之物件類型、建立異動時間與 SHA2_256 代碼雜湊值',
    defaultFileName: '',
    sql: '',
    status: 'pending',
  },
]);

const stepTitle = computed(() => {
  switch (step.value) {
    case 'confirm':
      return '(確認執行)';
    case 'running':
      return '(查詢執行中...)';
    case 'save_prompt':
      return '(選擇儲存位置)';
    case 'completed':
      return '(匯出完成)';
  }
});

const hasError = computed(() => exportItems.some((i) => i.status === 'error'));

// Watch isOpen or props to initialize items
watch(
  () => [props.isOpen, props.database],
  ([isOpen]) => {
    if (isOpen) {
      resetState();
    }
  },
  { immediate: true }
);

function resetState() {
  step.value = 'confirm';
  showSqlPreview.value = false;
  isSaving.value = false;
  savedDirectoryName.value = '';
  savedFilesList.value = [];

  const db = props.database || 'Database';
  if (exportItems[0]) {
    exportItems[0].defaultFileName = `${db}_tables_columns.csv`;
    exportItems[0].sql = getTablesAndColumnsSql(props.database);
    exportItems[0].status = 'pending';
    exportItems[0].result = undefined;
    exportItems[0].csvContent = undefined;
    exportItems[0].durationMs = undefined;
    exportItems[0].errorMessage = undefined;
  }

  if (exportItems[1]) {
    exportItems[1].defaultFileName = `${db}_indexes.csv`;
    exportItems[1].sql = getIndexesAndKeysSql(props.database);
    exportItems[1].status = 'pending';
    exportItems[1].result = undefined;
    exportItems[1].csvContent = undefined;
    exportItems[1].durationMs = undefined;
    exportItems[1].errorMessage = undefined;
  }

  if (exportItems[2]) {
    exportItems[2].defaultFileName = `${db}_programmability.csv`;
    exportItems[2].sql = getProgrammabilityHashSql(props.database);
    exportItems[2].status = 'pending';
    exportItems[2].result = undefined;
    exportItems[2].csvContent = undefined;
    exportItems[2].durationMs = undefined;
    exportItems[2].errorMessage = undefined;
  }
}

function handleClose() {
  if (step.value === 'running') return;
  emit('close');
}

/**
 * Runs the 3 queries sequentially and prepares CSV contents
 */
async function startExecution() {
  step.value = 'running';

  for (const item of exportItems) {
    item.status = 'running';
    item.errorMessage = undefined;
    const startTime = Date.now();

    try {
      const res = await queryService.executeQuery(
        props.connectionId,
        props.database,
        item.sql
      );

      const rs = res.resultSets[0] || { columns: [], rows: [], rowCount: 0 };
      item.result = rs;
      item.durationMs = Date.now() - startTime;
      item.csvContent = resultSetToCsv(rs.columns, rs.rows);
      item.fileSizeBytes = new Blob([item.csvContent]).size;
      item.status = 'success';
    } catch (err: unknown) {
      item.durationMs = Date.now() - startTime;
      item.status = 'error';
      item.errorMessage = err instanceof Error ? err.message : String(err);
      workspaceStore.showToast(`執行查詢失敗: ${item.title}`, 'error', 3000);
      return; // Stop on error so user can inspect or retry
    }
  }

  // All 3 completed successfully
  step.value = 'save_prompt';
}

/**
 * Saves all 3 files to a selected folder via Directory Picker (with fallback)
 */
async function handleSaveToDirectory() {
  if (isSaving.value) return;
  isSaving.value = true;

  try {
    // 1. Try modern showDirectoryPicker
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });

        const filesToSave = exportItems.map((item) => ({
          fileName: item.defaultFileName,
          content: item.csvContent || '',
        }));

        const saved = await saveFilesToDirectory(dirHandle, filesToSave);
        savedDirectoryName.value = (dirHandle as any).name || '已選取資料夾';
        savedFilesList.value = saved;
        step.value = 'completed';
        workspaceStore.showToast(`已成功儲存 3 個結構 CSV 檔案！`, 'success', 2500);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled folder picker dialog
          return;
        }
        console.warn('showDirectoryPicker failed, falling back to sequential save:', err);
      }
    }

    // 2. Fallback: prompt to save combined or sequential download
    const combinedName = `${props.database}_schema_complete.csv`;
    const combinedCsv = combineResultSetsToCsv(
      exportItems.map((item) => ({
        title: item.title,
        columns: item.result?.columns || [],
        rows: item.result?.rows || [],
      }))
    );

    const res = await saveSingleCsvWithPicker(combinedCsv, combinedName);
    if (res.saved) {
      savedDirectoryName.value = '';
      savedFilesList.value = [
        {
          fileName: res.fileName || combinedName,
          size: new Blob([combinedCsv]).size,
        },
      ];
      step.value = 'completed';
      workspaceStore.showToast(`已成功儲存合併結構 CSV！`, 'success', 2500);
    }
  } catch (err) {
    console.error('Save to directory failed:', err);
    workspaceStore.showToast(`存檔失敗: ${String(err)}`, 'error', 3000);
  } finally {
    isSaving.value = false;
  }
}

/**
 * Saves combined single CSV
 */
async function handleSaveCombined() {
  if (isSaving.value) return;
  isSaving.value = true;

  try {
    const combinedName = `${props.database}_schema_full.csv`;
    const combinedCsv = combineResultSetsToCsv(
      exportItems.map((item) => ({
        title: item.title,
        columns: item.result?.columns || [],
        rows: item.result?.rows || [],
      }))
    );

    const res = await saveSingleCsvWithPicker(combinedCsv, combinedName);
    if (res.saved) {
      savedDirectoryName.value = '';
      savedFilesList.value = [
        {
          fileName: res.fileName || combinedName,
          size: new Blob([combinedCsv]).size,
        },
      ];
      step.value = 'completed';
      workspaceStore.showToast(`已成功儲存合併結構 CSV！`, 'success', 2500);
    }
  } catch (err) {
    console.error('Save combined CSV failed:', err);
    workspaceStore.showToast(`存檔失敗: ${String(err)}`, 'error', 3000);
  } finally {
    isSaving.value = false;
  }
}

/**
 * Saves an individual item CSV
 */
async function handleSaveSingle(item: SchemaExportItem) {
  if (!item.csvContent) return;

  try {
    const res = await saveSingleCsvWithPicker(item.csvContent, item.defaultFileName);
    if (res.saved) {
      workspaceStore.showToast(`已儲存「${res.fileName || item.defaultFileName}」`, 'success', 2000);
    }
  } catch (err) {
    console.error('Save single CSV failed:', err);
    workspaceStore.showToast(`存檔失敗: ${String(err)}`, 'error', 3000);
  }
}
</script>
