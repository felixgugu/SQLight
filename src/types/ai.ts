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
