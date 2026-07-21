import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBirthday, isValidBirthdayInput } from '../src/lib/stats.js';
import { firstVisitToday } from '../src/lib/calendar.js';
import { recordBackupDone, loadLastBackupDate, shouldRemindBackup, BACKUP_KEY } from '../src/lib/backupTracker.js';
import { addDays, todayStr } from '../src/lib/cycle.js';

// ---- 誕生日バリデーション ----

test('parseBirthday: 実在しない月日は不正扱いにする', () => {
  assert.equal(parseBirthday('13-40'), null); // 13月は無い
  assert.equal(parseBirthday('04-31'), null); // 4月に31日は無い
  assert.equal(parseBirthday('02-30'), null); // 2月に30日は無い
  assert.deepEqual(parseBirthday('02-29'), { month: 2, day: 29 }); // 閏日は許可
  assert.deepEqual(parseBirthday('08-02'), { month: 8, day: 2 });
});

test('isValidBirthdayInput: 空欄は許可、不正な日付は拒否する', () => {
  assert.equal(isValidBirthdayInput(''), true);
  assert.equal(isValidBirthdayInput('   '), true);
  assert.equal(isValidBirthdayInput('08-02'), true);
  assert.equal(isValidBirthdayInput('13-40'), false);
  assert.equal(isValidBirthdayInput('04-31'), false);
});

// ---- 今日最初のご予約 ----

test('firstVisitToday: 開始時間つきの記録から一番早いものを返す', () => {
  const today = todayStr();
  const clients = [{ id: 'a', name: '佐藤' }, { id: 'b', name: '田中' }];
  const visits = [
    { id: 'v1', clientId: 'a', date: today, time: '14:00', menu: 'ボディ60' },
    { id: 'v2', clientId: 'b', date: today, time: '10:00', menu: 'ヘッド15' },
    { id: 'v3', clientId: 'a', date: addDays(today, -1), time: '09:00', menu: '前日' },
    { id: 'v4', clientId: 'b', date: today, time: '', menu: '時間未入力' },
  ];
  const first = firstVisitToday(clients, visits, today);
  assert.equal(first.id, 'v2');
  assert.equal(first.client.name, '田中');
});

test('firstVisitToday: 今日の記録が無ければ null', () => {
  const today = todayStr();
  assert.equal(firstVisitToday([], [], today), null);
  assert.equal(
    firstVisitToday(
      [{ id: 'a', name: '佐藤' }],
      [{ id: 'v1', clientId: 'a', date: addDays(today, -1), time: '10:00' }],
      today
    ),
    null
  );
});

// ---- バックアップ通知 ----

test('shouldRemindBackup: 未実施・30日以上経過でtrue、直近ならfalse', () => {
  const today = todayStr();
  assert.equal(shouldRemindBackup(null, today), true);
  assert.equal(shouldRemindBackup(addDays(today, -29), today), false);
  assert.equal(shouldRemindBackup(addDays(today, -30), today), true);
  assert.equal(shouldRemindBackup(today, today), false);
});

test('recordBackupDone / loadLastBackupDate: localStorageに保存・取得できる', () => {
  const originalLS = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    assert.equal(loadLastBackupDate(), null);
    recordBackupDone('2026-07-01');
    assert.equal(loadLastBackupDate(), '2026-07-01');
    assert.equal(store.get(BACKUP_KEY), '2026-07-01');
  } finally {
    globalThis.localStorage = originalLS;
  }
});
