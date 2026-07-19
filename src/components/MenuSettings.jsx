// 施術メニューの管理。ここで登録したメニューは「記録」タブでカテゴリ順に選択できる。
import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { groupMenusByCategory } from '../lib/menus.js';

export default function MenuSettings() {
  const { state, addMenu, updateMenu, deleteMenu } = useStore();
  const { menus } = state;
  const [editingId, setEditingId] = useState(null); // null | 'new' | menu.id
  const [draft, setDraft] = useState({ category: '', name: '', minutes: '', price: '' });

  const groups = useMemo(() => groupMenusByCategory(menus), [menus]);
  const categories = groups.map((g) => g.category).filter((c) => c !== 'その他');

  const startNew = () => {
    setDraft({ category: categories[0] || '', name: '', minutes: '', price: '' });
    setEditingId('new');
  };
  const startEdit = (menu) => {
    setDraft({
      category: menu.category === 'その他' ? '' : menu.category,
      name: menu.name,
      minutes: menu.minutes > 0 ? String(menu.minutes) : '',
      price: menu.price > 0 ? String(menu.price) : '',
    });
    setEditingId(menu.id);
  };
  const save = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const data = {
      category: draft.category.trim() || 'その他',
      name: draft.name.trim(),
      minutes: Math.max(0, Number(draft.minutes) || 0),
      price: Math.max(0, Number(draft.price) || 0),
    };
    if (editingId === 'new') addMenu(data);
    else updateMenu(editingId, data);
    setEditingId(null);
  };

  return (
    <section className="card form">
      <div className="card-title">💆 施術メニュー</div>
      <p className="hint">
        お店のメニューを登録しておくと、「記録」タブでカテゴリ順に選択でき、
        時間と料金も自動で入力されます。
      </p>

      {editingId !== null ? (
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>カテゴリ（例：ボディケア／アロマ／オプション）</span>
            <input
              className="input"
              list="menu-category-options"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="未入力なら「その他」になります"
            />
            <datalist id="menu-category-options">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="field">
            <span>メニュー名</span>
            <input
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="例：ボディケア60分"
              required
              autoFocus
            />
          </label>
          <div className="field-row">
            <label className="field grow">
              <span>時間（分）</span>
              <input
                type="number"
                className="input"
                min="0"
                step="5"
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                placeholder="60"
              />
            </label>
            <label className="field grow">
              <span>料金（円）</span>
              <input
                type="number"
                className="input"
                min="0"
                step="100"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="6600"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setEditingId(null)}>キャンセル</button>
            <button type="submit" className="btn primary">保存</button>
          </div>
        </form>
      ) : (
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn primary" onClick={startNew}>＋ メニューを追加</button>
        </div>
      )}

      {menus.length === 0 ? (
        <p className="empty">メニューがまだ登録されていません。</p>
      ) : (
        groups.map((group) => (
          <div key={group.category} className="menu-group">
            <div className="menu-group-title">{group.category}</div>
            {group.items.map((menu) => (
              <div key={menu.id} className="menu-row">
                <div className="menu-row-main">
                  <span className="menu-name">{menu.name}</span>
                  <span className="menu-meta">
                    {[
                      menu.minutes > 0 ? `${menu.minutes}分` : '',
                      menu.price > 0 ? `¥${menu.price.toLocaleString('ja-JP')}` : '',
                    ]
                      .filter(Boolean)
                      .join('・')}
                  </span>
                </div>
                <button className="btn small" onClick={() => startEdit(menu)}>編集</button>
                <button
                  className="btn small danger-text"
                  onClick={() => {
                    if (window.confirm(`「${menu.name}」を削除しますか？（過去の記録は残ります）`)) {
                      deleteMenu(menu.id);
                    }
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
