import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { AiChatMessage, AiProviderConfig } from '@/types/ai';
import { DEFAULT_CURL_TEMPLATE } from '@/types/ai';
import { curlAiService } from '@/services/ai/curlAiService';

const STORAGE_KEY_AI_CONFIG = 'sqlight_ai_config_v2';
const STORAGE_KEY_AI_MESSAGES = 'sqlight_ai_messages';

const DEFAULT_AI_CONFIG: AiProviderConfig = {
  apiKey: '',
  curlTemplate: DEFAULT_CURL_TEMPLATE,
};

function loadStoredConfig(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_CONFIG);
    if (raw) {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load AI config from localStorage:', e);
  }
  return { ...DEFAULT_AI_CONFIG };
}

function loadStoredMessages(): AiChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AI_MESSAGES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to load AI messages from localStorage:', e);
  }
  return [];
}

export const useAiChatStore = defineStore('aiChat', () => {
  // 對話設定與狀態
  const config = ref<AiProviderConfig>(loadStoredConfig());
  const messages = ref<AiChatMessage[]>(loadStoredMessages());

  // 視窗開啟與縮小化狀態
  const isChatOpen = ref<boolean>(false);
  const isMinimized = ref<boolean>(false);

  // 當前附帶的 SQL 上下文
  const currentSql = ref<string>('');
  const isSelectionOnly = ref<boolean>(false);

  // 運作執行中狀態
  const isGenerating = ref<boolean>(false);
  const executionElapsedSeconds = ref<number>(0);
  const currentAbortController = ref<AbortController | null>(null);
  let timerInterval: any = null;

  // 持久化儲存
  watch(
    config,
    (val) => {
      try {
        localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(val));
      } catch (e) {
        console.warn('Failed to save AI config to localStorage:', e);
      }
    },
    { deep: true }
  );

  watch(
    messages,
    (val) => {
      try {
        const truncated = val.slice(-50);
        localStorage.setItem(STORAGE_KEY_AI_MESSAGES, JSON.stringify(truncated));
      } catch (e) {
        console.warn('Failed to save AI messages to localStorage:', e);
      }
    },
    { deep: true }
  );

  function openChat(sqlText = '', isSelection = false) {
    if (sqlText && sqlText.trim()) {
      currentSql.value = sqlText;
      isSelectionOnly.value = isSelection;
    }
    isChatOpen.value = true;
    isMinimized.value = false;
  }

  function closeChat() {
    isChatOpen.value = false;
    isMinimized.value = false;
  }

  function toggleMinimize() {
    isMinimized.value = !isMinimized.value;
  }

  function restoreWindow() {
    isMinimized.value = false;
    isChatOpen.value = true;
  }

  function clearSqlContext() {
    currentSql.value = '';
    isSelectionOnly.value = false;
  }

  function clearHistory() {
    messages.value = [];
  }

  function resetCurlTemplate() {
    config.value.curlTemplate = DEFAULT_CURL_TEMPLATE;
  }

  /**
   * 送出提問 (多輪對話追加機制)
   */
  async function askQuestion(question: string): Promise<void> {
    if (!question.trim() || isGenerating.value) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `asst-${Date.now()}`;

    const userMsg: AiChatMessage = {
      id: userMessageId,
      role: 'user',
      content: question.trim(),
      sqlContext: currentSql.value ? currentSql.value : undefined,
      timestamp: Date.now(),
    };

    messages.value.push(userMsg);

    isGenerating.value = true;
    executionElapsedSeconds.value = 0;
    timerInterval = setInterval(() => {
      executionElapsedSeconds.value += 1;
    }, 1000);

    const abortController = new AbortController();
    currentAbortController.value = abortController;

    const assistantMsg: AiChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    try {
      // 送出全部已累積的對話歷程 (支援多輪上下文追加)
      const response = await curlAiService.sendMessage(
        messages.value,
        config.value,
        abortController.signal
      );

      assistantMsg.content = response.content;
      assistantMsg.tokensUsed = response.tokensUsed;
      messages.value.push(assistantMsg);
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        assistantMsg.content = '*(已取消此次 AI 請求)*';
        assistantMsg.isError = true;
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        assistantMsg.content = `⚠️ **AI 回應發生錯誤**：\n${errorMsg}`;
        assistantMsg.isError = true;
      }
      messages.value.push(assistantMsg);
    } finally {
      if (timerInterval) clearInterval(timerInterval);
      isGenerating.value = false;
      currentAbortController.value = null;
    }
  }

  function cancelGeneration() {
    if (currentAbortController.value) {
      currentAbortController.value.abort();
    }
  }

  return {
    config,
    messages,
    isChatOpen,
    isMinimized,
    currentSql,
    isSelectionOnly,
    isGenerating,
    executionElapsedSeconds,
    openChat,
    closeChat,
    toggleMinimize,
    restoreWindow,
    clearSqlContext,
    clearHistory,
    resetCurlTemplate,
    askQuestion,
    cancelGeneration,
  };
});
