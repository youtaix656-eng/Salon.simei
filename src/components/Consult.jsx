import { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { TIP_CATEGORIES } from '../data/tipSeeds.js';
import { SCRIPT_SCENES } from '../data/scriptSeeds.js';
import { fuzzyIncludes } from '../lib/search.js';
import {
  askAI,
  PROVIDERS,
  resolveModel,
  buildReviewReplyPrompt,
  buildScriptRephrasePrompt,
  buildScriptImportPrompt,
  parseScriptImportResponse,
} from '../lib/ai.js';

const ALL_CATEGORIES = [...TIP_CATEGORIES, 'その他'];

const QUICK_QUESTIONS = [
  '「気持ちよかった」と言われた瞬間、何て返せば指名につながる？',
  '施術後に次回予約につなげる声かけの流れは？',
  'SNSで新規のお客様に見つけてもらう発信のコツは？',
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
        (!q || fuzzyIncludes(`${t.symptom}\n${t.approach}`, q))
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
      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn small" onClick={restoreTipSeeds}>
          🌱 初期の対処法集で不足分を追加
        </button>
      </div>
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

// ---- 口コミ返信の例文作成 ----

function ReviewReplyView() {
  const { state } = useStore();
  const { settings } = state;
  const ai = settings.ai || {};
  const [review, setReview] = useState('');
  const [extra, setExtra] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async (regenerate = false) => {
    if (!review.trim() || loading) return;
    setLoading(true);
    setError('');
    setCopied(false);
    try {
      const prompt = buildReviewReplyPrompt(review, settings, {
        extra: [extra.trim(), regenerate ? '前回とは違う表現・構成で書いてください' : '']
          .filter(Boolean)
          .join('。'),
      });
      const answer = await askAI(ai, [{ role: 'user', text: prompt }], settings);
      setReply(answer);
    } catch (err) {
      setError(err?.message || '通信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!ai.apiKey) {
    return (
      <div className="card">
        <div className="card-title">口コミ返信の例文作成</div>
        <p className="empty">
          良い口コミにも悪い口コミにも、印象の良い返信文をAIが作成します。
          利用するには「設定」タブでAIのAPIキーを登録してください（Google Gemini は無料枠あり）。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card form">
        <div className="card-title">✍️ 口コミ返信の例文作成</div>
        <label className="field">
          <span>口コミを貼り付け（良い口コミ・悪い口コミどちらでもOK）</span>
          <textarea
            className="input"
            rows="5"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder={'例：とても丁寧な施術で肩が軽くなりました！\n例：受付の対応が残念でした。施術は良かったのですが…'}
          />
        </label>
        <label className="field">
          <span>返信の要望（任意）</span>
          <input
            className="input"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="例：カジュアルめに／次回クーポンの案内を入れる"
          />
        </label>
        <button
          className="btn primary block"
          onClick={() => generate(false)}
          disabled={loading || !review.trim()}
        >
          {loading ? '作成中…' : '返信文を作成'}
        </button>
        {error && <div className="chat-error">⚠️ {error}</div>}
        {reply && (
          <>
            <textarea
              className="input message-preview"
              rows="8"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn" onClick={() => generate(true)} disabled={loading}>
                🔄 別の案
              </button>
              <button className="btn primary" onClick={copyReply}>
                {copied ? '✓ コピーしました' : '📋 コピーする'}
              </button>
            </div>
          </>
        )}
      </div>
      <p className="hint">
        口コミにお客様の実名が含まれる場合は、貼り付ける前に伏せてください。
        生成された文章は必ず内容を確認・調整してから投稿しましょう。
      </p>
    </>
  );
}

// ---- トークスクリプト集 ----

function ScriptCard({ script, onEdit }) {
  const { state, updateScript, deleteScript } = useStore();
  const { settings } = state;
  const [copied, setCopied] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script.lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const rephrase = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const prompt = buildScriptRephrasePrompt(script, instruction, settings);
      const answer = await askAI(settings.ai, [{ role: 'user', text: prompt }], settings);
      setAiResult(answer);
    } catch (err) {
      setAiError(err?.message || '通信に失敗しました');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="card tip-card">
      <div className="tip-head">
        <span className="chip chip-category">{script.scene}</span>
        <button className="btn small" onClick={copy}>{copied ? '✓' : '📋 コピー'}</button>
        <button className="btn small" onClick={() => onEdit(script)}>編集</button>
        <button
          className="btn small danger-text"
          onClick={() => {
            if (window.confirm('このスクリプトを削除しますか？')) deleteScript(script.id);
          }}
        >
          削除
        </button>
      </div>
      <div className="tip-symptom">{script.title}</div>
      <div className="script-lines">「{script.lines}」</div>
      {script.point && <div className="script-point">🎯 {script.point}</div>}

      {settings.ai?.apiKey && (
        <div className="script-ai">
          {!aiOpen ? (
            <button className="btn small" onClick={() => setAiOpen(true)}>
              🤖 自分らしく言い換え
            </button>
          ) : (
            <>
              <div className="toolbar">
                <input
                  className="input grow"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="要望（例：もっとカジュアルに／関西弁で）"
                />
                <button className="btn primary small" onClick={rephrase} disabled={aiLoading}>
                  {aiLoading ? '…' : '生成'}
                </button>
              </div>
              {aiError && <div className="chat-error">⚠️ {aiError}</div>}
              {aiResult && (
                <>
                  <div className="ai-answer">{aiResult}</div>
                  <div className="form-actions">
                    <button
                      className="btn small"
                      onClick={() => {
                        updateScript(script.id, { lines: aiResult.trim() });
                        setAiResult('');
                        setAiOpen(false);
                      }}
                    >
                      このセリフに置き換える
                    </button>
                    <button className="btn small" onClick={() => { setAiResult(''); setAiOpen(false); }}>
                      閉じる
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 貼り付けたテキストをAIでスクリプトカードに整理して取り込むパネル
function ScriptImport({ onClose }) {
  const { state, addScript } = useStore();
  const { settings } = state;
  const ai = settings.ai || {};
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // null | scripts[]
  const [done, setDone] = useState(0);

  const runImport = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const prompt = buildScriptImportPrompt(text);
      const answer = await askAI(ai, [{ role: 'user', text: prompt }], settings);
      setPreview(parseScriptImportResponse(answer));
    } catch (err) {
      setError(err?.message || '通信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // AIを使わずに、貼り付けた全文を1件のスクリプトとして登録する
  const addAsSingle = () => {
    const body = text.trim();
    if (!body) return;
    const firstLine = body.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '無題';
    addScript({
      scene: 'こんな時',
      title: firstLine.slice(0, 24),
      lines: body,
      point: '',
    });
    setDone(1);
    setText('');
    setPreview(null);
  };

  const addAll = () => {
    for (const s of [...preview].reverse()) addScript(s);
    setDone(preview.length);
    setText('');
    setPreview(null);
  };

  return (
    <div className="card form">
      <div className="card-title">📥 トークスクリプトを貼り付けて取り込み</div>
      {done > 0 ? (
        <>
          <p className="empty">✅ {done}件のスクリプトを登録しました。接客の流れに合わせてシーン別に並びます。</p>
          <div className="form-actions">
            <button className="btn" onClick={() => setDone(0)}>続けて取り込む</button>
            <button className="btn primary" onClick={onClose}>閉じる</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            SNSや講座でメモしたトーク術を貼り付けると、AIがシーン別のスクリプトカードに整理して
            登録します。登録したスクリプトはこの端末に保存され、いつでも検索・編集できます。
          </p>
          <textarea
            className="input"
            rows="8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'ここにトークスクリプトの文章を貼り付け\n（セリフとその解説が入った文章ならOK）'}
          />
          {error && <div className="chat-error">⚠️ {error}</div>}
          {!preview ? (
            <div className="form-actions">
              <button className="btn" onClick={onClose}>閉じる</button>
              <button className="btn" onClick={addAsSingle} disabled={!text.trim() || loading}>
                そのまま1件で登録
              </button>
              {ai.apiKey ? (
                <button className="btn primary" onClick={runImport} disabled={!text.trim() || loading}>
                  {loading ? 'AIが整理中…' : '🤖 AIで整理して取り込む'}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <p className="hint">AIが{preview.length}件に整理しました。内容を確認して登録してください：</p>
              {preview.map((s, i) => (
                <div key={i} className="card tip-card">
                  <div className="tip-head">
                    <span className="chip chip-category">{s.scene}</span>
                  </div>
                  <div className="tip-symptom">{s.title}</div>
                  <div className="script-lines">「{s.lines}」</div>
                  {s.point && <div className="script-point">🎯 {s.point}</div>}
                </div>
              ))}
              <div className="form-actions">
                <button className="btn" onClick={() => setPreview(null)} disabled={loading}>
                  やり直す
                </button>
                <button className="btn primary" onClick={addAll}>
                  この{preview.length}件を登録する
                </button>
              </div>
            </>
          )}
          {!ai.apiKey && (
            <p className="hint">
              「設定」タブでAIのAPIキーを登録すると、貼り付けた文章をシーン・セリフ・狙いに
              自動で分けて取り込めます（未設定でも「そのまま1件で登録」は使えます）。
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ScriptsView() {
  const { state, addScript, updateScript, restoreScriptSeeds } = useStore();
  const { scripts } = state;
  const [query, setQuery] = useState('');
  const [scene, setScene] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null | 'new' | id
  const [draft, setDraft] = useState({ scene: SCRIPT_SCENES[0], title: '', lines: '', point: '' });

  const sceneOrder = (s) => {
    const i = SCRIPT_SCENES.indexOf(s);
    return i === -1 ? SCRIPT_SCENES.length : i;
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return scripts
      .filter(
        (s) =>
          (!scene || s.scene === scene) &&
          (!q || fuzzyIncludes(`${s.title}\n${s.lines}\n${s.point}`, q))
      )
      .slice()
      .sort((a, b) => sceneOrder(a.scene) - sceneOrder(b.scene));
  }, [scripts, query, scene]);

  const startNew = () => {
    setDraft({ scene: scene || SCRIPT_SCENES[0], title: '', lines: '', point: '' });
    setEditingId('new');
  };
  const startEdit = (script) => {
    setDraft({ scene: script.scene, title: script.title, lines: script.lines, point: script.point });
    setEditingId(script.id);
  };
  const save = (e) => {
    e.preventDefault();
    if (!draft.title.trim() && !draft.lines.trim()) return;
    const data = {
      scene: draft.scene,
      title: draft.title.trim() || '無題',
      lines: draft.lines.trim(),
      point: draft.point.trim(),
    };
    if (editingId === 'new') addScript(data);
    else updateScript(editingId, data);
    setEditingId(null);
  };

  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          className="input grow"
          placeholder="セリフ・シーンで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn primary" onClick={startNew}>＋ 追加</button>
      </div>

      <div className="chip-filter">
        <button
          className={scene === '' ? 'chip chip-select active' : 'chip chip-select'}
          onClick={() => setScene('')}
        >
          すべて
        </button>
        {SCRIPT_SCENES.map((s) => (
          <button
            key={s}
            className={scene === s ? 'chip chip-select active' : 'chip chip-select'}
            onClick={() => setScene(scene === s ? '' : s)}
          >
            {s}
          </button>
        ))}
      </div>

      {!importOpen ? (
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn small" onClick={() => setImportOpen(true)}>
            📥 トークスクリプトを貼り付けて取り込み
          </button>
        </div>
      ) : (
        <ScriptImport onClose={() => setImportOpen(false)} />
      )}

      {editingId !== null && (
        <form className="card form" onSubmit={save}>
          <div className="card-title">{editingId === 'new' ? 'スクリプトを追加' : 'スクリプトを編集'}</div>
          <label className="field">
            <span>シーン</span>
            <select
              className="input"
              value={draft.scene}
              onChange={(e) => setDraft({ ...draft, scene: e.target.value })}
            >
              {SCRIPT_SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">
            <span>タイトル</span>
            <input
              className="input"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例：次回予約のパス"
              autoFocus
            />
          </label>
          <label className="field">
            <span>セリフ</span>
            <textarea
              className="input"
              rows="4"
              value={draft.lines}
              onChange={(e) => setDraft({ ...draft, lines: e.target.value })}
              placeholder="例：次回のご予約、されていかれますか？"
            />
          </label>
          <label className="field">
            <span>狙い・ポイント（任意）</span>
            <input
              className="input"
              value={draft.point}
              onChange={(e) => setDraft({ ...draft, point: e.target.value })}
              placeholder="例：頻度＋理由とセットで伝える"
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
            {scripts.length === 0
              ? 'スクリプトがまだありません。「＋ 追加」から登録するか、下のボタンで初期データを読み込めます。'
              : '条件に合うスクリプトが見つかりません。'}
          </p>
        </div>
      ) : (
        filtered.map((script) => (
          <ScriptCard key={script.id} script={script} onEdit={startEdit} />
        ))
      )}
      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn small" onClick={restoreScriptSeeds}>
          🌱 初期のスクリプト集で不足分を追加
        </button>
      </div>
      <p className="hint">
        「◯◯」の部分はご自身のお店・お客様に合わせて言い換えてください。編集して自分専用のスクリプト帳に育てられます。
      </p>
    </>
  );
}

export default function Consult() {
  const [mode, setMode] = useState('tips'); // tips | ai | review | scripts

  return (
    <div className="page">
      <div className="segment">
        <button className={mode === 'tips' ? 'seg active' : 'seg'} onClick={() => setMode('tips')}>
          💡 対処法
        </button>
        <button className={mode === 'ai' ? 'seg active' : 'seg'} onClick={() => setMode('ai')}>
          🤖 AI相談
        </button>
        <button className={mode === 'scripts' ? 'seg active' : 'seg'} onClick={() => setMode('scripts')}>
          🗣 トーク集
        </button>
        <button className={mode === 'review' ? 'seg active' : 'seg'} onClick={() => setMode('review')}>
          ⭐ 口コミ返信
        </button>
      </div>
      {mode === 'tips' ? (
        <TipsView />
      ) : mode === 'scripts' ? (
        <ScriptsView />
      ) : mode === 'ai' ? (
        <AiChatView />
      ) : (
        <ReviewReplyView />
      )}
    </div>
  );
}
