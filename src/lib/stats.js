// 指名率・リピート率などの集計ロジック（純関数）
import { averageIntervalDays, todayStr, followUpStatus, daysBetween } from './cycle.js';

export function monthKey(dateStr) {
  return String(dateStr).slice(0, 7); // 'YYYY-MM'
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

// 当月を末尾に、直近 n ヶ月のキーを昇順で返す
export function lastMonths(n, today = todayStr()) {
  const current = monthKey(today);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(shiftMonth(current, -i));
  return keys;
}

// 月ごとの来店数・指名数・指名率
export function monthlyStats(visits, months = 6, today = todayStr()) {
  return lastMonths(months, today).map((key) => {
    const vs = visits.filter((v) => monthKey(v.date) === key);
    const nominated = vs.filter((v) => v.nominated).length;
    return {
      key,
      label: `${Number(key.slice(5))}月`,
      total: vs.length,
      nominated,
      rate: vs.length ? nominated / vs.length : 0,
    };
  });
}

// 来店経験のあるお客様のうち、2回以上来店した割合（リピート率）
export function repeatStats(visits) {
  const counts = new Map();
  for (const v of visits) {
    counts.set(v.clientId, (counts.get(v.clientId) || 0) + 1);
  }
  const visited = counts.size;
  const repeated = [...counts.values()].filter((c) => c >= 2).length;
  return { visited, repeated, rate: visited ? repeated / visited : 0 };
}

// 今月の指名数と目標に対する進捗
export function monthProgress(visits, goal, today = todayStr()) {
  const key = monthKey(today);
  const vs = visits.filter((v) => monthKey(v.date) === key);
  const nominated = vs.filter((v) => v.nominated).length;
  return {
    month: key,
    total: vs.length,
    nominated,
    goal,
    goalRatio: goal > 0 ? Math.min(1, nominated / goal) : 0,
    rate: vs.length ? nominated / vs.length : 0,
  };
}

// お客様ごとの来店数・指名数を集計し、指名数→来店数の順で上位を返す
export function clientRanking(clients, visits, topN = 5) {
  const per = new Map();
  for (const v of visits) {
    const p = per.get(v.clientId) || { visits: 0, nominated: 0, lastVisit: '' };
    p.visits += 1;
    if (v.nominated) p.nominated += 1;
    if (v.date > p.lastVisit) p.lastVisit = v.date;
    per.set(v.clientId, p);
  }
  return clients
    .filter((c) => per.has(c.id))
    .map((c) => ({ client: c, ...per.get(c.id) }))
    .sort((a, b) => b.nominated - a.nominated || b.visits - a.visits)
    .slice(0, topN);
}

// 全お客様の平均来店間隔（間隔を計算できる人のみの平均）
export function overallAverageInterval(clients, visits) {
  const values = [];
  for (const c of clients) {
    const dates = visits.filter((v) => v.clientId === c.id).map((v) => v.date);
    const avg = averageIntervalDays(dates);
    if (avg != null) values.push(avg);
  }
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ---- 次回来店の予測 ----

// 来店周期から予測した「次回来店予定日」が今日から withinDays 日以内のお客様を、
// 予定日が近い順に返す。前回来店の記録（会話メモの見返し用）も添える。
export function upcomingExpectedVisits(clients, visits, today = todayStr(), withinDays = 7) {
  return clients
    .map((client) => {
      const own = visits.filter((v) => v.clientId === client.id);
      const info = followUpStatus(own.map((v) => v.date), today);
      if (!info) return null;
      const daysUntil = daysBetween(today, info.expectedDate);
      const lastVisit = own.reduce((a, v) => (!a || v.date > a.date ? v : a), null);
      return { client, info, daysUntil, lastVisit };
    })
    .filter((r) => r && r.daysUntil >= 0 && r.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// ---- 誕生日 ----

// 月ごとの最大日数（2月は閏日の誕生日も入力できるよう29日まで許可）
const MONTH_DAY_MAX = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// 'MM-DD' / 'M/D' / 'YYYY-MM-DD' などの表記から {month, day} を取り出す。
// 解釈できない、または実在しない月日（13月・4月31日など）の場合は null。
export function parseBirthday(str) {
  const nums = String(str || '').match(/\d+/g);
  if (!nums || nums.length < 2) return null;
  // 3つ以上の数値（年入り）の場合は末尾2つを月・日とみなす
  const [m, d] = nums.slice(-2).map(Number);
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > MONTH_DAY_MAX[m - 1]) return null;
  return { month: m, day: d };
}

// カルテ編集フォームでの誕生日入力チェック。空欄は「未設定」として許可する。
export function isValidBirthdayInput(str) {
  const s = String(str || '').trim();
  if (!s) return true;
  return parseBirthday(s) !== null;
}

// 今月が誕生月のお客様を日付順に返す
export function birthdaysInMonth(clients, today = todayStr()) {
  const month = Number(today.slice(5, 7));
  return clients
    .map((client) => ({ client, birthday: parseBirthday(client.birthday) }))
    .filter((x) => x.birthday && x.birthday.month === month)
    .sort((a, b) => a.birthday.day - b.birthday.day)
    .map((x) => ({ client: x.client, month: x.birthday.month, day: x.birthday.day }));
}

// ---- 売上 ----

// 今月の売上（料金が記録された施術の集計）
export function revenueStats(visits, today = todayStr()) {
  const key = monthKey(today);
  const vs = visits.filter((v) => monthKey(v.date) === key);
  const priced = vs.filter((v) => (v.price || 0) > 0);
  const sum = (list) => list.reduce((a, v) => a + (v.price || 0), 0);
  const total = sum(priced);
  const nominated = sum(priced.filter((v) => v.nominated));
  return {
    month: key,
    total,
    nominated,
    free: total - nominated,
    recorded: priced.length,
    average: priced.length ? Math.round(total / priced.length) : 0,
    nominatedShare: total ? nominated / total : 0,
  };
}

// ---- メニュー別分析 ----

// メニューごとの施術回数・指名率・平均単価（回数の多い順）
export function menuStats(visits, topN = 8) {
  const map = new Map();
  for (const v of visits) {
    const menu = (v.menu || '').trim();
    if (!menu) continue;
    const m = map.get(menu) || { menu, count: 0, nominated: 0, priceSum: 0, priced: 0 };
    m.count += 1;
    if (v.nominated) m.nominated += 1;
    if ((v.price || 0) > 0) {
      m.priceSum += v.price;
      m.priced += 1;
    }
    map.set(menu, m);
  }
  return [...map.values()]
    .map((m) => ({
      menu: m.menu,
      count: m.count,
      nominated: m.nominated,
      rate: m.nominated / m.count,
      averagePrice: m.priced ? Math.round(m.priceSum / m.priced) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.rate - a.rate)
    .slice(0, topN);
}
