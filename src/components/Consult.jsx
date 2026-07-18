import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { TIP_CATEGORIES } from '../data/tipSeeds.js';
import { askAI, PROVIDERS, resolveModel } from '../lib/ai.js';

const ALL_CATEGORIES = [...TIP_CATEGORIES, 'その他'];

const QUICK_QUESTIONS = [
  'うつ伏せでおでこが痛くなるお客様への対処法は？',
  '初回のお客様に指名につなげる一言は？',
  '力を使わずに圧を深くするコツは？',
  '会話が続かないお客様への接し方は？',
];

// ---- 対処法ノート ----

function TipsView() {
  const { state, addTip, updateTip, deleteTip, restoreTipSeeds } = useStore();
  const { tips } = state;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState(null); // null | 'new' | tip.id
  const [draft, setDraft] = useState({ symptom: '', category: ALL_CATEGORIES[0], approach: '' });

  const filtered = useMemo(() => {
    const q = query.trim();
    return tips.filter(
      (t) =>
        (!category || t.category === category) &&
        (!q || t.symptom.includes(q) || t.approach.includes(q))
    );
  }, [tips, query, category]);

  const startNew = () => {
    setDraft({ symptom: '', category: ALL_CATEGORIES[0], approach: '' });
    setEditingId('new');
  };
  const startEdit = (tip) => {
    setDraft({ symptom: tip.symptom, category: tip.category, approach: tip.approach });
    setEditingId(tip.id);
  };
  const save = (e) => {
    e.preventDefault();
    if (!draft.symptom.trim()) return;
    const data = {
      symptom: draft.symptom.trim(),
      category: draft.category,
      approach: draft.approach.trim(),
    };
    if (editingId === 'new') addTip(data);
    else updateTip(editingId, data);
    setEditingId(null);
  };

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="input grow"
          placeholder="症状・キーワードで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn primary" onClick={startNew}>＋ 追加</button>
      </div>

      <div className="chip-filter">
        <button className={category === '' ? 'chip chip-select active' : 'chip chip-select'} onClick={() => setCategory('')}>
          すべて
        </button>
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c}
            className={category === c ? 'chip chip-select active' : 'chip chip-select'}
            onClick={() => setCategory(category === c ? '' : c)}
          >
            {c}
          </button>
        ))}
      </div>

      {editingId !== null && (
        <form className="card form" onSubmit={save}>
          <div className="card-title">{editingId === 'new' ? '対処法を追加' : '対処法を編集'}</div>
          <label className="field">
            <span>体の特徴・お悩み</span>
            <input
              className="input"
              value={draft.symptom}
              onChange={(e) => setDraft({ ...draft, symptom: e.target.value })}
              placeholder="例：うつ伏せでおでこが痛くなる方"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>カテゴリ</span>
            <select
              className="input"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>対処法（箇条書きがおすすめ）</span>
            <textarea
              className="input"
              rows="6"
              value={draft.approach}
              onChange={(e) => setDraft({ ...draft, approach: e.target.value })}
              placeholder={'・フェイスクッションの高さを調整\n・額にタオルを1枚足す'}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setEditingId(null)}>キャンセル</button>
            <button type="submit" className="btn primary">保存</button>
          </div>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <p className="empty">
            {tips.length === 0
              ? '対処法がまだありません。「＋ 追加」から登録するか、下のボタンで初期データを読み込めます。'
              : '条件に合う対処法が見つかりません。'}
          </p>
          {tips.length === 0 && (
            <button className="btn" onClick={restoreTipSeeds}>🌱 初期の対処法集を読み込む</button>
          )}
        </div>
      ) : (
        filtered.map((tip) => (
          <div key={tip.id} className="card tip-card">
            <div className="tip-head">
              <span className="chip chip-category">{tip.category}</span>
              <button className="btn small" onClick={() => startEdit(tip)}>編集</button>
              <button
                className="btn small danger-text"
                onClick={() => {
                  if (window.confirm('この対処法を削除しますか？')) deleteTip(tip.id);
                }}
              >
                削除
              </button>
            </div>
            <div className="tip-symptom">{tip.symptom}</div>
            <div className="tip-approach">{tip.approach}</div>
          </div>
        ))
      )}
      <p className="hint">
        ※リラクゼーションの範囲での工夫です。強い痛みや痺れが続く場合は施術を控え、医療機関の受診をおすすめしてください。
      </p>
    </>
  );
}

