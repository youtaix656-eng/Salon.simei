// カレンダー表示のロジック（純関数）
// 月のマス目生成と、日付ごとの予定（施術記録・誕生日・来店予測）の集計。
import { todayStr, followUpStatus } from './cycle.js';
import { parseBirthday } from './stats.js';

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// 'YYYY-MM' の月を、日曜始まりのマス目（'YYYY-MM-DD' | null の配列、7の倍数長）にする
export function buildMonthGrid(month) {
  const [y, m] = String(month).split('-').map(Number);
  const startPad = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthLabel(month) {
  const [y, m] = String(month).split('-').map(Number);
  return `${y}年${m}月`;
}

// 月内の日付ごとの予定を集める。
// 返り値：Map<'YYYY-MM-DD', {visits, birthdays, predicted}>
//   visits    … その日の施術記録（client を添え、時間順）
//   birthdays … その日が誕生日のお客様
//   predicted … 来店周期から予測した次回来店（今日以降のみ）
export function calendarEvents(clients, visits, month, today = todayStr()) {
  const byDay = new Map();
  const dayOf = (date) => {
    if (!byDay.has(date)) byDay.set(date, { visits: [], birthdays: [], predicted: [] });
    return byDay.get(date);
  };

  const clientById = new Map(clients.map((c) => [c.id, c]));
  for (const v of visits) {
    if (String(v.date).startsWith(month)) {
      dayOf(v.date).visits.push({ ...v, client: clientById.get(v.clientId) });
    }
  }
  for (const info of byDay.values()) {
    info.visits.sort((a, b) => ((a.time || '99:99') < (b.time || '99:99') ? -1 : 1));
  }

  const monthNum = Number(String(month).slice(5, 7));
  for (const client of clients) {
    const b = parseBirthday(client.birthday);
    if (b && b.month === monthNum) {
      dayOf(`${month}-${String(b.day).padStart(2, '0')}`).birthdays.push(client);
    }
  }

  for (const client of clients) {
    const own = visits.filter((v) => v.clientId === client.id).map((v) => v.date);
    const info = followUpStatus(own, today);
    if (info && info.expectedDate >= today && info.expectedDate.startsWith(month)) {
      dayOf(info.expectedDate).predicted.push({ client, info });
    }
  }

  return byDay;
}

// 今日の施術記録のうち、開始時間が最も早いもの（開始時間が入っているもののみ対象）
export function firstVisitToday(clients, visits, today = todayStr()) {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const todays = visits.filter((v) => v.date === today && v.time);
  if (!todays.length) return null;
  const earliest = todays.reduce((a, v) => (v.time < a.time ? v : a));
  return { ...earliest, client: clientById.get(earliest.clientId) };
}
