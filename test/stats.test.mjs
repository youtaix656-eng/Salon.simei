import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthKey,
  shiftMonth,
  lastMonths,
  monthlyStats,
  repeatStats,
  monthProgress,
  clientRanking,
  overallAverageInterval,
} from '../src/lib/stats.js';

const visit = (clientId, date, nominated) => ({ id: `${clientId}-${date}`, clientId, date, nominated });

test('monthKey / shiftMonth: 年またぎを含めて正しい', () => {
  assert.equal(monthKey('2026-07-17'), '2026-07');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  assert.equal(shiftMonth('2026-07', -6), '2026-01');
});

test('lastMonths: 当月を末尾に昇順で返す', () => {
  assert.deepEqual(lastMonths(3, '2026-02-15'), ['2025-12', '2026-01', '2026-02']);
});

test('monthlyStats: 月ごとの来店数・指名数・指名率', () => {
  const visits = [
    visit('a', '2026-06-01', true),
    visit('a', '2026-06-20', false),
    visit('b', '2026-07-05', true),
  ];
  const stats = monthlyStats(visits, 2, '2026-07-17');
  assert.equal(stats.length, 2);
  assert.deepEqual(
    stats.map((s) => [s.key, s.total, s.nominated]),
    [['2026-06', 2, 1], ['2026-07', 1, 1]]
  );
  assert.equal(stats[0].rate, 0.5);
  assert.equal(stats[1].rate, 1);
});

test('repeatStats: 2回以上来店したお客様の割合', () => {
  const visits = [
    visit('a', '2026-06-01', true),
    visit('a', '2026-07-01', true),
    visit('b', '2026-07-05', false),
  ];
  const r = repeatStats(visits);
  assert.equal(r.visited, 2);
  assert.equal(r.repeated, 1);
  assert.equal(r.rate, 0.5);
  assert.deepEqual(repeatStats([]), { visited: 0, repeated: 0, rate: 0 });
});

test('monthProgress: 今月の指名数と目標進捗', () => {
  const visits = [
    visit('a', '2026-07-01', true),
    visit('a', '2026-07-10', true),
    visit('b', '2026-07-12', false),
    visit('b', '2026-06-12', true), // 先月分は含めない
  ];
  const p = monthProgress(visits, 10, '2026-07-17');
  assert.equal(p.nominated, 2);
  assert.equal(p.total, 3);
  assert.equal(p.goalRatio, 0.2);
  // 目標超過時は 1.0 で頭打ち
  assert.equal(monthProgress(visits, 1, '2026-07-17').goalRatio, 1);
  // 目標0のときは0除算しない
  assert.equal(monthProgress(visits, 0, '2026-07-17').goalRatio, 0);
});

test('clientRanking: 指名数→来店数の順で並べる', () => {
  const clients = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' }, // 来店なし → 含まれない
  ];
  const visits = [
    visit('a', '2026-07-01', true),
    visit('b', '2026-07-02', true),
    visit('b', '2026-07-10', true),
    visit('c', '2026-07-03', false),
    visit('c', '2026-07-04', false),
    visit('c', '2026-07-05', false),
  ];
  const ranking = clientRanking(clients, visits, 10);
  assert.deepEqual(ranking.map((r) => r.client.id), ['b', 'a', 'c']);
  assert.equal(ranking[0].nominated, 2);
  assert.equal(ranking[0].lastVisit, '2026-07-10');
});

test('overallAverageInterval: 間隔を計算できるお客様の平均', () => {
  const clients = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const visits = [
    // a: 20日間隔
    visit('a', '2026-06-01', true),
    visit('a', '2026-06-21', true),
    // b: 30日間隔
    visit('b', '2026-06-01', true),
    visit('b', '2026-07-01', true),
    // c: 1回のみ → 対象外
    visit('c', '2026-07-01', true),
  ];
  assert.equal(overallAverageInterval(clients, visits), 25);
  assert.equal(overallAverageInterval(clients, []), null);
});

test('parseBirthday: 様々な表記を解釈する', async () => {
  const { parseBirthday } = await import('../src/lib/stats.js');
  assert.deepEqual(parseBirthday('08-02'), { month: 8, day: 2 });
  assert.deepEqual(parseBirthday('8/2'), { month: 8, day: 2 });
  assert.deepEqual(parseBirthday('1990-08-02'), { month: 8, day: 2 });
  assert.deepEqual(parseBirthday('8月2日'), { month: 8, day: 2 });
  assert.equal(parseBirthday(''), null);
  assert.equal(parseBirthday('不明'), null);
  assert.equal(parseBirthday('13-40'), null);
});

test('birthdaysInMonth: 今月の誕生日を日付順に返す', async () => {
  const { birthdaysInMonth } = await import('../src/lib/stats.js');
  const clients = [
    { id: 'a', name: 'A', birthday: '07-20' },
    { id: 'b', name: 'B', birthday: '07-05' },
    { id: 'c', name: 'C', birthday: '08-01' },
    { id: 'd', name: 'D', birthday: '' },
  ];
  const result = birthdaysInMonth(clients, '2026-07-17');
  assert.deepEqual(result.map((r) => r.client.id), ['b', 'a']);
  assert.equal(result[0].day, 5);
});

test('revenueStats: 今月の売上と指名内訳', async () => {
  const { revenueStats } = await import('../src/lib/stats.js');
  const visits = [
    { clientId: 'a', date: '2026-07-01', nominated: true, price: 6000 },
    { clientId: 'b', date: '2026-07-10', nominated: false, price: 4000 },
    { clientId: 'a', date: '2026-07-12', nominated: true, price: 0 }, // 料金未入力は集計外
    { clientId: 'a', date: '2026-06-12', nominated: true, price: 9999 }, // 先月分は含めない
  ];
  const r = revenueStats(visits, '2026-07-17');
  assert.equal(r.total, 10000);
  assert.equal(r.nominated, 6000);
  assert.equal(r.free, 4000);
  assert.equal(r.recorded, 2);
  assert.equal(r.average, 5000);
  assert.equal(r.nominatedShare, 0.6);
  assert.equal(revenueStats([], '2026-07-17').recorded, 0);
});

test('menuStats: メニュー別の回数・指名率・平均単価', async () => {
  const { menuStats } = await import('../src/lib/stats.js');
  const visits = [
    { menu: 'ボディ60', nominated: true, price: 6000 },
    { menu: 'ボディ60', nominated: false, price: 6600 },
    { menu: 'ヘッド45', nominated: true, price: 0 },
    { menu: '', nominated: true, price: 5000 }, // メニュー未記入は除外
  ];
  const stats = menuStats(visits);
  assert.equal(stats.length, 2);
  assert.equal(stats[0].menu, 'ボディ60'); // 回数順
  assert.equal(stats[0].count, 2);
  assert.equal(stats[0].rate, 0.5);
  assert.equal(stats[0].averagePrice, 6300);
  assert.equal(stats[1].averagePrice, 0); // 料金未入力
});
