<template>
  <div class="space-y-5">
    <!-- 提示卡片 -->
    <div
      class="p-3.5 rounded-lg border flex items-start space-x-3 text-xs"
      :style="{
        backgroundColor: 'var(--p-surface-ground)',
        borderColor: 'var(--p-surface-border)',
      }"
    >
      <i class="pi pi-sparkles text-base mt-0.5 text-purple-400" />
      <div class="space-y-1">
        <div class="font-semibold text-dark-100">AI SQL 助手自訂請求設定 (通用 cURL 範本)</div>
        <p class="text-surface-400 leading-relaxed text-xxs">
          您可以直接貼上任何 AI 廠商提供的標準 <code>curl</code> 請求範本。系統會自動替換 <code>&lt;token&gt;</code> 為您的 API Key，並在送出時將 <code>&lt;content&gt;</code> 自動替換與多輪追加至 <code>messages</code> 陣列中。
        </p>
      </div>
    </div>

    <!-- 1. API Key 設定 -->
    <div class="space-y-2 pb-4 border-b border-dark-800">
      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium text-dark-100 block">API Key (Token) *</label>
          <span class="text-xxs text-dark-400">系統會自動將 cURL 中的 &lt;token&gt; 替換為此處填寫的金鑰</span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <div class="relative flex-1">
          <InputText
            v-model="aiChatStore.config.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="請輸入 API Key (如 sk-...)"
            class="w-full !text-xs !bg-dark-900 !border-dark-750 font-mono pr-8"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 text-xs"
            @click="showApiKey = !showApiKey"
          >
            <i :class="showApiKey ? 'pi pi-eye-slash' : 'pi pi-eye'" />
          </button>
        </div>
        <Button
          label="測試連線 (Test)"
          icon="pi pi-bolt"
          severity="primary"
          size="small"
          class="!text-xs !py-1.5 flex-shrink-0"
          :loading="isTesting"
          :disabled="!aiChatStore.config.apiKey.trim() || isTesting"
          @click="handleTestConnection"
        />
      </div>

      <!-- 測試結果反饋 -->
      <div
        v-if="testResult"
        class="mt-2 p-2.5 rounded text-xs flex items-center space-x-2"
        :class="testResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'"
      >
        <i :class="testResult.success ? 'pi pi-check-circle text-emerald-400' : 'pi pi-exclamation-triangle text-rose-400'" />
        <span class="flex-1 font-mono text-[11px]">{{ testResult.message }}</span>
      </div>
    </div>

    <!-- 2. cURL 請求初始內容 (Textarea) -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium text-dark-100 block">cURL 請求範本 (Request Template) *</label>
          <span class="text-xxs text-dark-400">支援貼上完整的 curl 命令；系統會保留自訂參數並維持多輪問答追加</span>
        </div>
        <Button
          label="還原預設範本"
          severity="secondary"
          text
          size="small"
          class="!text-xxs !p-0 hover:text-dark-100"
          @click="aiChatStore.resetCurlTemplate()"
        />
      </div>

      <Textarea
        v-model="aiChatStore.config.curlTemplate"
        rows="13"
        placeholder="請貼上完整的 curl 指令..."
        class="w-full !text-[11px] font-mono !bg-dark-900 !border-dark-750 !p-3 leading-relaxed !resize-y"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import { useAiChatStore } from '@/stores/aiChatStore';
import { curlAiService } from '@/services/ai/curlAiService';

const aiChatStore = useAiChatStore();

const showApiKey = ref(false);
const isTesting = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

async function handleTestConnection() {
  isTesting.value = true;
  testResult.value = null;
  try {
    const res = await curlAiService.testConnection(aiChatStore.config);
    testResult.value = res;
  } catch (err: unknown) {
    testResult.value = {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    isTesting.value = false;
  }
}
</script>
