// Service Worker — オフライン起動とアプリシェルのキャッシュ
//
// アセット名はビルド時にハッシュ化されるため、事前リストではなく
// 「取得したものを順次キャッシュする」stale-while-revalidate 方式を採る。
// これにより一度オンラインで開けば、以降はオフラインでも起動できる。

const CACHE = 'salon-shimei-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET かつ同一オリジンのみ対象
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // キャッシュ優先。無ければネットワーク。両方だめなら index にフォールバック。
      if (cached) {
        network; // バックグラウンドで更新
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') {
        const shell = (await cache.match('./')) || (await cache.match('index.html'));
        if (shell) return shell;
      }
      return new Response('オフラインです', { status: 503, statusText: 'offline' });
    })()
  );
});

// ---- リマインダー通知（Periodic Background Sync 対応端末のみ） ----
// 判定ロジックは src/lib/reminders.js と同じ計算のコンパクト版。
// アプリ側が IndexedDB に保存したスナップショットを読み、通知を表示する。

const RDB = 'salon-shimei-reminders';
const RSTORE = 'kv';
const RENOTIFY_DAYS = 7;

function rOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RDB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(RSTORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function rGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(RSTORE).objectStore(RSTORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function rSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RSTORE, 'readwrite');
    tx.objectStore(RSTORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function rToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function rDays(fromStr, toStr) {
  const p = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  return Math.round((p(toStr) - p(fromStr)) / 86400000);
}

async function checkReminders() {
  const today = rToday();
  const db = await rOpen();
  const snapshot = await rGet(db, 'snapshot');
  if (!snapshot || !Array.isArray(snapshot.items)) return;
  const log = (await rGet(db, 'notifyLog')) || {};
  const mmdd = today.slice(5);

  for (const item of snapshot.items) {
    const due = [];
    if (item.birthday && item.birthday === mmdd) {
      due.push({
        id: `bday-${item.id}`,
        title: '🎂 今日はお誕生日',
        body: `${item.name} 様のお誕生日です。お祝いメッセージを送りましょう`,
      });
    }
    if (item.lastVisit && item.intervalDays > 0) {
      const days = rDays(item.lastVisit, today);
      if (days >= item.intervalDays && days <= item.intervalDays * 3) {
        due.push({
          id: `follow-${item.id}`,
          title: '💌 そろそろ来店時期です',
          body: `${item.name} 様は最終来店から${days}日。フォローメッセージを送りましょう`,
        });
      }
    }
    for (const r of due) {
      const last = log[r.id];
      if (last && rDays(last, today) < RENOTIFY_DAYS) continue;
      await self.registration.showNotification(r.title, {
        body: r.body,
        tag: r.id,
        icon: './icons/icon-192.png',
      });
      log[r.id] = today;
    }
  }
  await rSet(db, 'notifyLog', log);
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'reminder-check') event.waitUntil(checkReminders());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (wins.length) return wins[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
