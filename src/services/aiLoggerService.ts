import { invokeCommand } from './api';

export interface AiLoggerService {
  logAiRequest(endpoint: string, content: string, method?: string): Promise<void>;
  logAiResponse(
    endpoint: string,
    content: string,
    status?: number,
    durationMs?: number,
    isError?: boolean
  ): Promise<void>;
  openAiLogFile(): Promise<string>;
  getAiLogPath(): Promise<string>;
  clearAiLog(): Promise<string>;
}

export const aiLoggerService: AiLoggerService = {
  /**
   * 記錄 AI API 發送的請求內容至 ai.log
   */
  async logAiRequest(endpoint: string, content: string, method = 'POST'): Promise<void> {
    return invokeCommand<void>('log_ai_request', {
      endpoint,
      method,
      content,
    });
  },

  /**
   * 記錄 AI API 接收的回應內容至 ai.log
   */
  async logAiResponse(
    endpoint: string,
    content: string,
    status?: number,
    durationMs?: number,
    isError = false
  ): Promise<void> {
    return invokeCommand<void>('log_ai_response', {
      endpoint,
      content,
      status,
      durationMs,
      isError,
    });
  },

  /**
   * 使用作業系統預設檢視器開啟 ai.log
   */
  async openAiLogFile(): Promise<string> {
    return invokeCommand<string>('open_ai_log_file');
  },

  /**
   * 取得 ai.log 的絕對實體路徑
   */
  async getAiLogPath(): Promise<string> {
    return invokeCommand<string>('get_ai_log_path');
  },

  /**
   * 清空 ai.log 並重新寫入工作階段標頭
   */
  async clearAiLog(): Promise<string> {
    return invokeCommand<string>('clear_ai_log');
  },
};
