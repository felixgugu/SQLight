<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
      <!-- Target table -->
      <section class="rounded-lg border border-dark-700 bg-dark-900/60 p-3">
        <div class="flex items-center justify-between">
          <div class="text-xxs font-semibold text-dark-300 tracking-wide">目標表格</div>
          <span v-if="store.isLoadingMetadata" class="text-xxs text-dark-400 flex items-center space-x-1">
            <i class="pi pi-spin pi-spinner text-[10px]"></i>
            <span>讀取欄位定義中…</span>
          </span>
        </div>
        <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span v-if="store.target?.connectionName" class="text-dark-300">
            {{ store.target.connectionName }}
          </span>
          <span class="text-dark-500">/</span>
          <span class="text-dark-200">{{ store.target?.database }}</span>
          <span class="text-dark-500">/</span>
          <span class="text-emerald-300">
            {{ store.target?.schema }}.{{ store.target?.table }}
          </span>
        </div>
        <div v-if="store.metadataError" class="mt-2 text-xxs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded px-2 py-1.5">
          {{ store.metadataError }}
        </div>
      </section>

      <!-- Data source -->
      <section class="rounded-lg border border-dark-700 bg-dark-900/60 p-3 space-y-3">
        <div class="text-xxs font-semibold text-dark-300 tracking-wide">資料來源</div>

        <div class="flex items-center space-x-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md border text-xs transition-colors"
            :class="
              store.sourceMode === 'file'
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                : 'border-dark-700 bg-dark-800 text-dark-300 hover:text-dark-100'
            "
            @click="store.setSourceMode('file')"
          >
            上傳檔案
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md border text-xs transition-colors"
            :class="
              store.sourceMode === 'paste'
                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                : 'border-dark-700 bg-dark-800 text-dark-300 hover:text-dark-100'
            "
            @click="store.setSourceMode('paste')"
          >
            貼上文字
          </button>
        </div>

        <!-- File picker -->
        <div v-if="store.sourceMode === 'file'" class="space-y-2">
          <div class="flex items-center space-x-2">
            <Button
              type="button"
              label="選擇 .tsv 檔案"
              icon="pi pi-upload"
              size="small"
              severity="secondary"
              outlined
              class="!text-xxs"
              @click="pickFile"
            />
            <span v-if="store.fileName" class="text-xs font-mono text-dark-200 truncate">
              {{ store.fileName }}
            </span>
            <span v-else class="text-xxs text-dark-500">支援 UTF-8 編碼的 .tsv（上限 20 MB）</span>
          </div>
        </div>

        <!-- Paste textarea -->
        <textarea
          v-else
          :value="store.pastedText"
          rows="9"
          spellcheck="false"
          placeholder="貼上以 Tab 分隔欄位的文字（支援 Windows 與 Unix 換行；\N 表示 NULL，非文字欄位亦可填 NULL）"
          class="w-full bg-dark-900 border border-dark-700 rounded-md p-2 text-xs font-mono text-dark-100 focus:outline-none focus:border-emerald-500/60 resize-none"
          @input="handlePasteInput"
        ></textarea>

        <div class="text-xxs text-dark-400 font-mono">
          目前大小：{{ formatBytes(sourceBytes) }} / 20 MB
        </div>

        <div v-if="localError" class="text-xxs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded px-2 py-1.5">
          {{ localError }}
        </div>
      </section>

      <!-- Options -->
      <section class="rounded-lg border border-dark-700 bg-dark-900/60 p-3 space-y-2">
        <div class="text-xxs font-semibold text-dark-300 tracking-wide">匯入設定</div>

        <label class="flex items-center space-x-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            class="accent-emerald-500"
            :checked="store.skipHeader"
            @change="store.setSkipHeader(($event.target as HTMLInputElement).checked)"
          />
          <span>略過首行（視為標題，不匯入；欄位仍依下方順序對應）</span>
        </label>

        <label
          class="flex items-center space-x-2 text-xs select-none"
          :class="store.manualIdentityAvailable ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'"
          :title="store.manualIdentityDisabledReason || ''"
        >
          <input
            type="checkbox"
            class="accent-emerald-500"
            :checked="store.manualIdentity"
            :disabled="!store.manualIdentityAvailable"
            @change="store.setManualIdentity(($event.target as HTMLInputElement).checked)"
          />
          <span>允許手動指定識別值 (SET IDENTITY_INSERT)</span>
        </label>

        <div class="text-xxs text-dark-400 pl-6">
          <template v-if="store.manualIdentityAvailable">
            勾選後匯入會先執行 SET IDENTITY_INSERT ON，讓 TSV 的識別值寫入
            <span v-if="store.identityColumnName" class="font-mono text-dark-200">
              （{{ store.identityColumnName }}）
            </span>
            ；未勾選時識別值仍會送出，資料庫將拒絕並回報錯誤
          </template>
          <template v-else>無法使用：{{ store.manualIdentityDisabledReason }}</template>
        </div>

        <div
          v-if="store.identityInsertWarning"
          class="text-xxs text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded px-2 py-1.5"
        >
          {{ store.identityInsertWarning }}
        </div>
      </section>

      <!-- Expected columns -->
      <section class="rounded-lg border border-dark-700 bg-dark-900/60 overflow-hidden">
        <div class="px-3 py-2 border-b border-dark-750 flex items-center justify-between">
          <div class="text-xxs font-semibold text-dark-300 tracking-wide">
            預期匯入欄位（{{ store.importColumns.length }} 欄，依此順序對應）
          </div>
          <div class="text-xxs text-dark-500">自動產生且不可寫入的欄位不列入</div>
        </div>
        <div class="max-h-56 overflow-y-auto">
          <table class="w-full text-xxs">
            <thead class="bg-dark-850 text-dark-400 sticky top-0">
              <tr>
                <th class="text-left px-3 py-1.5 font-medium">#</th>
                <th class="text-left px-3 py-1.5 font-medium">欄位</th>
                <th class="text-left px-3 py-1.5 font-medium">型別</th>
                <th class="text-left px-3 py-1.5 font-medium">必填</th>
                <th class="text-left px-3 py-1.5 font-medium">備註</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr
                v-for="(column, idx) in store.importColumns"
                :key="column.name"
                class="border-t border-dark-800"
              >
                <td class="px-3 py-1.5 text-dark-500">{{ idx + 1 }}</td>
                <td class="px-3 py-1.5 text-dark-100">{{ column.name }}</td>
                <td class="px-3 py-1.5 text-dark-300">{{ column.fullType }}</td>
                <td class="px-3 py-1.5" :class="column.nullable ? 'text-dark-400' : 'text-amber-300'">
                  {{ column.nullable ? '可為 NULL' : 'NOT NULL' }}
                </td>
                <td class="px-3 py-1.5 text-dark-400 font-sans">
                  <span v-if="column.isPrimaryKey" class="text-sky-300">PK</span>
                  <span v-if="column.isPrimaryKey && column.isIdentity"> · </span>
                  <span v-if="column.isIdentity" class="text-amber-300">
                    Identity（未勾選允許手動指定時由資料庫回報錯誤）
                  </span>
                  <span v-if="!column.isPrimaryKey && !column.isIdentity">—</span>
                </td>
              </tr>
              <tr v-if="store.importColumns.length === 0">
                <td colspan="5" class="px-3 py-3 text-center text-dark-500 font-sans">
                  沒有可匯入的欄位
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Footer -->
    <div class="h-12 px-4 border-t border-dark-750 bg-dark-850 flex items-center justify-end space-x-2 flex-shrink-0">
      <Button
        type="button"
        label="取消"
        size="small"
        severity="secondary"
        text
        class="!text-xs"
        @click="emit('cancel')"
      />
      <Button
        type="button"
        :label="store.isValidating ? '驗證中…' : '下一步'"
        icon="pi pi-arrow-right"
        icon-pos="right"
        size="small"
        :loading="store.isValidating"
        :disabled="!store.canValidate || store.isValidating"
        v-tooltip.top="store.canValidate ? '' : '請先提供資料來源與可匯入的資料列'"
        class="!text-xs"
        @click="emit('next')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import { checkUtf8File, openTsvFile } from '@/utils/fileStorage';
import { countUtf8Bytes, MAX_SOURCE_BYTES } from '@/utils/tsvImport';
import { useTsvImportStore } from '@/stores/tsvImportStore';

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'next'): void;
}>();

const store = useTsvImportStore();
const localError = ref('');

const sourceBytes = computed(() => countUtf8Bytes(store.sourceText));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function pickFile() {
  localError.value = '';
  const result = await openTsvFile();
  if (!result.opened || !result.fileName || result.content === undefined) return;

  const problem = checkUtf8File(result.content);
  if (problem) {
    localError.value = problem;
    return;
  }
  if (countUtf8Bytes(result.content) > MAX_SOURCE_BYTES) {
    localError.value = '檔案超過 20 MB 上限，請先分批切割';
    return;
  }
  store.setFile(result.fileName, result.content);
}

function handlePasteInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  localError.value = '';
  if (countUtf8Bytes(value) > MAX_SOURCE_BYTES) {
    localError.value = '貼上內容超過 20 MB 上限，請先分批切割';
    return;
  }
  store.setPastedText(value);
}
</script>
