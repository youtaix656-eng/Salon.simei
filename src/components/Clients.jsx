import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { followUpStatus, STATUS_LABELS, todayStr } from '../lib/cycle.js';
import { clientMatchesQuery, clientMatchesFilter, collectTags } from '../lib/search.js';

export default function Clients({ onOpenClient }) {
  const { state, addClient } = useStore();
  const { clients, visits } = state;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(''); // '' | 'birthday' | 'caution' | 'tag:◯◯'
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', kana: '', notes: '' });
  const today = todayStr();

  const allTags = useMemo(() => collectTags(clients), [clients]);

  const rows = useMemo(() => {
    return clients
      .filter((c) => clientMatchesFilter(c, filter, today) && clientMatchesQuery(c, query))
      .map((c) => {
        const own = visits.filter((v) => v.clientId === c.id);
        return {
          client: c,
          visitCount: own.length,
          nominated: own.filter((v) => v.nominated).length,
          info: followUpStatus(own.map((v) => v.date), today),
        };
      })
      .sort((a, b) => {
        const al = a.info ? a.info.lastVisit : '';
        const bl = b.info ? b.info.lastVisit : '';
        return al < bl ? 1 : al > bl ? -1 : 0;
      });
  }, [clients, visits, query, filter, today]);

  const submit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const client = addClient({
      name,
      kana: form.kana.trim(),
      notes: form.notes.trim(),
    });
    setForm({ name: '', kana: '', notes: '' });
    setAdding(false);
    onOpenClient(client.id);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          className="input grow"
          placeholder="名前・メモ・タグ／「7月」「注意」でも検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn primary" onClick={() => setAdding((v) => !v)}>
          ＋ 新規
        </button>
      </div>

      <div className="chip-filter">
        <button
          className={filter === '' ? 'chip chip-select active' : 'chip chip-select'}
          onClick={() => setFilter('')}
        >
          すべて
        </button>
        <button
          className={filter === 'birthday' ? 'chip chip-select active' : 'chip chip-select'}
          onClick={() => setFilter(filter === 'birthday' ? '' : 'birthday')}
        >
          🎂 今月誕生日
        </button>
        <button
          className={filter === 'caution' ? 'chip chip-select active' : 'chip chip-select'}
          onClick={() => setFilter(filter === 'caution' ? '' : 'caution')}
        >
          ⚠️ 注意あり
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            className={filter === `tag:${tag}` ? 'chip chip-select active' : 'chip chip-select'}
            onClick={() => setFilter(filter === `tag:${tag}` ? '' : `tag:${tag}`)}
          >
            {tag}
          </button>
        ))}
      </div>

      {adding && (
        <form className="card form" onSubmit={submit}>
          <div className="card-title">新しいお客様</div>
          <label className="field">
            <span>お名前（必須）</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例：佐藤 美咲"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>ふりがな</span>
            <input
              className="input"
              value={form.kana}
              onChange={(e) => setForm({ ...form, kana: e.target.value })}
              placeholder="例：さとう みさき"
            />
          </label>
          <label className="field">
            <span>メモ</span>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="例：肩こりが気になるとのこと"
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              キャンセル
            </button>
            <button type="submit" className="btn primary">
              登録してカルテを開く
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <p className="empty">
            {clients.length === 0
              ? 'まだお客様が登録されていません。「＋ 新規」から登録しましょう。設定画面からデモデータを読み込んで試すこともできます。'
              : '検索条件に合うお客様が見つかりません。'}
          </p>
        </div>
      ) : (
        <ul className="list card">
          {rows.map(({ client, visitCount, nominated, info }) => (
            <li key={client.id}>
              <button className="list-row" onClick={() => onOpenClient(client.id)}>
                <div className="list-main">
                  <div className="list-name">
                    {client.name} 様
                    {client.kana && <span className="kana">（{client.kana}）</span>}
                    {(client.ngTopics || '').trim() && <span title="注意点あり"> ⚠️</span>}
                  </div>
                  {(client.tags || []).length > 0 && (
                    <div className="tag-row">
                      {client.tags.map((tag) => (
                        <span key={tag} className="chip chip-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="list-sub">
                    {info
                      ? `最終来店 ${info.lastVisit} ・ 来店${visitCount}回 ・ 指名${nominated}回`
                      : '来店記録なし'}
                  </div>
                </div>
                {info && info.status !== 'recent' && (
                  <span className={`chip chip-${info.status}`}>
                    {STATUS_LABELS[info.status]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
