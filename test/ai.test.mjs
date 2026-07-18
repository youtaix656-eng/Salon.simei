import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDERS,
  resolveModel,
  buildSystemPrompt,
  buildGeminiRequest,
  parseGeminiResponse,
  buildClaudeParams,
  extractClaudeText,
} from '../src/lib/ai.js';

test('resolveModel: 未指定ならプロバイダの標準モデル', () => {
  assert.equal(resolveModel({ provider: 'gemini' }), PROVIDERS.gemini.defaultModel);
  assert.equal(resolveModel({ provider: 'claude' }), PROVIDERS.claude.defaultModel);
  assert.equal(resolveModel({ provider: 'claude', model: ' my-model ' }), 'my-model');
  assert.equal(resolveModel(undefined), PROVIDERS.gemini.defaultModel);
});

test('buildSystemPrompt: セラピスト名を差し込む', () => {
  assert.ok(buildSystemPrompt({ therapistName: '山田' }).includes('山田さん'));
  assert.ok(buildSystemPrompt({}).includes('セラピスト'));
});

test('buildGeminiRequest: URL・ロール変換・システム指示', () => {
  const req = buildGeminiRequest('gemini-2.5-flash', 'KEY', 'SYSTEM', [
    { role: 'user', text: '質問1' },
    { role: 'assistant', text: '回答1' },
    { role: 'user', text: '質問2' },
  ]);
  assert.ok(req.url.includes('/models/gemini-2.5-flash:generateContent'));
  assert.equal(req.headers['x-goog-api-key'], 'KEY');
  assert.equal(req.body.systemInstruction.parts[0].text, 'SYSTEM');
  assert.deepEqual(
    req.body.contents.map((c) => c.role),
    ['user', 'model', 'user']
  );
  assert.equal(req.body.contents[2].parts[0].text, '質問2');
});

test('parseGeminiResponse: テキストを連結して返す', () => {
  const data = {
    candidates: [
      { content: { parts: [{ text: 'こんにちは' }, { text: '世界' }] } },
    ],
  };
  assert.equal(parseGeminiResponse(data), 'こんにちは世界');
});

test('parseGeminiResponse: 空・ブロック時は例外', () => {
  assert.throws(() => parseGeminiResponse({}), /回答を取得できません/);
  assert.throws(
    () => parseGeminiResponse({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }),
    /SAFETY/
  );
});

test('buildClaudeParams: メッセージ形式とモデル', () => {
  const params = buildClaudeParams('claude-opus-4-8', 'SYSTEM', [
    { role: 'user', text: '質問' },
    { role: 'assistant', text: '回答' },
    { role: 'user', text: '追加の質問' },
  ]);
  assert.equal(params.model, 'claude-opus-4-8');
  assert.equal(params.system, 'SYSTEM');
  assert.ok(params.max_tokens >= 1024);
  assert.deepEqual(
    params.messages.map((m) => m.role),
    ['user', 'assistant', 'user']
  );
  assert.equal(params.messages[0].content, '質問');
});

test('extractClaudeText: textブロックだけを連結', () => {
  const message = {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'こんにちは' },
      { type: 'text', text: '追伸' },
    ],
  };
  assert.equal(extractClaudeText(message), 'こんにちは\n追伸');
});

test('extractClaudeText: refusal は例外', () => {
  assert.throws(
    () => extractClaudeText({ stop_reason: 'refusal', content: [] }),
    /回答できません/
  );
});
