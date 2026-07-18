import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState,
  makeBackup,
  parseBackup,
  emptyState,
} from '../src/lib/storage.js';

test('normalizeState: 空・不正入力は空の状態を返す', () => {
  assert.deepEqual(normalizeState(null).clients, []);
  assert.deepEqual(normalizeState('junk').visits, []);
  assert.ok(normalizeState(undefined).settings.templates.length > 0);
});

test('normalizeState: 名前のないお客様と孤立した来店記録を除外する', () => {
  const state = normalizeState({
    clients: [{ id: 'a', name: '佐藤' }, { id: 'b' }, null],
    visits: [
      { id: 'v1', clientId: 'a', date: '2026-07-01', nominated: 1 },
      { id: 'v2', clientId: 'ghost', date: '2026-07-02' }, // 存在しないお客様
      { id: 'v3', clientId: 'a', date: 'いつか' }, // 不正な日付
    ],
  });
  assert.equal(state.clients.length, 1);
  assert.equal(state.visits.length, 1);
  assert.equal(state.visits[0].id, 'v1');
  assert.equal(state.visits[0].nominated, true);
});

test('normalizeState: 来店記録を日付昇順に並べる', () => {
  const state = normalizeState({
    clients: [{ id: 'a', name: '佐藤' }],
    visits: [
      { id: 'v2', clientId: 'a', date: '2026-07-10' },
      { id: 'v1', clientId: 'a', date: '2026-06-01' },
    ],
  });
  assert.deepEqual(state.visits.map((v) => v.id), ['v1', 'v2']);
});

test('makeBackup → parseBackup で往復できる', () => {
  const original = normalizeState({
    clients: [{ id: 'a', name: '佐藤', kana: 'さとう' }],
    visits: [{ id: 'v1', clientId: 'a', date: '2026-07-01', menu: 'ボディ60', nominated: true }],
    settings: { therapistName: '山田', monthlyGoal: 12 },
  });
  const restored = parseBackup(makeBackup(original));
  assert.deepEqual(restored, original);
});

test('parseBackup: 壊れたファイルは例外を投げる', () => {
  assert.throws(() => parseBackup('not json'), /JSON/);
  assert.throws(() => parseBackup('{"foo": 1}'), /バックアップ/);
  assert.throws(() => parseBackup('123'), /バックアップ/);
});

test('parseBackup: data 直接形式（clients/visits のみ）も受け付ける', () => {
  const restored = parseBackup(
    JSON.stringify({
      clients: [{ id: 'a', name: '佐藤' }],
      visits: [],
    })
  );
  assert.equal(restored.clients.length, 1);
});

test('emptyState: 設定の初期値を持つ', () => {
  const s = emptyState();
  assert.equal(typeof s.settings.monthlyGoal, 'number');
  assert.ok(Array.isArray(s.settings.templates));
  assert.ok(s.settings.templates.length >= 3);
});
