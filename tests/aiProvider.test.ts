import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiRegistry } from '../src/services/ai/aiRegistry.ts';
import { MiniMaxProvider, CustomOpenAiProvider } from '../src/services/ai/minimaxProvider.ts';

describe('AI Provider Architecture & Registry', () => {
  it('should have MiniMax and OpenAI providers registered by default', () => {
    const providers = aiRegistry.getAll();
    assert.equal(providers.length >= 2, true);

    const minimax = aiRegistry.get('minimax');
    assert.equal(minimax.id, 'minimax');
    assert.equal(minimax.name, 'MiniMax (Token Plan)');
    assert.equal(minimax.defaultEndpoint, 'https://api.minimax.chat/v1');
    assert.equal(minimax.defaultModel, 'MiniMax-Text-01');

    const openai = aiRegistry.get('openai');
    assert.equal(openai.id, 'openai');
    assert.equal(openai.defaultEndpoint, 'https://api.openai.com/v1');
  });

  it('should provide available model options for MiniMax', () => {
    const minimax = new MiniMaxProvider();
    assert.equal(minimax.availableModels.length >= 2, true);
    const modelIds = minimax.availableModels.map((m) => m.id);
    assert.equal(modelIds.includes('MiniMax-Text-01'), true);
    assert.equal(modelIds.includes('abab6.5s-chat'), true);
  });

  it('should fall back to minimax provider when unknown provider is requested', () => {
    const fallback = aiRegistry.get('unknown' as any);
    assert.equal(fallback.id, 'minimax');
  });

  it('should format endpoint correctly without trailing slashes', () => {
    const provider = new MiniMaxProvider();
    // Use prototype access to verify formatEndpoint logic
    const formatFn = (provider as any).formatEndpoint.bind(provider);
    assert.equal(formatFn('https://api.minimax.chat/v1/'), 'https://api.minimax.chat/v1/chat/completions');
    assert.equal(formatFn('https://api.minimax.chat/v1'), 'https://api.minimax.chat/v1/chat/completions');
    assert.equal(formatFn('https://api.minimax.chat/v1/chat/completions'), 'https://api.minimax.chat/v1/chat/completions');
  });

  it('should reject when API key is missing', async () => {
    const provider = new MiniMaxProvider();
    await assert.rejects(
      async () => {
        await provider.sendMessage(
          [{ id: '1', role: 'user', content: 'hello', timestamp: Date.now() }],
          {
            providerId: 'minimax',
            apiKey: '',
            endpoint: 'https://api.minimax.chat/v1',
            model: 'MiniMax-Text-01',
          }
        );
      },
      /請先在/
    );
  });
});
