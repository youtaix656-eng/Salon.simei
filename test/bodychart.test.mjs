import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_ZONES, ZONE_IDS, zoneLabels } from '../src/data/bodyZones.js';
import { normalizeState } from '../src/lib/storage.js';
import { upcomingExpectedVisits } from '../src/lib/stats.js';
import { addDays, todayStr } from '../src/lib/cycle.js';

test('BODY_ZONES: IDは重複せず、全部位にラベルとビューがある', () => {
  assert.equal(ZONE_IDS.size, BODY_ZONES.length);
  for (const z of BODY_ZONES) {
    assert.ok(z.label, `${z.id} にラベルがない`);
    assert.ok(['back', 'front'].includes(z.view), `${z.id} のビューが不正`);
    assert.ok(z.shape && ['rect', 'circle'].includes(z.shape.type));
  }
});

test('zoneLabels: 定義順のラベルを返し、不明IDは無視する', () => {
  assert.deepEqual(zoneLabels(['scapula-l', 'back-neck', 'nonsense']), ['首', '左肩甲骨']);
  assert.deepEqual(zoneLabels([]), []);
  assert.deepEqual(zoneLabels(), []);
});

test('normalizeState: bodyParts は既知の部位IDだけ残す', () => {
  const state = normalizeState({
    clients: [
      { id: 'a', name: '佐藤', bodyParts: ['shoulder-r', 'fake-zone', 123, 'lower-back'] },
      { id: 'b', name: '田中' }, // bodyParts なし
    ],
  });
  assert.deepEqual(state.clients[0].bodyParts, ['shoulder-r', 'lower-back']);
  assert.deepEqual(state.clients[1].bodyParts, []);
});

test('upcomingExpectedVisits: 予測日が近い順に、期間内のお客様だけ返す', () => {
  const today = todayStr();
  const clients = [
    { id: 'soon', name: '近日' },
    { id: 'today', name: '今日' },
    { id: 'far', name: 'まだ先' },
    { id: 'overdue', name: '超過' },
    { id: 'none', name: '記録なし' },
  ];
  // 周期30日で予測日を today+N に調整（最終来店 = today - (30 - N)）
  const mk = (clientId, lastOffsetDays, talk = '') => [
    { id: `${clientId}-1`, clientId, date: addDays(today, lastOffsetDays - 30), talk: '' },
    { id: `${clientId}-2`, clientId, date: addDays(today, lastOffsetDays), talk },
  ];
  const visits = [
    ...mk('soon', -27, '来月ご旅行'), // 予測 today+3
    ...mk('today', -30), // 予測 today
    ...mk('far', -10), // 予測 today+20 → 7日以内に入らない
    ...mk('overdue', -40), // 予測は過去 → 含まない（due/riskチップ側で対応）
  ];
  const result = upcomingExpectedVisits(clients, visits, today, 7);
  assert.deepEqual(result.map((r) => r.client.id), ['today', 'soon']);
  assert.equal(result[0].daysUntil, 0);
  assert.equal(result[1].daysUntil, 3);
  // 前回来店の会話メモを添える
  assert.equal(result[1].lastVisit.talk, '来月ご旅行');
});
