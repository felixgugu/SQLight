import type {
  AiProvider,
  AiProviderType,
  AiChatMessage,
  AiModelOption,
  AiChatCompletionResponse,
} from '@/types/ai';

export abstract class BaseOpenAiCompatibleProvider implements AiProvider {
  abstract readonly id: AiProviderType;
  abstract readonly name: string;
  abstract readonly defaultEndpoint: string;
  abstract readonly defaultModel: string;
  abstract readonly availableModels: AiModelOption[];

  /**
   * 格式化 Endpoint 網址，確保正確以 /v1/chat/completions 結尾
   */
  protected formatEndpoint(endpoint: string): string {
    let clean = endpoint.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/chat/completions')) {
      clean = `${clean}/chat/completions`;
    }
    return clean;
  }

  /**
   * 發送對話訊息到 OpenAI 相容之 Chat Completions 端點
   */
  async sendMessage(
    messages: AiChatMessage[],
    config: any,
    signal?: AbortSignal
  ): Promise<AiChatCompletionResponse> {
    const targetEndpoint = this.formatEndpoint(config.endpoint || this.defaultEndpoint);
    const targetModel = config.model || this.defaultModel;

    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error(`請先在 [設定 -> AI 設定] 中填入 ${this.name} 的 API Key。`);
    }

    // 格式化 OpenAI 規範之 messages
    const formattedMessages = messages.map((m) => {
      let content = m.content;
      // 如果有 SQL Context 且為使用者首則訊息，注入脈絡
      if (m.role === 'user' && m.sqlContext) {
        content = `【參考 SQL 語法】：\n\`\`\`sql\n${m.sqlContext}\n\`\`\`\n\n【使用者問題】：\n${m.content}`;
      }
      return {
        role: m.role,
        content,
      };
    });

    const payload = {
      model: targetModel,
      messages: formattedMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
    };

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson?.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`AI API 呼叫失敗 [${response.status}]: ${errorDetail || response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content ?? '';
    const totalTokens = data.usage?.total_tokens;

    return {
      content: assistantMessage,
      tokensUsed: totalTokens,
      raw: data,
    };
  }

  /**
   * 測試 API 連線並測量延遲
   */
  async testConnection(
    config: any
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const startTime = performance.now();
    try {
      const pingMessage: AiChatMessage = {
        id: 'test-ping',
        role: 'user',
        content: 'Hi, please reply with "OK".',
        timestamp: Date.now(),
      };
      const result = await this.sendMessage([pingMessage], config);
      const latencyMs = Math.round(performance.now() - startTime);

      if (result.content) {
        return {
          success: true,
          message: `連線成功！回應: "${result.content.trim().slice(0, 30)}" (耗時 ${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: '連線回傳了空內容',
        latencyMs,
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: errorMsg,
        latencyMs,
      };
    }
  }
}
