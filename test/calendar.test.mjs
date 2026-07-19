import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthGrid, calendarEvents, monthLabel } from '../src/lib/calendar.js';
import { normalizeForSearch, fuzzyIncludes, clientMatchesQuery } from '../src/lib/search.js';
import { normalizeState } from '../src/lib/storage.js';

test('buildMonthGrid: 2026年7月は水曜始まり31日', () => {
  const grid = buildMonthGrid('2026-07');
  assert.equal(grid.length % 7, 0);
  // 2026-07-01 は水曜 → 日月火の3マスが空
  assert.deepEqual(grid.slice(0, 4), [null, null, null, '2026-07-01']);
  assert.ok(grid.includes('2026-07-31'));
  assert.equal(grid.filter(Boolean).length, 31);
});

test('monthLabel: 年月の日本語表記', () => {
  assert.equal(monthLabel('2026-07'), '2026年7月');
});

test('calendarEvents: 記録・誕生日・予測を日付ごとに集める', () => {
  const clients = [
    { id: 'a', name: '佐藤', birthday: '07-25' },
    { id: 'b', name: '田中', birthday: '11-20' },
  ];
  const visits = [
    { id: 'v1', clientId: 'a', date: '2026-07-10', time: '14:00', menu: 'ボディ60' },
    { id: 'v2', clientId: 'a', date: '2026-07-10', time: '10:00', menu: 'ヘッド15' },
    { id: 'v3', clientId: 'a', date: '2026-06-10', time: '', menu: '' }, // 前月 → 対象外
    // 田中様：30日周期 → 次回予測 2026-07-30
    { id: 'v4', clientId: 'b', date: '2026-05-31', time: '', menu: '' },
    { id: 'v5', clientId: 'b', date: '2026-06-30', time: '', menu: '' },
  ];
  const events = calendarEvents(clients, visits, '2026-07', '2026-07-19');
  // 同日の記録は時間順
  assert.deepEqual(events.get('2026-07-10').visits.map((v) => v.id), ['v2', 'v1']);
  assert.equal(events.get('2026-07-10').visits[0].client.name, '佐藤');
  // 誕生日
  assert.equal(events.get('2026-07-25').birthdays[0].id, 'a');
  assert.equal([...events.values()].flatMap((e) => e.birthdays).length, 1);
  // 来店予測（今日以降のみ）
  assert.equal(events.get('2026-07-30').predicted[0].client.id, 'b');
});

test('normalizeForSearch: カタカナ・全角・大文字を同一視する', () => {
  assert.equal(normalizeForSearch('フクラハギ'), 'ふくらはぎ');
  assert.equal(normalizeForSearch('ＶＩＰ'), 'vip');
  assert.equal(normalizeForSearch('ﾍｯﾄﾞ'), 'へっど');
  assert.ok(fuzzyIncludes('ふくらはぎが張りやすい', 'フクラハギ'));
  assert.ok(fuzzyIncludes('VIP対応', 'vip'));
});

test('clientMatchesQuery: 表記ゆれでもヒットする', () => {
  const client = { name: '佐藤', focusAreas: 'ふくらはぎ・腰', tags: [] };
  assert.ok(clientMatchesQuery(client, 'フクラハギ'));
  assert.ok(clientMatchesQuery(client, 'ふくらはぎ'));
  assert.ok(!clientMatchesQuery(client, '肩'));
});

test('normalizeState: 来店記録の time と bodyParts を正規化する', () => {
  const state = normalizeState({
    clients: [{ id: 'a', name: '佐藤' }],
    visits: [
      { id: 'v1', clientId: 'a', date: '2026-07-01', time: '14:30', bodyParts: ['lower-back', 'fake'] },
      { id: 'v2', clientId: 'a', date: '2026-07-02', time: '25:99' }, // 不正な時間
    ],
  });
  assert.equal(state.visits[0].time, '14:30');
  assert.deepEqual(state.visits[0].bodyParts, ['lower-back']);
  assert.equal(state.visits[1].time, '');
  assert.deepEqual(state.visits[1].bodyParts, []);
});
