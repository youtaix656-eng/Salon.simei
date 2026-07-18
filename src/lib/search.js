// お客様検索・絞り込みロジック（純関数）
// キーワードはカルテ全体（名前・ふりがな・メモ・部位・話題・注意点・タグ）を対象にする。
// 特別なキーワード：
//   「注意」「⚠️」 → 注意点（NG・注意点）が記入されているお客様
//   「誕生日」     → 誕生日が登録されているお客様
//   「7月」など    → その月が誕生月のお客様
import { parseBirthday } from './stats.js';

// 全お客様からタグ一覧を重複なしで集める（出現順）
export function collectTags(clients) {
  const seen = new Set();
  const list = [];
  for (const c of clients) {
    for (const tag of c.tags || []) {
      if (!seen.has(tag)) {
        seen.add(tag);
        list.push(tag);
      }
    }
  }
  return list;
}

// 「常連, VIP」「常連、VIP」のような入力をタグ配列にする
export function parseTagsInput(text) {
  return String(text || '')
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

const CAUTION_WORDS = new Set(['注意', '⚠️', '⚠', '⚠️注意⚠️', 'NG', 'ng']);

export function clientMatchesQuery(client, rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return true;

  // ⚠️注意：注意点が記入されているお客様
  if (CAUTION_WORDS.has(q)) return Boolean((client.ngTopics || '').trim());

  // 誕生日：誕生日が登録されているお客様
  if (q === '誕生日' || q === '🎂') return Boolean(parseBirthday(client.birthday));

  // 「N月」：その月が誕生月のお客様（テキスト一致もあわせて許可）
  const monthMatch = q.match(/^(\d{1,2})月$/);
  const birthday = parseBirthday(client.birthday);
  if (monthMatch && birthday && birthday.month === Number(monthMatch[1])) return true;

  // 通常のキーワード検索（カルテ全体＋タグ）
  const haystack = [
    client.name,
    client.kana,
    client.birthday,
    client.pressure,
    client.focusAreas,
    client.likes,
    client.ngTopics,
    client.notes,
    ...(client.tags || []),
  ]
    .filter(Boolean)
    .join('\n');
  return haystack.includes(q);
}

// 絞り込みチップ用フィルタ
//   filter: '' | 'birthday'（今月誕生日） | 'caution'（注意あり） | 'tag:タグ名'
export function clientMatchesFilter(client, filter, today) {
  if (!filter) return true;
  if (filter === 'caution') return Boolean((client.ngTopics || '').trim());
  if (filter === 'birthday') {
    const b = parseBirthday(client.birthday);
    return Boolean(b && b.month === Number(String(today).slice(5, 7)));
  }
  if (filter.startsWith('tag:')) {
    const tag = filter.slice(4);
    return (client.tags || []).includes(tag);
  }
  return true;
}
