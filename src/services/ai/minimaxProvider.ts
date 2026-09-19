import { BaseOpenAiCompatibleProvider } from './baseOpenAiProvider';
import type { AiProviderType, AiModelOption } from '@/types/ai';

export class MiniMaxProvider extends BaseOpenAiCompatibleProvider {
  readonly id: AiProviderType = 'minimax';
  readonly name = 'MiniMax (Token Plan)';
  readonly defaultEndpoint = 'https://api.minimax.chat/v1';
  readonly defaultModel = 'MiniMax-Text-01';

  readonly availableModels: AiModelOption[] = [
    {
      id: 'MiniMax-Text-01',
      name: 'MiniMax-Text-01 (旗艦推薦)',
      description: '具備強大的推理與程式碼分析能力，適合複雜 T-SQL 與執行計畫最佳化',
    },
    {
      id: 'abab6.5s-chat',
      name: 'abab6.5s-chat (高性價比)',
      description: '極速回應，適合即時語法解說與快速改寫',
    },
    {
      id: 'abab6.5-chat',
      name: 'abab6.5-chat',
      description: '通用型大型模型',
    },
  ];
}

export class CustomOpenAiProvider extends BaseOpenAiCompatibleProvider {
  readonly id: AiProviderType = 'openai';
  readonly name = 'OpenAI 相容 (自訂端點)';
  readonly defaultEndpoint = 'https://api.openai.com/v1';
  readonly defaultModel = 'gpt-4o-mini';

  readonly availableModels: AiModelOption[] = [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI 旗艦多模態旗艦模型' },
    { id: 'gpt-4o-mini', name: 'GPT-4o-mini', description: '輕量高效率模型' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', description: '高智慧高性價比程式碼模型' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', description: '深度思考推理模型' },
  ];
}
