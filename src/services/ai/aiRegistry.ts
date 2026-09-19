import type { AiProvider, AiProviderType } from '@/types/ai';
import { MiniMaxProvider, CustomOpenAiProvider } from './minimaxProvider';

class AiRegistry {
  private providers: Map<AiProviderType, AiProvider> = new Map();

  constructor() {
    this.register(new MiniMaxProvider());
    this.register(new CustomOpenAiProvider());
  }

  register(provider: AiProvider) {
    this.providers.set(provider.id, provider);
  }

  get(id: AiProviderType): AiProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      // 預設降級至 MiniMax
      return this.providers.get('minimax')!;
    }
    return provider;
  }

  getAll(): AiProvider[] {
    return Array.from(this.providers.values());
  }
}

export const aiRegistry = new AiRegistry();
