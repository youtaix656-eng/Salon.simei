// 施術メニューの表示用ロジック（純関数）。
// カテゴリは登録順を保ち、「その他」だけ最後に回す。

export function groupMenusByCategory(menus = []) {
  const groups = [];
  const byCategory = new Map();
  for (const menu of menus) {
    const category = menu.category || 'その他';
    let group = byCategory.get(category);
    if (!group) {
      group = { category, items: [] };
      byCategory.set(category, group);
      groups.push(group);
    }
    group.items.push(menu);
  }
  return groups.sort(
    (a, b) => (a.category === 'その他' ? 1 : 0) - (b.category === 'その他' ? 1 : 0)
  );
}

export function menuLabel(menu) {
  const meta = [
    menu.minutes > 0 ? `${menu.minutes}分` : '',
    menu.price > 0 ? `¥${Number(menu.price).toLocaleString('ja-JP')}` : '',
  ]
    .filter(Boolean)
    .join('・');
  return meta ? `${menu.name}（${meta}）` : menu.name;
}
