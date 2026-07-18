// フォローアップメッセージのテンプレートと差し込み処理。
// 生成した文章はコピーして LINE やメールに貼り付けて使う想定
// （アプリ自体は外部送信を行わない）。
import { daysBetween, todayStr } from './cycle.js';

export const DEFAULT_TEMPLATES = [
  {
    id: 'thanks',
    name: 'ご来店お礼（当日〜翌日）',
    body:
      '{name}様\n\n本日はご来店いただき、ありがとうございました。\n{menu}のお疲れの具合はいかがでしょうか。施術後は水分を多めにとって、ゆっくりお休みくださいね。\n\n次回お越しの際も、今回の状態に合わせて調整いたします。ご予約の際は {therapist} 指名とお伝えいただけるとスムーズです。\nまたお会いできるのを楽しみにしております。',
  },
  {
    id: 'followup',
    name: 'そろそろ来店時期のご案内',
    body:
      '{name}様\n\nこんにちは、{therapist}です。\n前回のご来店から{days}日ほど経ちましたが、その後お身体の調子はいかがでしょうか。\nそろそろお疲れが溜まってくる頃かと思い、ご連絡いたしました。\n\n今週は比較的ご予約に空きがございます。ご都合の良い日時がありましたら、お気軽にお知らせください。',
  },
  {
    id: 'comeback',
    name: 'しばらくぶりのお客様へ',
    body:
      '{name}様\n\nお久しぶりです、{therapist}です。\n前回のご来店から{days}日が経ちました。お忙しくされているのではと、ふと思い出してご連絡しました。\n\n以前気にされていた箇所のケアも含めて、またゆっくりほぐしにいらしてください。お会いできる日を楽しみにしております。',
  },
  {
    id: 'birthday',
    name: 'お誕生日メッセージ',
    body:
      '{name}様\n\nお誕生日おめでとうございます！ {therapist}です。\n{name}様にとって素敵な一年になりますように。\n\n日頃の感謝を込めて、次回ご来店の際は誕生月の特別ケアをご用意してお待ちしております。ぜひご褒美の時間を作りにいらしてください。',
  },
];

// {key} 形式のプレースホルダを差し込む。未知のキーはそのまま残す。
export function renderTemplate(body, vars) {
  return String(body).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key) =>
    vars[key] != null ? String(vars[key]) : match
  );
}

// お客様と来店履歴から差し込み変数を組み立てる
export function buildMessageVars(client, visits, settings = {}, today = todayStr()) {
  const own = visits
    .filter((v) => v.clientId === client.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = own[own.length - 1] || null;
  return {
    name: client.name || 'お客',
    therapist: settings.therapistName || '担当セラピスト',
    days: last ? String(daysBetween(last.date, today)) : '－',
    menu: (last && last.menu) || '前回の施術',
    lastDate: last ? last.date : '',
  };
}
