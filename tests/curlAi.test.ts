import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCurlCommand } from '../src/services/ai/curlParser.ts';
import { curlAiService } from '../src/services/ai/curlAiService.ts';
import { DEFAULT_CURL_TEMPLATE } from '../src/types/ai.ts';

describe('Curl Parser & AI Engine', () => {
  it('should parse standard curl command correctly', () => {
    const raw = `curl --request POST \\
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

    const parsed = parseCurlCommand(raw);
    assert.equal(parsed.url, 'https://api.minimax.io/v1/chat/completions');
    assert.equal(parsed.method, 'POST');
    assert.equal(parsed.headers['Authorization'], 'Bearer <token>');
    assert.equal(parsed.headers['Content-Type'], 'application/json');
    assert.equal(parsed.dataRaw.includes('"model": "MiniMax-M3"'), true);
  });

  it('should parse curl with -X and -H syntax and double quotes', () => {
    const raw = `curl -X POST "https://api.openai.com/v1/chat/completions" -H "Authorization: Bearer sk-12345" -H "Content-Type: application/json" -d '{"model":"gpt-4o"}'`;
    const parsed = parseCurlCommand(raw);
    assert.equal(parsed.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(parsed.method, 'POST');
    assert.equal(parsed.headers['Authorization'], 'Bearer sk-12345');
    assert.equal(parsed.dataRaw, '{"model":"gpt-4o"}');
  });

  it('should parse DEFAULT_CURL_TEMPLATE and produce valid JSON with no Unterminated string errors', () => {
    const parsed = parseCurlCommand(DEFAULT_CURL_TEMPLATE);
    assert.equal(parsed.url, 'https://api.minimax.io/v1/chat/completions');
    assert.ok(parsed.dataRaw.length > 0);
    // Must be directly parseable as JSON without syntax error
    const json = JSON.parse(parsed.dataRaw);
    assert.equal(json.model, 'MiniMax-M3');
    assert.equal(json.messages[0].content, '<content>');
  });

  it('should gracefully parse curl with unclosed trailing quote (common copy-paste truncation)', () => {
    const rawNoClosingQuote = `curl --request POST 
  --url https://api.minimax.io/v1/chat/completions 
  --header 'Authorization: Bearer <token>' 
  --header 'Content-Type: application/json' 
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
}`;
    const parsed = parseCurlCommand(rawNoClosingQuote);
    assert.equal(parsed.url, 'https://api.minimax.io/v1/chat/completions');
    assert.ok(parsed.dataRaw.length > 0);
    const json = JSON.parse(parsed.dataRaw);
    assert.equal(json.model, 'MiniMax-M3');
    assert.equal(json.messages[0].role, 'user');
  });

  it('should fail testConnection gracefully on invalid URL or missing key', async () => {
    const res = await curlAiService.testConnection({
      apiKey: '',
      curlTemplate: DEFAULT_CURL_TEMPLATE,
    });
    // Should return failure without crashing
    assert.equal(typeof res.latencyMs, 'number');
    assert.equal(res.success, false);
  });

  it('should call aiLoggerService to log request content when sending AI message', async () => {
    const { aiLoggerService } = await import('../src/services/aiLoggerService.ts');
    assert.ok(typeof aiLoggerService.logAiRequest === 'function');
    assert.ok(typeof aiLoggerService.logAiResponse === 'function');
    assert.ok(typeof aiLoggerService.openAiLogFile === 'function');
    assert.ok(typeof aiLoggerService.getAiLogPath === 'function');

    const logPath = await aiLoggerService.getAiLogPath();
    assert.equal(logPath.endsWith('ai.log'), true);

    const openedPath = await aiLoggerService.openAiLogFile();
    assert.equal(openedPath.endsWith('ai.log'), true);

    // Verify logging a request does not throw
    await assert.doesNotReject(async () => {
      await aiLoggerService.logAiRequest(
        'https://api.openai.com/v1/chat/completions',
        JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'test' }] })
      );
    });

    // Verify logging a response does not throw
    await assert.doesNotReject(async () => {
      await aiLoggerService.logAiResponse(
        'https://api.openai.com/v1/chat/completions',
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'response test' } }] }),
        200,
        150,
        false
      );
    });
  });

  it('should have default quick prompts without icons and support CRUD operations in store', async () => {
    const { DEFAULT_QUICK_PROMPTS } = await import('../src/types/ai.ts');
    assert.equal(DEFAULT_QUICK_PROMPTS.length, 4);

    // Option labels should not contain emojis/icons
    for (const prompt of DEFAULT_QUICK_PROMPTS) {
      assert.ok(prompt.label.length > 0);
      assert.ok(prompt.prompt.length > 0);
      // Emojis regex check: ensure labels are clean Chinese text without emoji prefixes
      assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(prompt.label), false);
    }

    const { setActivePinia, createPinia } = await import('pinia');
    setActivePinia(createPinia());
    const { useAiChatStore } = await import('../src/stores/aiChatStore.ts');
    const store = useAiChatStore();

    // 1. Add a custom prompt
    store.addQuickPrompt('自訂提示詞', '請幫我重構此 SQL');
    assert.equal(store.quickPrompts.length, 5);
    const added = store.quickPrompts.find((p) => p.label === '自訂提示詞');
    assert.ok(added);
    assert.equal(added.prompt, '請幫我重構此 SQL');

    // 2. Update prompt
    store.updateQuickPrompt(added.id, '已更新提示詞', '更新後的內容');
    const updated = store.quickPrompts.find((p) => p.id === added.id);
    assert.equal(updated?.label, '已更新提示詞');
    assert.equal(updated?.prompt, '更新後的內容');

    // 3. Delete prompt
    store.deleteQuickPrompt(added.id);
    assert.equal(store.quickPrompts.some((p) => p.id === added.id), false);

    // 4. Reset to defaults
    store.resetQuickPrompts();
    assert.equal(store.quickPrompts.length, 4);
    assert.equal(store.quickPrompts[0]?.label, '查詢最佳化');
  });
});


