import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, buildMessageVars, DEFAULT_TEMPLATES } from '../src/lib/messages.js';

test('renderTemplate: プレースホルダを差し込む', () => {
  const out = renderTemplate('{name}様、{therapist}です。', {
    name: '佐藤',
    therapist: '山田',
  });
  assert.equal(out, '佐藤様、山田です。');
});

test('renderTemplate: 未知のキーはそのまま残す', () => {
  assert.equal(renderTemplate('{name}様 {unknown}', { name: '佐藤' }), '佐藤様 {unknown}');
});

test('renderTemplate: 同じキーを複数回差し込める', () => {
  assert.equal(renderTemplate('{name}様、{name}様', { name: 'A' }), 'A様、A様');
});

test('buildMessageVars: 最終来店から変数を組み立てる', () => {
  const client = { id: 'c1', name: '佐藤 美咲' };
  const visits = [
    { clientId: 'c1', date: '2026-07-01', menu: 'ボディケア60分' },
    { clientId: 'c1', date: '2026-06-01', menu: 'ヘッドスパ45分' },
    { clientId: 'c2', date: '2026-07-15', menu: '別のお客様' },
  ];
  const vars = buildMessageVars(client, visits, { therapistName: '山田' }, '2026-07-17');
  assert.equal(vars.name, '佐藤 美咲');
  assert.equal(vars.therapist, '山田');
  assert.equal(vars.days, '16');
  assert.equal(vars.menu, 'ボディケア60分');
  assert.equal(vars.lastDate, '2026-07-01');
});

test('buildMessageVars: 来店履歴がなくても壊れない', () => {
  const vars = buildMessageVars({ id: 'c1', name: '佐藤' }, [], {}, '2026-07-17');
  assert.equal(vars.days, '－');
  assert.equal(vars.menu, '前回の施術');
  assert.equal(vars.therapist, '担当セラピスト');
});

test('DEFAULT_TEMPLATES: すべて差し込み後に未解決の変数が残らない', () => {
  const vars = {
    name: '佐藤',
    therapist: '山田',
    days: '30',
    menu: 'ボディケア60分',
    lastDate: '2026-06-17',
  };
  for (const t of DEFAULT_TEMPLATES) {
    const out = renderTemplate(t.body, vars);
    assert.ok(!/\{[A-Za-z_]+\}/.test(out), `${t.id} に未解決の変数が残っています`);
  }
});
