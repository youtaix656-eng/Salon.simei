import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { todayStr } from '../lib/cycle.js';

export default function VisitForm({ presetClientId, onSaved }) {
  const { state, addVisit, addClient } = useStore();
  const { clients, visits } = state;

  const [clientId, setClientId] = useState(presetClientId || clients[0]?.id || '');
  const [newName, setNewName] = useState('');
  const [date, setDate] = useState(todayStr());
  const [menu, setMenu] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [nominated, setNominated] = useState(true);
  const [notes, setNotes] = useState('');
  const [talk, setTalk] = useState('');

  const isNewClient = clientId === '__new__';

  const menuOptions = useMemo(
    () => [...new Set(visits.map((v) => v.menu).filter(Boolean))],
    [visits]
  );

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

        <label className="field">
          <span>メニュー</span>
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
        </label>

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
