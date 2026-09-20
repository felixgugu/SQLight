export interface AiChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  sqlContext?: string;
  timestamp: number;
  tokensUsed?: number;
  isError?: boolean;
}

export interface AiProviderConfig {
  apiKey: string;
  curlTemplate: string;
}

export interface AiChatCompletionResponse {
  content: string;
  tokensUsed?: number;
  raw?: unknown;
}

export const DEFAULT_CURL_TEMPLATE = `curl --request POST \\
  --url https://api.minimax.io/v1/chat/completions \\
  --header 'Authorization: Bearer <token>' \\
  --header 'Content-Type: application/json' \\
  --data '
{
  "model": "MiniMax-M3",
  "messages": [
    {
      "role": "user",
      "content": "<content>"
    }
  ],
  "thinking": {
    "type": "adaptive"
  },
  "max_completion_tokens": 1000
}'`;

export interface AiQuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export const DEFAULT_QUICK_PROMPTS: AiQuickPrompt[] = [
  {
    id: 'opt-optimize',
    label: '查詢最佳化',
    prompt: '請針對附加的 SQL 語法進行效能診斷，指出潛在的效能瓶頸，並提供最佳化後的改寫建議與索引規劃。',
  },
  {
    id: 'opt-explain',
    label: '語法邏輯解釋',
    prompt: '請逐步詳細解釋這段 SQL 的執行邏輯、關聯條件 (JOIN) 與各條件的預期結果。',
  },
  {
    id: 'opt-risk',
    label: '效能與死鎖風險',
    prompt: '這段 SQL 在高併發交易下是否存在鎖定 (Locking)、死鎖 (Deadlock) 或隱式型別轉換 (Implicit Conversion) 的風險？',
  },
  {
    id: 'opt-refactor',
    label: '改寫相容語法',
    prompt: '請將這段語法改寫為標準、嚴謹且效能最佳的 T-SQL 寫法。',
  },
];

// 相容型別 (供舊模組或擴充實作引用)
export type AiProviderType = 'minimax' | 'openai' | 'custom';
export interface AiModelOption {
  id: string;
  name: string;
  description?: string;
}
export interface AiProvider {
  readonly id: AiProviderType;
  readonly name: string;
  readonly defaultEndpoint: string;
  readonly defaultModel: string;
  readonly availableModels: AiModelOption[];
  sendMessage(messages: AiChatMessage[], config: any, signal?: AbortSignal): Promise<AiChatCompletionResponse>;
  testConnection(config: any): Promise<{ success: boolean; message: string; latencyMs: number }>;
}
