// リマインダー通知 — 「そろそろ来店時期」「今日が誕生日」の通知ロジック。
//
// 仕組み：
//  1. アプリの状態が変わるたびに、通知判定に必要な最小限のスナップショット
//     （名前・最終来店日・来店周期・誕生日）を IndexedDB に保存する
//  2. アプリを開いた時にチェックして通知を表示する
//  3. 対応端末（Android の インストール済みPWA など）では Service Worker の
//     Periodic Background Sync により、アプリを開かなくてもチェックが走る
//     （iOS は未対応のため、アプリを開いた時のみ）
//
// 判定ロジックは純関数として切り出し、sw.js にも同じ計算を実装している。
import { parseBirthday } from './stats.js';
import { averageIntervalDays, daysBetween, todayStr, DEFAULT_INTERVAL_DAYS } from './cycle.js';

export const SYNC_TAG = 'reminder-check';
export const RENOTIFY_DAYS = 7; // 同じお客様のフォロー通知は7日空ける
export const PERMISSION_TIMEOUT_MS = 8000; // 許可ダイアログが反応しない場合のタイムアウト

// 一部の環境では通知許可ダイアログが表示されず Promise が永久に解決しないことがある。
// タイムアウトさせてボタンが無反応に見えないようにする。
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// ---- 純関数（テスト対象） ----

// 通知判定に必要な最小限のデータを作る
export function buildReminderSnapshot(state, today = todayStr()) {
  const items = (state.clients || [])
    .map((c) => {
      const dates = (state.visits || [])
        .filter((v) => v.clientId === c.id)
        .map((v) => v.date)
        .sort();
      const last = dates[dates.length - 1] || '';
      const avg = averageIntervalDays(dates);
      const b = parseBirthday(c.birthday);
      return {
        id: c.id,
        name: c.name,
        lastVisit: last,
        intervalDays: Math.round(avg ?? DEFAULT_INTERVAL_DAYS),
        birthday: b
          ? `${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
          : '',
      };
    })
    .filter((i) => i.lastVisit || i.birthday);
  return { generatedAt: today, items };
}

// 今日通知すべきものを計算する
//  - 誕生日：今日が誕生日のお客様
//  - フォロー：来店周期を超過（周期の3倍まで。それ以上は通知しない）
export function computeDueReminders(snapshot, today = todayStr()) {
  const out = [];
  const mmdd = today.slice(5);
  for (const item of snapshot?.items || []) {
    if (item.birthday && item.birthday === mmdd) {
      out.push({
        id: `bday-${item.id}`,
        title: '🎂 今日はお誕生日',
        body: `${item.name} 様のお誕生日です。お祝いメッセージを送りましょう`,
      });
    }
    if (item.lastVisit && item.intervalDays > 0) {
      const days = daysBetween(item.lastVisit, today);
      if (days >= item.intervalDays && days <= item.intervalDays * 3) {
        out.push({
          id: `follow-${item.id}`,
          title: '💌 そろそろ来店時期です',
          body: `${item.name} 様は最終来店から${days}日。フォローメッセージを送りましょう`,
        });
      }
    }
  }
  return out;
}

// 通知済みログ（{id: 'YYYY-MM-DD'}）と突き合わせ、まだ通知していないものだけ返す
export function filterNewReminders(reminders, log, today = todayStr(), renotifyDays = RENOTIFY_DAYS) {
  return reminders.filter((r) => {
    const last = log?.[r.id];
    return !last || daysBetween(last, today) >= renotifyDays;
  });
}

// ---- IndexedDB（Service Worker と共有する保存領域） ----

const DB_NAME = 'salon-shimei-reminders';
const STORE = 'kv';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- ブラウザ連携 ----

// 状態が変わるたびに呼ぶ：スナップショットを保存
export async function syncReminderSnapshot(state) {
  try {
    await idbSet('snapshot', buildReminderSnapshot(state));
  } catch {
    /* IndexedDB が使えない環境では諦める */
  }
}

// 通知許可をリクエストし、可能ならバックグラウンドチェックも登録する
export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error('この端末・ブラウザは通知に対応していません');
  }
  const permission = await withTimeout(
    Notification.requestPermission(),
    PERMISSION_TIMEOUT_MS,
    '通知の許可確認がタイムアウトしました。端末の通知設定を確認して、もう一度お試しください。'
  );
  if (permission !== 'granted') {
    throw new Error('通知が許可されませんでした（端末の設定から許可できます）');
  }
  let background = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      await reg.periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
      background = true;
    }
  } catch {
    background = false;
  }
  return { permission, background };
}

// アプリを開いた時のチェック：通知すべきものがあれば表示
export async function checkAndNotify(state, today = todayStr()) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return 0;
  const due = computeDueReminders(buildReminderSnapshot(state, today), today);
  let log = {};
  try {
    log = (await idbGet('notifyLog')) || {};
  } catch {
    log = {};
  }
  const fresh = filterNewReminders(due, log, today);
  if (!fresh.length) return 0;

  let reg = null;
  try {
    reg = await navigator.serviceWorker?.getRegistration();
  } catch {
    reg = null;
  }
  for (const r of fresh) {
    try {
      if (reg?.showNotification) {
        await reg.showNotification(r.title, { body: r.body, tag: r.id, icon: './icons/icon-192.png' });
      } else {
        new Notification(r.title, { body: r.body, tag: r.id });
      }
      log[r.id] = today;
    } catch {
      /* 表示に失敗した分は次回に再試行 */
    }
  }
  try {
    await idbSet('notifyLog', log);
  } catch {
    /* noop */
  }
  return fresh.length;
}
