import type { AiChatMessage, AiProviderConfig, AiChatCompletionResponse } from '@/types/ai';
import { parseCurlCommand } from './curlParser';

export class CurlAiService {
  /**
   * 發送對話訊息：
   * 1. 拆解使用者設定的 curl 範本
   * 2. 替換 <token> 為 apiKey
   * 3. 根據對話歷程多輪追加或替換 messages
   * 4. 送出 fetch 請求並相容解析回傳結果
   */
  async sendMessage(
    messages: AiChatMessage[],
    config: AiProviderConfig,
    signal?: AbortSignal
  ): Promise<AiChatCompletionResponse> {
    const rawTemplate = config.curlTemplate?.trim();
    if (!rawTemplate) {
      throw new Error('請先在 [設定 -> AI 設定] 中貼上有效的 cURL 請求範本。');
    }

    const parsed = parseCurlCommand(rawTemplate);
    if (!parsed.url) {
      throw new Error('無法從 cURL 範本中解析出有效的 API 網址 (--url)。');
    }

    // 1. 處理 Headers 並替換 <token>
    const apiKey = config.apiKey?.trim() || '';
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.headers)) {
      headers[k] = v.replace(/<token>/gi, apiKey);
    }

    // 如果沒有 Content-Type 則預設為 application/json
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    // 2. 處理 Body (Data JSON)
    let payloadObj: any = {};
    if (parsed.dataRaw) {
      try {
        // 先嘗試將 <token> 替換（若出現在 data 中）
        const replacedData = parsed.dataRaw.replace(/<token>/gi, apiKey);
        payloadObj = JSON.parse(replacedData);
      } catch (err) {
        throw new Error(`cURL 範本中的 JSON 資料格式有誤: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 3. 多輪追加 messages 邏輯
    // 保留 template 中的其他欄位 (如 model, thinking, max_completion_tokens 等)
    // 依據傳入的 messages 歷程格式化
    const formattedMessages = messages.map((m, idx) => {
      let content = m.content;
      // 若有附帶 SQL 且為首則使用者訊息，組裝 SQL 脈絡
      if (m.role === 'user' && m.sqlContext && idx === 0) {
        content = `【參考 SQL 語法】：\n\`\`\`sql\n${m.sqlContext}\n\`\`\`\n\n【使用者問題】：\n${m.content}`;
      }
      return {
        role: m.role,
        content,
      };
    });

    if (Array.isArray(payloadObj.messages) || (!payloadObj.contents && !payloadObj.prompt)) {
      payloadObj.messages = formattedMessages;
    } else if (payloadObj.contents !== undefined) {
      payloadObj.contents = formattedMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
    } else if (payloadObj.prompt !== undefined) {
      payloadObj.prompt = formattedMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    }

    // 4. 發送 HTTP 請求 (URL 支援替換 <token>)
    const targetUrl = parsed.url.replace(/<token>/gi, apiKey);
    const response = await fetch(targetUrl, {
      method: parsed.method || 'POST',
      headers,
      body: JSON.stringify(payloadObj),
      signal,
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson?.error?.message || errorJson?.message || JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(`AI API 呼叫失敗 [${response.status}]: ${errorDetail || response.statusText}`);
    }

    const data = await response.json();

    // 5. 智能解析回傳內容
    // 優先順序:
    // a. OpenAI 格式: choices[0].message.content
    // b. Anthropic 格式: content[0].text
    // c. Google Gemini 格式: candidates[0].content.parts[0].text
    // d. Thinking / 推理格式: reasoning_content
    // e. 備用純字串: reply / text / response
    let assistantMessage = '';
    const choice = Array.isArray(data.choices) ? data.choices[0] : undefined;
    if (choice?.message?.content) {
      assistantMessage = choice.message.content;
    } else if (choice?.text) {
      assistantMessage = choice.text;
    } else if (Array.isArray(data.content) && data.content[0]?.text) {
      assistantMessage = data.content[0].text;
    } else if (Array.isArray(data.candidates) && data.candidates[0]?.content?.parts?.[0]?.text) {
      assistantMessage = data.candidates[0].content.parts[0].text;
    } else if (choice?.message?.reasoning_content) {
      assistantMessage = choice.message.reasoning_content;
    } else if (typeof data.reply === 'string') {
      assistantMessage = data.reply;
    } else if (typeof data.response === 'string') {
      assistantMessage = data.response;
    } else {
      assistantMessage = JSON.stringify(data, null, 2);
    }

    const totalTokens = data.usage?.total_tokens || data.usage?.output_tokens;

    return {
      content: assistantMessage,
      tokensUsed: totalTokens,
      raw: data,
    };
  }

  /**
   * 測試 API 連線
   */
  async testConnection(
    config: AiProviderConfig
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
          message: `連線成功！回應: "${result.content.trim().slice(0, 40)}" (耗時 ${latencyMs}ms)`,
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

export const curlAiService = new CurlAiService();
