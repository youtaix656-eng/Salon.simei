import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReminderSnapshot,
  computeDueReminders,
  filterNewReminders,
} from '../src/lib/reminders.js';

const state = {
  clients: [
    { id: 'a', name: '佐藤', birthday: '07-17' },
    { id: 'b', name: '田中', birthday: '' },
    { id: 'c', name: '記録なし', birthday: '' },
  ],
  visits: [
    { clientId: 'a', date: '2026-06-01' },
    { clientId: 'a', date: '2026-07-01' }, // 周期30日
    { clientId: 'b', date: '2026-05-01' },
  ],
};

test('buildReminderSnapshot: 通知に必要な最小データを作る', () => {
  const snap = buildReminderSnapshot(state, '2026-07-17');
  assert.equal(snap.items.length, 2); // 記録も誕生日もないお客様は含めない
  const a = snap.items.find((i) => i.id === 'a');
  assert.equal(a.lastVisit, '2026-07-01');
  assert.equal(a.intervalDays, 30);
  assert.equal(a.birthday, '07-17');
  const b = snap.items.find((i) => i.id === 'b');
  assert.equal(b.intervalDays, 30); // 1回のみは標準周期
});

test('computeDueReminders: 誕生日とフォロー時期を検出する', () => {
  const snap = buildReminderSnapshot(state, '2026-07-17');
  // 7/17：佐藤の誕生日。フォローは経過16日<30日でまだ
  const due1 = computeDueReminders(snap, '2026-07-17');
  assert.deepEqual(due1.map((r) => r.id), ['bday-a', 'follow-b']);
  // 7/31：佐藤のフォロー（30日経過）
  const due2 = computeDueReminders(snap, '2026-07-31');
  assert.ok(due2.some((r) => r.id === 'follow-a'));
  // 周期の3倍を超えたら通知しない
  const due3 = computeDueReminders(snap, '2026-11-01');
  assert.ok(!due3.some((r) => r.id === 'follow-a'));
});

test('filterNewReminders: 通知済みは7日間スキップ', () => {
  const reminders = [{ id: 'follow-a', title: 't', body: 'b' }];
  assert.equal(filterNewReminders(reminders, {}, '2026-07-17').length, 1);
  assert.equal(
    filterNewReminders(reminders, { 'follow-a': '2026-07-15' }, '2026-07-17').length,
    0
  );
  assert.equal(
    filterNewReminders(reminders, { 'follow-a': '2026-07-01' }, '2026-07-17').length,
    1
  );
});
