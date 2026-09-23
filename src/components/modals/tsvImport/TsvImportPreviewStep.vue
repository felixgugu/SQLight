<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
      <!-- Summary -->
      <section class="rounded-lg border border-dark-700 bg-dark-900/60 p-3">
        <div class="text-xxs font-semibold text-dark-300 tracking-wide mb-2">匯入摘要</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div class="text-xxs text-dark-400">目標表格</div>
            <div class="font-mono text-dark-100 truncate">
              {{ store.target?.schema }}.{{ store.target?.table }}
            </div>
            <div class="text-xxs text-dark-500 font-mono truncate">
              {{ store.target?.database }}
            </div>
          </div>
          <div>
            <div class="text-xxs text-dark-400">資料來源</div>
            <div class="text-dark-100 truncate">{{ store.sourceLabel }}</div>
          </div>
          <div>
            <div class="text-xxs text-dark-400">預計匯入</div>
            <div class="text-dark-100 font-mono">
              {{ validRowsText }} 筆 · {{ store.importColumns.length }} 欄
            </div>
          </div>
          <div>
            <div class="text-xxs text-dark-400">設定</div>
            <div class="text-dark-200">
              {{ store.skipHeader ? '略過首行' : '不略過首行' }} ·
              {{ store.manualIdentity ? '手動識別值' : '自動識別值' }}
            </div>
          </div>
        </div>
      </section>

      <!-- Identity warning (non blocking: the database reports the error) -->
      <div
        v-if="store.identityInsertWarning"
        class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xxs text-warn"
      >
        {{ store.identityInsertWarning }}
      </div>

      <!-- Validation failures -->
      <section
        v-if="store.validation && store.validation.errors.length > 0"
        class="rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/25 p-3 space-y-2"
      >
        <div class="flex items-center justify-between">
          <div class="text-xxs font-semibold text-danger">
            驗證失敗，請修正後重新驗證
          </div>
          <div class="text-xxs text-danger font-mono">
            總筆數 {{ store.validation.totalRows.toLocaleString() }} · 有效
            {{ store.validation.validRows.toLocaleString() }} · 異常
            {{ store.validation.invalidRows.toLocaleString() }}
          </div>
        </div>
        <div class="overflow-x-auto max-h-72 rounded border border-rose-200 dark:border-rose-900/50">
          <table class="w-full text-xxs">
            <thead class="bg-rose-100 dark:bg-rose-950/60 text-danger sticky top-0">
              <tr>
                <th class="text-left px-3 py-1.5 font-medium w-20">行數</th>
                <th class="text-left px-3 py-1.5 font-medium w-24">欄位位置</th>
                <th class="text-left px-3 py-1.5 font-medium w-40">欄位</th>
                <th class="text-left px-3 py-1.5 font-medium">原始值</th>
                <th class="text-left px-3 py-1.5 font-medium w-56">錯誤原因</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr v-for="(error, idx) in displayedErrors" :key="idx" class="border-t border-rose-200 dark:border-rose-900/30">
                <td class="px-3 py-1.5 text-danger">{{ error.line }}</td>
                <td class="px-3 py-1.5 text-danger">
                  {{ error.columnPosition || '-' }}
                </td>
                <td class="px-3 py-1.5 text-danger truncate">{{ error.column }}</td>
                <td class="px-3 py-1.5 text-danger/90 truncate max-w-[280px]">
                  {{ error.rawValue === NULL_SENTINEL ? 'NULL' : error.rawValue }}
                </td>
                <td class="px-3 py-1.5 font-sans text-danger">
                  {{ error.reason }}：{{ error.detail }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="hiddenErrorCount > 0" class="text-xxs text-danger">
          僅顯示前 {{ MAX_DISPLAYED_ERRORS }} 筆，其餘 {{ hiddenErrorCount.toLocaleString() }} 筆異常未列出
        </div>
      </section>

      <!-- Preview -->
      <section
        v-else-if="store.validation"
        class="rounded-lg border border-dark-700 bg-dark-900/60 overflow-hidden"
      >
        <div class="px-3 py-2 border-b border-dark-750 flex items-center justify-between">
          <div class="text-xxs font-semibold text-dark-300 tracking-wide">
            資料預覽（前 {{ store.validation.preview.length }} 筆 / 共
            {{ store.validation.totalRows.toLocaleString() }} 筆）
          </div>
          <div class="text-xxs text-dark-500">驗證通過，尚未寫入資料庫</div>
        </div>
        <div class="overflow-auto max-h-72">
          <table class="text-xxs font-mono">
            <thead class="bg-dark-850 text-dark-400 sticky top-0">
              <tr>
                <th class="text-left px-2 py-1.5 font-medium border-r border-dark-750">行</th>
                <th
                  v-for="column in store.importColumns"
                  :key="column.name"
                  class="text-left px-2 py-1.5 font-medium border-r border-dark-750 whitespace-nowrap"
                  :title="`${column.name} (${column.fullType})`"
                >
                  {{ column.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in store.validation.preview" :key="row.line" class="border-t border-dark-800">
                <td class="px-2 py-1 text-dark-500 border-r border-dark-800">{{ row.line }}</td>
                <td
                  v-for="(cell, idx) in row.cells"
                  :key="idx"
                  class="px-2 py-1 border-r border-dark-800 max-w-[220px] truncate"
                  :class="cell === NULL_SENTINEL ? 'text-dark-500 italic' : 'text-dark-100'"
                >
                  {{ cell === NULL_SENTINEL ? 'NULL' : cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Import progress -->
      <section
        v-if="store.isImporting"
        class="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2"
      >
        <div class="flex items-center justify-between text-xxs text-ok">
          <span class="flex items-center space-x-1.5">
            <i class="pi pi-spin pi-spinner text-[10px]"></i>
            <span>匯入中，請勿關閉視窗（單一交易，失敗將全部回滾）</span>
          </span>
          <span class="font-mono">
            {{ store.importProgress.processedRows.toLocaleString() }} /
            {{ store.importProgress.totalRows.toLocaleString() }}
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-dark-800 overflow-hidden">
          <div
            class="h-full bg-emerald-500 transition-all duration-150"
            :style="{ width: `${store.importProgressPercent}%` }"
          ></div>
        </div>
      </section>

      <!-- Import result -->
      <section
        v-if="store.importResult"
        class="rounded-lg border p-3 space-y-2"
        :class="
          store.importResult.rolledBack
            ? 'border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/25'
            : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20'
        "
      >
        <template v-if="!store.importResult.rolledBack">
          <div class="text-xs text-ok">
            已成功新增
            <strong class="font-mono">{{ store.importResult.insertedCount.toLocaleString() }}</strong>
            筆資料（耗時 {{ store.importResult.executionTimeMs }} ms），表格資料已重新載入。
          </div>
        </template>
        <template v-else>
          <div class="text-xs text-danger">
            匯入失敗：本次未寫入任何資料（已全部回滾）。資料庫回報
            {{ store.importResult.errors.length.toLocaleString() }} 筆錯誤。
          </div>
          <div class="overflow-x-auto max-h-56 rounded border border-rose-200 dark:border-rose-900/50">
            <table class="w-full text-xxs">
              <thead class="bg-rose-100 dark:bg-rose-950/60 text-danger sticky top-0">
                <tr>
                  <th class="text-left px-3 py-1.5 font-medium w-20">行數</th>
                  <th class="text-left px-3 py-1.5 font-medium w-40">欄位</th>
                  <th class="text-left px-3 py-1.5 font-medium">資料庫訊息</th>
                </tr>
              </thead>
              <tbody class="font-mono">
                <tr
                  v-for="(error, idx) in store.importResult.errors.slice(0, MAX_DISPLAYED_ERRORS)"
                  :key="idx"
                  class="border-t border-rose-200 dark:border-rose-900/30"
                >
                  <td class="px-3 py-1.5 text-danger">{{ error.line || '-' }}</td>
                  <td class="px-3 py-1.5 text-danger">{{ error.column || '-' }}</td>
                  <td class="px-3 py-1.5 text-danger/90">{{ error.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <div
        v-if="store.importError"
        class="rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/25 p-3 text-xxs text-danger font-mono break-all"
      >
        {{ store.importError }}
      </div>
    </div>

    <!-- Footer -->
    <div class="h-12 px-4 border-t border-dark-750 bg-dark-850 flex items-center justify-between flex-shrink-0">
      <div class="text-xxs text-dark-500">
        <span v-if="store.hasBlockingErrors">有驗證錯誤時無法匯入，請返回修正資料</span>
        <span v-else-if="!store.importResult">匯入採新增模式，重複主鍵不會覆寫既有資料</span>
      </div>
      <div class="flex items-center space-x-2">
        <Button
          type="button"
          label="上一步"
          icon="pi pi-arrow-left"
          size="small"
          severity="secondary"
          text
          :disabled="store.isImporting"
          class="!text-xs"
          @click="emit('back')"
        />
        <Button
          type="button"
          label="取消"
          size="small"
          severity="secondary"
          text
          :disabled="store.isImporting"
          class="!text-xs"
          @click="emit('cancel')"
        />
        <Button
          v-if="!store.importResult || store.importResult.rolledBack"
          type="button"
          :label="store.isImporting ? '匯入中…' : '開始匯入'"
          icon="pi pi-database"
          size="small"
          :loading="store.isImporting"
          :disabled="!store.canImport"
          v-tooltip.top="store.hasBlockingErrors ? '請先修正驗證錯誤' : ''"
          class="!text-xs"
          @click="store.startImport()"
        />
        <Button
          v-else
          type="button"
          label="關閉"
          icon="pi pi-check"
          size="small"
          severity="success"
          class="!text-xs"
          @click="emit('cancel')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import { MAX_DISPLAYED_ERRORS, NULL_SENTINEL } from '@/utils/tsvImport';
import { useTsvImportStore } from '@/stores/tsvImportStore';

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'cancel'): void;
}>();

const store = useTsvImportStore();

const displayedErrors = computed(() =>
  (store.validation?.errors ?? []).slice(0, MAX_DISPLAYED_ERRORS)
);
const hiddenErrorCount = computed(() =>
  Math.max(0, (store.validation?.errors.length ?? 0) - MAX_DISPLAYED_ERRORS)
);
const validRowsText = computed(() => {
  const validation = store.validation;
  if (!validation) return '0';
  return (validation.errors.length > 0 ? validation.validRows : validation.totalRows).toLocaleString();
});
</script>
