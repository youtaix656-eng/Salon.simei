// 動作確認用のデモデータ。今日を基準に相対的な日付で生成するので、
// いつ読み込んでも「そろそろ来店時期」「離反リスク」などの状態が再現される。
import { addDays, todayStr } from '../lib/cycle.js';
import { normalizeState, defaultSettings } from '../lib/storage.js';

export function makeDemoData(today = todayStr()) {
  const d = (daysAgo) => addDays(today, -daysAgo);
  const thisMonth = today.slice(5, 7); // デモ用：今月の誕生日を再現
  let seq = 0;
  const id = () => `demo-${++seq}`;

  const clients = [
    {
      id: 'demo-c1',
      name: '佐藤 美咲',
      kana: 'さとう みさき',
      birthday: `${thisMonth}-25`,
      pressure: 'つよめ',
      focusAreas: '肩甲骨まわり・首',
      likes: '愛犬（トイプードル）の話。ハーブティー好き。',
      ngTopics: '仕事の話は疲れるので控えめに',
      notes: 'デスクワークで肩こりが慢性化。照明は暗めが好み。',
      createdAt: d(150),
    },
    {
      id: 'demo-c2',
      name: '田中 由香里',
      kana: 'たなか ゆかり',
      birthday: '11-20',
      pressure: 'ふつう',
      focusAreas: '腰・ふくらはぎ',
      likes: '韓国ドラマ。子どもの受験の話題。',
      ngTopics: '',
      notes: '立ち仕事。月1ペースで通ってくださる。',
      createdAt: d(140),
    },
    {
      id: 'demo-c3',
      name: '鈴木 恵',
      kana: 'すずき めぐみ',
      birthday: '03-15',
      pressure: 'よわめ',
      focusAreas: '頭・目のまわり',
      likes: 'ヨガ・カフェ巡り',
      ngTopics: '',
      notes: '眼精疲労がひどい。会話少なめでゆっくりしたい方。',
      createdAt: d(120),
    },
    {
      id: 'demo-c4',
      name: '高橋 直子',
      kana: 'たかはし なおこ',
      birthday: '',
      pressure: 'つよめ',
      focusAreas: '背中全体',
      likes: '旅行の話。温泉好き。',
      ngTopics: '',
      notes: '前回、次回は延長コースを検討中とのこと。',
      createdAt: d(95),
    },
    {
      id: 'demo-c5',
      name: '山本 健一',
      kana: 'やまもと けんいち',
      birthday: `${thisMonth}-03`,
      pressure: 'つよめ',
      focusAreas: '腰・太もも',
      likes: 'ゴルフ・ランニング',
      ngTopics: '',
      notes: 'ランニング後のケアで利用。土日午前が多い。',
      createdAt: d(80),
    },
    {
      id: 'demo-c6',
      name: '伊藤 さくら',
      kana: 'いとう さくら',
      birthday: '01-09',
      pressure: 'ふつう',
      focusAreas: '肩・腕',
      likes: '美容・ネイルの話',
      ngTopics: '',
      notes: '初回はフリーで来店。2回目から指名してくださった。',
      createdAt: d(60),
    },
    {
      id: 'demo-c7',
      name: '中村 亜矢',
      kana: 'なかむら あや',
      birthday: '',
      pressure: 'ふつう',
      focusAreas: '首・肩',
      likes: '',
      ngTopics: '',
      notes: '初回のみ来店。フォロー未実施。',
      createdAt: d(70),
    },
  ];

  const visit = (clientId, daysAgo, menu, minutes, nominated, notes = '', talk = '') => ({
    id: id(),
    clientId,
    date: d(daysAgo),
    menu,
    minutes,
    price: minutes * 110, // デモ用のダミー料金
    nominated,
    notes,
    talk,
  });

  const visits = [
    // 佐藤様：28日周期の常連。ちょうど「そろそろ来店時期」
    visit('demo-c1', 150, 'ボディケア60分', 60, false, '初回。肩甲骨まわり重点。'),
    visit('demo-c1', 122, 'ボディケア60分', 60, true, '前回より肩の張りやわらぐ。'),
    visit('demo-c1', 94, 'ボディケア90分', 90, true, '首のストレッチ追加。'),
    visit('demo-c1', 66, 'ボディケア90分', 90, true),
    visit('demo-c1', 38, 'ボディケア90分', 90, true, '仕事繁忙期で張り強め。', '愛犬の誕生日だったそう'),
    // 田中様：来店直後
    visit('demo-c2', 130, 'フットケア40分＋ボディ40分', 80, false),
    visit('demo-c2', 100, 'フットケア40分＋ボディ40分', 80, true),
    visit('demo-c2', 68, 'ボディケア60分', 60, true),
    visit('demo-c2', 35, 'ボディケア60分', 60, true),
    visit('demo-c2', 5, 'ボディケア60分', 60, true, '腰の張り軽め。', '受験が一段落したとのこと'),
    // 鈴木様：サイクル超過（フォロー推奨）
    visit('demo-c3', 115, 'ヘッドスパ45分', 45, false),
    visit('demo-c3', 85, 'ヘッドスパ45分', 45, true),
    visit('demo-c3', 55, 'ヘッドスパ60分', 60, true, '目の疲れ強め。ホットタオル追加。'),
    // 高橋様：離反リスク（2倍超過）
    visit('demo-c4', 95, 'ボディケア60分', 60, false),
    visit('demo-c4', 70, 'ボディケア60分', 60, true, '次回は90分を検討中とのこと。'),
    // 山本様：3週間周期で通う
    visit('demo-c5', 80, 'スポーツケア60分', 60, false),
    visit('demo-c5', 59, 'スポーツケア60分', 60, true),
    visit('demo-c5', 40, 'スポーツケア60分', 60, true),
    visit('demo-c5', 19, 'スポーツケア60分', 60, true, '大会前で入念に。', '来月ゴルフコンペ'),
    // 伊藤様：フリー→指名に転換
    visit('demo-c6', 60, 'アロマトリートメント60分', 60, false, '初回フリー来店。'),
    visit('demo-c6', 30, 'アロマトリートメント60分', 60, true, '指名で再来店！'),
    // 中村様：初回のみ・要フォロー
    visit('demo-c7', 45, 'ボディケア40分', 40, false, '初回。お試し利用。'),
  ];

  return normalizeState({
    clients,
    visits,
    settings: {
      ...defaultSettings(),
      therapistName: '（あなたの名前）',
      monthlyGoal: 15,
    },
  });
}
