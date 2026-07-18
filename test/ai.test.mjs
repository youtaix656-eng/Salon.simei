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

test('buildClientConsultPrompt: 施術情報のみを含み個人情報は含めない', async () => {
  const { buildClientConsultPrompt } = await import('../src/lib/ai.js');
  const client = {
    id: 'c1',
    name: '佐藤 美咲',
    kana: 'さとう みさき',
    birthday: '08-02',
    pressure: 'つよめ',
    focusAreas: '肩甲骨まわり',
    likes: '愛犬の話',
    ngTopics: '仕事の話',
  };
  const visits = [
    { clientId: 'c1', date: '2026-07-01', menu: 'ボディ60', minutes: 60, notes: '張り強め', talk: '犬の誕生日' },
    { clientId: 'c1', date: '2026-06-01', menu: 'ボディ90', minutes: 90, notes: '', talk: '' },
    { clientId: 'c2', date: '2026-07-02', menu: '別人の施術', minutes: 60 },
  ];
  const prompt = buildClientConsultPrompt(client, visits, { intervalDays: 30 });
  // 施術に関する情報は含む
  assert.ok(prompt.includes('つよめ'));
  assert.ok(prompt.includes('肩甲骨まわり'));
  assert.ok(prompt.includes('来店回数：2回'));
  assert.ok(prompt.includes('約30日'));
  assert.ok(prompt.includes('ボディ60'));
  assert.ok(prompt.includes('張り強め'));
  // 個人情報・無関係な情報は含まない
  assert.ok(!prompt.includes('佐藤'));
  assert.ok(!prompt.includes('さとう'));
  assert.ok(!prompt.includes('08-02'));
  assert.ok(!prompt.includes('愛犬'));
  assert.ok(!prompt.includes('仕事の話'));
  assert.ok(!prompt.includes('犬の誕生日'));
  assert.ok(!prompt.includes('別人の施術'));
});
