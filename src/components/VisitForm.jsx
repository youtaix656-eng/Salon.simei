import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { todayStr } from '../lib/cycle.js';
import { groupMenusByCategory, menuLabel } from '../lib/menus.js';

export default function VisitForm({ presetClientId, onSaved }) {
  const { state, addVisit, addClient } = useStore();
  const { clients, visits, menus } = state;

  const [clientId, setClientId] = useState(presetClientId || clients[0]?.id || '');
  const [newName, setNewName] = useState('');
  const [date, setDate] = useState(todayStr());
  const [menuId, setMenuId] = useState(''); // '' | '__free__' | menu.id
  const [menu, setMenu] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [price, setPrice] = useState('');
  const [nominated, setNominated] = useState(true);
  const [notes, setNotes] = useState('');
  const [talk, setTalk] = useState('');

  const isNewClient = clientId === '__new__';

  // 選択中のお客様の前回来店（visits は日付昇順で保持されている）
  const lastVisit = useMemo(() => {
    if (!clientId || isNewClient) return null;
    const own = visits.filter((v) => v.clientId === clientId);
    return own.length ? own[own.length - 1] : null;
  }, [visits, clientId, isNewClient]);

  const menuGroups = useMemo(() => groupMenusByCategory(menus), [menus]);
  const showFreeInput = menus.length === 0 || menuId === '__free__';

  const selectMenu = (id) => {
    setMenuId(id);
    const selected = menus.find((m) => m.id === id);
    if (selected) {
      setMenu(selected.name);
      if (selected.minutes > 0) setMinutes(selected.minutes);
      if (selected.price > 0) setPrice(selected.price);
    } else {
      setMenu('');
    }
  };

  const menuOptions = useMemo(
    () => [...new Set(visits.map((v) => v.menu).filter(Boolean))],
    [visits]
  );

  // 前回の来店内容（メニュー・時間・料金・指名）をフォームに写す
  const copyLastVisit = () => {
    if (!lastVisit) return;
    const registered = menus.find((m) => m.name === lastVisit.menu);
    if (registered) setMenuId(registered.id);
    else if (menus.length && lastVisit.menu) setMenuId('__free__');
    setMenu(lastVisit.menu);
    if (lastVisit.minutes) setMinutes(lastVisit.minutes);
    if (lastVisit.price > 0) setPrice(lastVisit.price);
    setNominated(lastVisit.nominated);
  };

  const submit = (e) => {
    e.preventDefault();
    let targetId = clientId;
    if (isNewClient) {
      const name = newName.trim();
      if (!name) return;
      targetId = addClient({ name }).id;
    }
    if (!targetId) return;
    addVisit({
      clientId: targetId,
      date,
      menu: menu.trim(),
      minutes: Number(minutes) || 0,
      price: Math.max(0, Number(price) || 0),
      nominated,
      notes: notes.trim(),
      talk: talk.trim(),
    });
    onSaved(targetId);
  };

  return (
    <div className="page">
      <form className="card form" onSubmit={submit}>
        <div className="card-title">施術を記録する</div>

        <label className="field">
          <span>お客様</span>
          <select
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="" disabled>選択してください</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} 様{c.kana ? `（${c.kana}）` : ''}
              </option>
            ))}
            <option value="__new__">＋ 新しいお客様を登録して記録</option>
          </select>
        </label>

        {isNewClient && (
          <label className="field">
            <span>新しいお客様のお名前</span>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例：佐藤 美咲"
              required
            />
          </label>
        )}

        {lastVisit && (
          <div className="last-visit-hint">
            <span>
              前回 {lastVisit.date.slice(5).replace('-', '/')}：
              {lastVisit.menu || 'メニュー未記入'}
              {lastVisit.minutes ? `（${lastVisit.minutes}分）` : ''}
              {lastVisit.price > 0 ? ` ¥${lastVisit.price.toLocaleString()}` : ''}
            </span>
            <button type="button" className="btn small" onClick={copyLastVisit}>
              📋 前回と同じ内容にする
            </button>
          </div>
        )}

        <label className="field">
          <span>施術日</span>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>

        {menus.length > 0 && (
          <label className="field">
            <span>メニュー（カテゴリ順）</span>
            <select
              className="input"
              value={menuId}
              onChange={(e) => selectMenu(e.target.value)}
            >
              <option value="">選択してください（任意）</option>
              {menuGroups.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.items.map((m) => (
                    <option key={m.id} value={m.id}>{menuLabel(m)}</option>
                  ))}
                </optgroup>
              ))}
              <option value="__free__">✏️ その他（直接入力）</option>
            </select>
          </label>
        )}

        {showFreeInput && (
          <label className="field">
            <span>{menus.length > 0 ? 'メニューを直接入力' : 'メニュー'}</span>
            <input
              className="input"
              list="menu-options"
              value={menu}
              onChange={(e) => setMenu(e.target.value)}
              placeholder="例：ボディケア60分"
            />
            <datalist id="menu-options">
              {menuOptions.map((m) => <option key={m} value={m} />)}
            </datalist>
            {menus.length === 0 && (
              <span className="hint">
                「設定」タブの「施術メニュー」に登録すると、ここでカテゴリ順に選択できます。
              </span>
            )}
          </label>
        )}

        <label className="field">
          <span>施術時間（分）</span>
          <input
            type="number"
            className="input"
            min="0"
            step="5"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>

        <label className="field">
          <span>料金（円・任意）売上メモに集計されます</span>
          <input
            type="number"
            className="input"
            min="0"
            step="100"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="例：6600"
          />
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={nominated}
            onChange={(e) => setNominated(e.target.checked)}
          />
          <span>指名での来店</span>
        </label>

        <label className="field">
          <span>施術メモ（状態・行った施術）</span>
          <textarea
            className="input"
            rows="3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例：肩甲骨まわりの張りが強め。首のストレッチ追加。"
          />
        </label>

        <label className="field">
          <span>会話メモ（次回の話題づくりに）</span>
          <textarea
            className="input"
            rows="2"
            value={talk}
            onChange={(e) => setTalk(e.target.value)}
            placeholder="例：来月ご旅行の予定。愛犬の誕生日だったそう。"
          />
        </label>

        <button type="submit" className="btn primary block">
          保存する
        </button>
        <p className="hint">
          保存後はお客様のカルテが開きます。お礼メッセージもそのまま作成できます。
        </p>
      </form>
    </div>
  );
}
