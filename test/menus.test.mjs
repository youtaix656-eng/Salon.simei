import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMenusByCategory, menuLabel } from '../src/lib/menus.js';
import { normalizeState } from '../src/lib/storage.js';

test('groupMenusByCategory: 登録順を保ってカテゴリごとにまとめる', () => {
  const groups = groupMenusByCategory([
    { id: 'm1', category: 'ボディケア', name: 'ボディ60' },
    { id: 'm2', category: 'アロマ', name: 'アロマ60' },
    { id: 'm3', category: 'ボディケア', name: 'ボディ40' },
  ]);
  assert.deepEqual(groups.map((g) => g.category), ['ボディケア', 'アロマ']);
  assert.deepEqual(groups[0].items.map((m) => m.id), ['m1', 'm3']);
});

test('groupMenusByCategory: 「その他」は最後に回す', () => {
  const groups = groupMenusByCategory([
    { id: 'm1', category: 'その他', name: '延長10分' },
    { id: 'm2', category: 'ボディケア', name: 'ボディ60' },
    { id: 'm3', category: 'アロマ', name: 'アロマ60' },
  ]);
  assert.deepEqual(groups.map((g) => g.category), ['ボディケア', 'アロマ', 'その他']);
});

test('groupMenusByCategory: 空配列は空を返す', () => {
  assert.deepEqual(groupMenusByCategory([]), []);
  assert.deepEqual(groupMenusByCategory(), []);
});

test('menuLabel: 時間・料金があれば括弧で添える', () => {
  assert.equal(
    menuLabel({ name: 'ボディケア60分', minutes: 60, price: 6600 }),
    'ボディケア60分（60分・¥6,600）'
  );
  assert.equal(menuLabel({ name: 'ヘッド15分', minutes: 15, price: 0 }), 'ヘッド15分（15分）');
  assert.equal(menuLabel({ name: 'お試し', minutes: 0, price: 0 }), 'お試し');
});

test('normalizeState: menus を正規化し、名前のないものは除外する', () => {
  const state = normalizeState({
    menus: [
      { id: 'm1', category: 'ボディケア', name: 'ボディ60', minutes: 60, price: 6600 },
      { id: 'm2', minutes: 30 }, // name なし → 除外
      { id: 'm3', name: 'アロマ60', minutes: '60', price: '-100' },
      null,
    ],
  });
  assert.equal(state.menus.length, 2);
  assert.deepEqual(state.menus[0], {
    id: 'm1',
    category: 'ボディケア',
    name: 'ボディ60',
    minutes: 60,
    price: 6600,
  });
  // カテゴリ未指定は「その他」、不正な数値は 0 に落とす
  assert.equal(state.menus[1].category, 'その他');
  assert.equal(state.menus[1].minutes, 60);
  assert.equal(state.menus[1].price, 0);
});

test('normalizeState: menus が無い旧データは空配列になる', () => {
  assert.deepEqual(normalizeState({ clients: [], visits: [] }).menus, []);
});

test('normalizeState: scripts が無い旧データには初期スクリプト集を入れる', async () => {
  const { SCRIPT_SEEDS } = await import('../src/data/scriptSeeds.js');
  const state = normalizeState({ clients: [], visits: [] });
  assert.equal(state.scripts.length, SCRIPT_SEEDS.length);
  // 空配列は「全削除した」状態として尊重する
  assert.equal(normalizeState({ scripts: [] }).scripts.length, 0);
});

test('normalizeState: 不正なスクリプトを除外して整える', () => {
  const state = normalizeState({
    scripts: [
      { id: 's1', scene: 'お出迎え', title: '挨拶', lines: 'こんにちは' },
      { id: 's2' }, // title も lines も無い → 除外
      { id: 's3', lines: 'セリフだけ' },
      null,
    ],
  });
  assert.equal(state.scripts.length, 2);
  assert.equal(state.scripts[1].title, '無題');
  assert.equal(state.scripts[1].scene, 'こんな時');
});
