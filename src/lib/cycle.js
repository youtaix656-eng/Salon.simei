// 来店サイクル分析 — 来店間隔の平均から「そろそろ来店時期」のお客様を割り出す。
// 日付はすべて 'YYYY-MM-DD' 文字列で扱い、ローカルタイムの深夜0時に固定して
// タイムゾーンによる日ずれを避ける。

export const DAY_MS = 24 * 60 * 60 * 1000;

// 来店履歴が1回しかないお客様に仮置きする標準の来店サイクル（日）
export const DEFAULT_INTERVAL_DAYS = 30;

export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return formatDate(new Date());
}

export function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(fromStr, toStr) {
  return Math.round((parseDate(toStr) - parseDate(fromStr)) / DAY_MS);
}

// 重複を除いて昇順に並べた来店日リスト
export function sortedVisitDates(dates) {
  return [...new Set(dates)].sort();
}

// 直近 recentN 回分の来店間隔の平均（日）。来店が2回未満なら null。
// 直近に重みを置くことで、通い始めより最近のペースを反映する。
export function averageIntervalDays(dates, recentN = 5) {
  const ds = sortedVisitDates(dates);
  if (ds.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < ds.length; i++) {
    intervals.push(daysBetween(ds[i - 1], ds[i]));
  }
  const recent = intervals.slice(-recentN);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

export const STATUS_LABELS = {
  recent: '来店間もない',
  soon: 'そろそろ来店時期',
  due: '来店時期を過ぎています',
  risk: '離反リスク',
};

// お客様の来店履歴から現在のフォローアップ状況を判定する。
//   recent : サイクルの75%未満（まだ連絡不要）
//   soon   : サイクルの75%以上（そろそろ声かけどき）
//   due    : サイクルを超過（フォロー推奨）
//   risk   : サイクルの2倍超過（離反しかけ・要ケア）
export function followUpStatus(dates, today = todayStr()) {
  const ds = sortedVisitDates(dates);
  if (ds.length === 0) return null;
  const last = ds[ds.length - 1];
  const daysSince = daysBetween(last, today);
  const avg = averageIntervalDays(ds);
  const interval = avg ?? DEFAULT_INTERVAL_DAYS;
  const ratio = daysSince / interval;
  let status = 'recent';
  if (ratio >= 2) status = 'risk';
  else if (ratio >= 1) status = 'due';
  else if (ratio >= 0.75) status = 'soon';
  return {
    lastVisit: last,
    daysSince,
    intervalDays: Math.round(interval),
    expectedDate: addDays(last, Math.round(interval)),
    ratio,
    status,
    visitCount: ds.length,
  };
}
