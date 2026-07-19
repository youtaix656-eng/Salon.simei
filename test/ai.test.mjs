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

test('buildReviewReplyPrompt: 口コミと条件を含む', async () => {
  const { buildReviewReplyPrompt } = await import('../src/lib/ai.js');
  const prompt = buildReviewReplyPrompt('とても良かったです！', { therapistName: '山田' }, { extra: 'カジュアルに' });
  assert.ok(prompt.includes('とても良かったです！'));
  assert.ok(prompt.includes('山田'));
  assert.ok(prompt.includes('謝罪'));       // 悪い口コミへの条件も常に含む
  assert.ok(prompt.includes('カジュアルに'));
  // 要望なしでも壊れない
  const p2 = buildReviewReplyPrompt('残念でした', {});
  assert.ok(p2.includes('担当セラピスト'));
  assert.ok(!p2.includes('追加の要望'));
});

test('buildScriptRephrasePrompt: シーン・セリフ・要望を含む', async () => {
  const { buildScriptRephrasePrompt } = await import('../src/lib/ai.js');
  const prompt = buildScriptRephrasePrompt(
    { scene: 'クロージング', title: '次回予約のパス', lines: 'ご予約されますか？', point: 'パスを渡す' },
    'カジュアルに',
    { therapistName: '山田' }
  );
  assert.ok(prompt.includes('クロージング'));
  assert.ok(prompt.includes('ご予約されますか？'));
  assert.ok(prompt.includes('カジュアルに'));
  assert.ok(prompt.includes('山田'));
  // 要望が空でも既定の指示が入る
  const prompt2 = buildScriptRephrasePrompt({ scene: 'お出迎え', title: 't', lines: 'l', point: '' }, '', {});
  assert.ok(prompt2.includes('自分の言葉として自然に話せるように'));
});

test('buildScriptImportPrompt: シーン一覧と貼り付けテキストを含む', async () => {
  const { buildScriptImportPrompt } = await import('../src/lib/ai.js');
  const prompt = buildScriptImportPrompt('予約提案のコツ…');
  assert.ok(prompt.includes('お出迎え'));
  assert.ok(prompt.includes('クロージング'));
  assert.ok(prompt.includes('予約提案のコツ…'));
  assert.ok(prompt.includes('JSON'));
});

test('parseScriptImportResponse: コードフェンスや前置きが混ざっても読み取れる', async () => {
  const { parseScriptImportResponse } = await import('../src/lib/ai.js');
  const answer = [
    '整理しました。',
    '```json',
    '[{"scene":"クロージング","title":"理由つき提案","lines":"◯週間後がベストです","point":"丸投げしない"},',
    ' {"scene":"変なシーン","title":"","lines":"セリフのみ"},',
    ' {"scene":"施術中","title":"空", "lines":""}]',
    '```',
  ].join('\n');
  const scripts = parseScriptImportResponse(answer);
  assert.equal(scripts.length, 2); // lines が空のものは除外
  assert.equal(scripts[0].scene, 'クロージング');
  assert.equal(scripts[1].scene, 'こんな時'); // 不明なシーンはフォールバック
  assert.equal(scripts[1].title, '無題');
});

test('parseScriptImportResponse: 読み取れない場合は例外を投げる', async () => {
  const { parseScriptImportResponse } = await import('../src/lib/ai.js');
  assert.throws(() => parseScriptImportResponse('すみません、わかりませんでした'), /読み取れません/);
  assert.throws(() => parseScriptImportResponse('[]'), /見つかりません/);
  assert.throws(() => parseScriptImportResponse('[破損したJSON]'), /読み取れません/);
});