// ---- AI相談チャット ----

function AiChatView() {
  const { state } = useStore();
  const { settings } = state;
  const ai = settings.ai || {};
  const [chat, setChat] = useState([]); // {role: 'user'|'assistant', text}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const provider = PROVIDERS[ai.provider] || PROVIDERS.gemini;

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setError('');
    const nextChat = [...chat, { role: 'user', text: question }];
    setChat(nextChat);
    setLoading(true);
    try {
      // 直近5往復だけ送ってトークン消費を抑える
      const answer = await askAI(ai, nextChat.slice(-10), settings);
      setChat((c) => [...c, { role: 'assistant', text: answer }]);
    } catch (err) {
      setError(err?.message || '通信に失敗しました');
      setChat(nextChat);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  if (!ai.apiKey) {
    return (
      <div className="card">
        <div className="card-title">AI相談をはじめる</div>
        <p className="empty">
          施術や接客の悩みを、AIの「先輩セラピスト」に相談できる機能です。
          利用するには、設定画面でAIのAPIキーを登録してください。
        </p>
        <ol className="setup-steps">
          <li>
            <strong>{PROVIDERS.gemini.label}</strong>（おすすめ・無料枠あり）：
            {PROVIDERS.gemini.keyUrl} でAPIキーを作成
          </li>
          <li>または <strong>{PROVIDERS.claude.label}</strong>：{PROVIDERS.claude.keyUrl} で作成</li>
          <li>「設定」タブ →「AI相談の設定」にキーを貼り付け</li>
        </ol>
        <p className="hint">
          APIキーと相談内容は、この端末とお使いのAIプロバイダの間で直接やり取りされ、
          その他のサーバーには送信されません。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card chat-card">
        {chat.length === 0 && (
          <>
            <p className="empty">
              施術・接客・指名アップの悩みを相談できます。例えばこんな質問：
            </p>
            <div className="quick-questions">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} className="quick-q" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          </>
        )}
        <div className="chat-log">
          {chat.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'bubble user' : 'bubble assistant'}>
              {m.text}
            </div>
          ))}
          {loading && <div className="bubble assistant loading">考え中…</div>}
          <div ref={bottomRef} />
        </div>
        {error && <div className="chat-error">⚠️ {error}</div>}
        <form
          className="chat-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            className="input grow"
            rows="2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力（お客様の実名などの個人情報は書かないでください）"
          />
          <button type="submit" className="btn primary" disabled={loading || !input.trim()}>
            送信
          </button>
        </form>
        {chat.length > 0 && (
          <div className="form-actions">
            <button className="btn small" onClick={() => { setChat([]); setError(''); }}>
              会話をクリア
            </button>
          </div>
        )}
      </div>
      <p className="hint">
        {provider.label}（{resolveModel(ai)}）に接続中。会話はこの画面を離れると消えます。
        AIの回答は参考情報です。医療に関わる判断はしないでください。
      </p>
    </>
  );
}

export default function Consult() {
  const [mode, setMode] = useState('tips'); // tips | ai

  return (
    <div className="page">
      <div className="segment">
        <button className={mode === 'tips' ? 'seg active' : 'seg'} onClick={() => setMode('tips')}>
          💡 対処法ノート
        </button>
        <button className={mode === 'ai' ? 'seg active' : 'seg'} onClick={() => setMode('ai')}>
          🤖 AI相談
        </button>
      </div>
      {mode === 'tips' ? <TipsView /> : <AiChatView />}
    </div>
  );
}
