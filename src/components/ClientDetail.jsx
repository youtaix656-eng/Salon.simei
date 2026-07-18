import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { followUpStatus, STATUS_LABELS, todayStr } from '../lib/cycle.js';
import { renderTemplate, buildMessageVars } from '../lib/messages.js';

const PRESSURES = ['よわめ', 'ふつう', 'つよめ'];

export default function ClientDetail({ clientId, onBack, onRecord }) {
  const { state, updateClient, deleteClient, deleteVisit } = useStore();
  const { visits, settings } = state;
  const client = state.clients.find((c) => c.id === clientId);

  const own = useMemo(
    () =>
      visits
        .filter((v) => v.clientId === clientId)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [visits, clientId]
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [templateId, setTemplateId] = useState(settings.templates[0]?.id || '');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (!client) {
    return (
      <div className="page">
        <button className="btn" onClick={onBack}>← 一覧へ戻る</button>
        <div className="card"><p className="empty">お客様が見つかりません。</p></div>
      </div>
    );
  }

  const info = followUpStatus(own.map((v) => v.date), todayStr());
  const nominatedCount = own.filter((v) => v.nominated).length;

  const startEdit = () => {
    setDraft({ ...client });
    setEditing(true);
  };
  const saveEdit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    updateClient(client.id, { ...draft, name: draft.name.trim() });
    setEditing(false);
  };

  const generateMessage = () => {
    const template = settings.templates.find((t) => t.id === templateId);
    if (!template) return;
    const vars = buildMessageVars(client, visits, settings);
    setMessage(renderTemplate(template.body, vars));
    setCopied(false);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境ではテキスト選択で代替してもらう
      setCopied(false);
    }
  };

  const removeClient = () => {
    if (window.confirm(`${client.name} 様のカルテと来店記録をすべて削除します。よろしいですか？`)) {
      deleteClient(client.id);
      onBack();
    }
  };

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={onBack}>← 一覧へ戻る</button>
        <button className="btn primary" onClick={() => onRecord(client.id)}>
          ✍️ 施術を記録
        </button>
      </div>

      <section className="card">
        <div className="detail-head">
          <div>
            <h2 className="detail-name">{client.name} 様</h2>
            {client.kana && <div className="kana">{client.kana}</div>}
          </div>
          {info && info.status !== 'recent' && (
            <span className={`chip chip-${info.status}`}>{STATUS_LABELS[info.status]}</span>
          )}
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{own.length}</div>
            <div className="stat-label">来店回数</div>
          </div>
          <div className="stat">
            <div className="stat-value">{nominatedCount}</div>
            <div className="stat-label">指名回数</div>
          </div>
          <div className="stat">
            <div className="stat-value">{info ? `${info.intervalDays}日` : '－'}</div>
            <div className="stat-label">来店周期</div>
          </div>
          <div className="stat">
            <div className="stat-value">{info ? info.expectedDate.slice(5).replace('-', '/') : '－'}</div>
            <div className="stat-label">次回目安</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <div className="card-title">カルテ</div>
          {!editing && <button className="btn small" onClick={startEdit}>編集</button>}
        </div>
        {editing ? (
          <form className="form" onSubmit={saveEdit}>
            <label className="field">
              <span>お名前</span>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>ふりがな</span>
              <input className="input" value={draft.kana} onChange={(e) => setDraft({ ...draft, kana: e.target.value })} />
            </label>
            <label className="field">
              <span>誕生日（例：08-02）</span>
              <input className="input" value={draft.birthday} onChange={(e) => setDraft({ ...draft, birthday: e.target.value })} placeholder="MM-DD" />
            </label>
            <label className="field">
              <span>圧の好み</span>
              <select className="input" value={draft.pressure} onChange={(e) => setDraft({ ...draft, pressure: e.target.value })}>
                <option value="">未設定</option>
                {PRESSURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">
              <span>気になる部位</span>
              <input className="input" value={draft.focusAreas} onChange={(e) => setDraft({ ...draft, focusAreas: e.target.value })} placeholder="例：肩甲骨まわり・首" />
            </label>
            <label className="field">
              <span>好きな話題・趣味</span>
              <input className="input" value={draft.likes} onChange={(e) => setDraft({ ...draft, likes: e.target.value })} placeholder="例：愛犬の話、カフェ巡り" />
            </label>
            <label className="field">
              <span>NG・注意点</span>
              <input className="input" value={draft.ngTopics} onChange={(e) => setDraft({ ...draft, ngTopics: e.target.value })} placeholder="例：仕事の話は控えめに" />
            </label>
            <label className="field">
              <span>メモ</span>
              <textarea className="input" rows="3" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setEditing(false)}>キャンセル</button>
              <button type="submit" className="btn primary">保存</button>
            </div>
          </form>
        ) : (
          <dl className="karte">
            <div><dt>誕生日</dt><dd>{client.birthday || '－'}</dd></div>
            <div><dt>圧の好み</dt><dd>{client.pressure || '－'}</dd></div>
            <div><dt>気になる部位</dt><dd>{client.focusAreas || '－'}</dd></div>
            <div><dt>好きな話題</dt><dd>{client.likes || '－'}</dd></div>
            <div><dt>NG・注意点</dt><dd>{client.ngTopics || '－'}</dd></div>
            <div><dt>メモ</dt><dd>{client.notes || '－'}</dd></div>
          </dl>
        )}
      </section>

      <section className="card">
        <div className="card-title">フォローメッセージ作成</div>
        <div className="toolbar">
          <select className="input grow" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {settings.templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button className="btn primary" onClick={generateMessage}>作成</button>
        </div>
        {message && (
          <>
            <textarea
              className="input message-preview"
              rows="8"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn primary" onClick={copyMessage}>
                {copied ? '✓ コピーしました' : '📋 コピーする'}
              </button>
            </div>
            <p className="hint">コピーして LINE やメールに貼り付けて送信してください。</p>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title">来店履歴</div>
        {own.length === 0 ? (
          <p className="empty">まだ来店記録がありません。</p>
        ) : (
          <ul className="visit-list">
            {own.map((v) => (
              <li key={v.id} className="visit-item">
                <div className="visit-head">
                  <span className="visit-date">{v.date}</span>
                  <span className={v.nominated ? 'chip chip-nominated' : 'chip chip-free'}>
                    {v.nominated ? '指名' : 'フリー'}
                  </span>
                  <button
                    className="btn small danger-text"
                    onClick={() => {
                      if (window.confirm('この来店記録を削除しますか？')) deleteVisit(v.id);
                    }}
                  >
                    削除
                  </button>
                </div>
                <div className="visit-body">
                  {v.menu || 'メニュー未記入'}
                  {v.minutes ? `（${v.minutes}分）` : ''}
                </div>
                {v.notes && <div className="visit-note">施術メモ：{v.notes}</div>}
                {v.talk && <div className="visit-note">会話メモ：{v.talk}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="danger-zone">
        <button className="btn danger" onClick={removeClient}>このお客様を削除</button>
      </div>
    </div>
  );
}
