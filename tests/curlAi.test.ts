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
});
