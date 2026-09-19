<template>
  <Dialog
    :visible="isOpen"
    modal
    :closable="true"
    :dismissable-mask="true"
    class="w-full max-w-lg font-sans"
    @update:visible="val => !val && $emit('cancel')"
  >
    <template #header>
      <div class="flex items-center space-x-2">
        <i
          v-if="step === 2"
          class="pi pi-shield text-rose-400 text-lg animate-pulse"
        />
        <i v-else class="pi pi-exclamation-triangle text-amber-400 text-lg" />
        <span class="font-semibold text-sm text-dark-100">
          {{ step === 2 ? '高危險變更確認 (第二次確認 2/2 — 最終確認)' : '修改提示 — 偵測到變更指令 (第一次確認 1/2)' }}
        </span>
      </div>
    </template>

    <!-- Modal Body -->
    <div class="space-y-4 text-xs py-1">
      <!-- Target Environment & Database Info -->
      <div class="flex items-center space-x-2 text-xxs font-mono bg-dark-900 p-2 rounded border border-dark-750">
        <div class="flex items-center space-x-1 text-dark-300">
          <span class="text-dark-500">連線:</span>
          <span class="font-semibold text-dark-100">{{ connectionName }}</span>
        </div>
        <span class="text-dark-600">/</span>
        <div class="flex items-center space-x-1 text-dark-300">
          <span class="text-dark-500">資料庫:</span>
          <span class="font-semibold text-dark-100">{{ databaseName }}</span>
        </div>
      </div>

      <!-- Step 1 Content -->
      <template v-if="step === 1">
        <!-- Detected Keywords List -->
        <div class="space-y-1.5">
          <div class="text-dark-300 flex items-center justify-between">
            <span>偵測到即將執行的修改/變更指令：</span>
            <span class="text-xxs text-dark-500 font-mono">{{ detectedKeywords.length }} 種關鍵字</span>
          </div>
          <div class="flex items-center flex-wrap gap-1.5">
            <Tag
              v-for="kw in detectedKeywords"
              :key="kw"
              severity="warn"
              :value="kw"
              class="font-mono font-bold"
            />
          </div>
        </div>

        <!-- SQL Code Preview -->
        <div class="space-y-1">
          <div class="text-dark-400 text-xxs flex items-center space-x-1">
            <i class="pi pi-code text-dark-400" />
            <span>即將執行的 SQL 片段預覽：</span>
          </div>
          <pre class="bg-dark-950 p-2.5 rounded border border-dark-800 font-mono text-xxs text-dark-200 overflow-auto max-h-32 whitespace-pre-wrap select-text leading-relaxed">{{ sql }}</pre>
        </div>

        <!-- Prompt description -->
        <p class="text-dark-300 leading-relaxed bg-amber-950/20 border border-amber-900/40 p-2.5 rounded text-xxs">
          連線「<strong>{{ connectionName }}</strong>」已開啟「修改提示」保護機制。<br />
          為避免改錯或刪除正式資料，系統要求必須<strong>連續確認 2 次</strong>才可執行。請確認是否要進行第二次確認？
        </p>
      </template>

      <!-- Step 2 Content -->
      <template v-else>
        <!-- Dangerous Alert Box -->
        <div class="bg-rose-950/40 border border-rose-600/60 p-3.5 rounded-lg space-y-2 text-rose-200 leading-relaxed">
          <div class="flex items-center space-x-2 text-rose-300 font-bold text-xs">
            <i class="pi pi-ban text-rose-400 text-base flex-shrink-0" />
            <span>注意：此操作將直接更動目標資料庫！</span>
          </div>
          <p class="text-xxs text-rose-200/90 leading-relaxed">
            即將對目標伺服器 <strong>{{ connectionName }}</strong> 的 <strong>{{ databaseName }}</strong> 資料庫執行包含
            <strong class="text-white">{{ detectedKeywords.join('、') }}</strong> 的變更操作。<br />
            資料修改或結構刪除後<strong>可能無法復原或復原成本極高</strong>。
          </p>
        </div>

        <div class="text-center py-1">
          <span class="text-xs font-semibold text-dark-100">
            請再次審慎確認：是否確定要立即執行此 SQL？
          </span>
        </div>
      </template>
    </div>

    <!-- Modal Footer -->
    <template #footer>
      <div class="flex items-center justify-between w-full pt-2">
        <Button
          type="button"
          :label="step === 2 ? '放棄執行 (Esc)' : '取消 (Esc)'"
          severity="secondary"
          size="small"
          text
          @click="$emit('cancel')"
        />

        <Button
          v-if="step === 1"
          type="button"
          label="繼續確認 (1/2)"
          icon="pi pi-arrow-right"
          iconPos="right"
          severity="warn"
          size="small"
          @click="$emit('proceed')"
        />

        <Button
          v-else
          type="button"
          label="確定立即執行 (Execute)"
          icon="pi pi-exclamation-triangle"
          severity="danger"
          size="small"
          @click="$emit('proceed')"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';

defineProps<{
  isOpen: boolean;
  step: 1 | 2;
  connectionName: string;
  databaseName: string;
  detectedKeywords: string[];
  sql: string;
}>();

defineEmits<{
  (e: 'proceed'): void;
  (e: 'cancel'): void;
}>();
</script>
