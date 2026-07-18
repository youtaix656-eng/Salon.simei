import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween,
  addDays,
  sortedVisitDates,
  averageIntervalDays,
  followUpStatus,
  DEFAULT_INTERVAL_DAYS,
} from '../src/lib/cycle.js';

test('daysBetween: 月またぎ・年またぎを正しく数える', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.equal(daysBetween('2026-01-31', '2026-02-01'), 1);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-03-01', '2026-03-01'), 0);
});

test('addDays: 月末や負の値も扱える', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-07-17', 30), '2026-08-16');
});

test('sortedVisitDates: 重複除去して昇順に並べる', () => {
  assert.deepEqual(
    sortedVisitDates(['2026-03-01', '2026-01-15', '2026-03-01', '2026-02-10']),
    ['2026-01-15', '2026-02-10', '2026-03-01']
  );
});

test('averageIntervalDays: 2回未満は null', () => {
  assert.equal(averageIntervalDays([]), null);
  assert.equal(averageIntervalDays(['2026-01-01']), null);
});

test('averageIntervalDays: 間隔の平均を返す', () => {
  assert.equal(averageIntervalDays(['2026-01-01', '2026-01-31']), 30);
  // 30日 + 20日 → 平均25日
  assert.equal(
    averageIntervalDays(['2026-01-01', '2026-01-31', '2026-02-20']),
    25
  );
});

test('averageIntervalDays: recentN で直近の間隔のみ使う', () => {
  // 間隔: 100, 10, 10 → 直近2つの平均は10
  const dates = ['2026-01-01', '2026-04-11', '2026-04-21', '2026-05-01'];
  assert.equal(averageIntervalDays(dates, 2), 10);
});

test('followUpStatus: 来店なしは null', () => {
  assert.equal(followUpStatus([], '2026-07-17'), null);
});

test('followUpStatus: 1回のみの来店は標準サイクルで判定', () => {
  const info = followUpStatus(['2026-07-10'], '2026-07-17');
  assert.equal(info.intervalDays, DEFAULT_INTERVAL_DAYS);
  assert.equal(info.daysSince, 7);
  assert.equal(info.status, 'recent');
  assert.equal(info.expectedDate, '2026-08-09');
});

test('followUpStatus: サイクル比で状態が変わる', () => {
  // 20日周期のお客様
  const dates = ['2026-05-01', '2026-05-21', '2026-06-10'];
  // 10日後（0.5倍）→ recent
  assert.equal(followUpStatus(dates, '2026-06-20').status, 'recent');
  // 15日後（0.75倍）→ soon
  assert.equal(followUpStatus(dates, '2026-06-25').status, 'soon');
  // 20日後（1.0倍）→ due
  assert.equal(followUpStatus(dates, '2026-06-30').status, 'due');
  // 40日後（2.0倍）→ risk
  assert.equal(followUpStatus(dates, '2026-07-20').status, 'risk');
});

test('followUpStatus: 最終来店日と回数を返す', () => {
  const info = followUpStatus(['2026-06-01', '2026-05-01'], '2026-06-15');
  assert.equal(info.lastVisit, '2026-06-01');
  assert.equal(info.visitCount, 2);
  assert.equal(info.daysSince, 14);
});
