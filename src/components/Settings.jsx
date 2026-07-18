import { useRef, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { makeBackup, parseBackup, newId } from '../lib/storage.js';
import { DEFAULT_TEMPLATES } from '../lib/messages.js';
import { makeDemoData } from '../data/demoData.js';

export default function Settings() {
  const { state, updateSettings, replaceState, clearAll } = useStore();
  const { settings } = state;
  const fileRef = useRef(null);
  const [notice, setNotice] = useState('');

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const exportBackup = () => {
    const blob = new Blob([makeBackup(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salon-shimei-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('バックアップファイルを書き出しました');
  };

  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const next = parseBackup(await file.text());
      if (
        window.confirm(
          `バックアップを復元します。現在のデータ（お客様${state.clients.length}名・記録${state.visits.length}件）は上書きされます。よろしいですか？`
        )
      ) {
        replaceState(next);
        flash('バックアップを復元しました');
      }
    } catch (err) {
      window.alert(`読み込みに失敗しました：${err.message}`);
    }
  };

  const loadDemo = () => {
    if (
      state.clients.length === 0 ||
      window.confirm('デモデータを読み込むと現在のデータは上書きされます。よろしいですか？')
    ) {
      replaceState(makeDemoData());
      flash('デモデータを読み込みました');
    }
  };

  const wipe = () => {
    if (window.confirm('すべてのデータを削除します。この操作は取り消せません。よろしいですか？')) {
      clearAll();
      flash('すべてのデータを削除しました');
    }
  };

  const updateTemplate = (id, patch) =>
    updateSettings({
      templates: settings.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });

  const addTemplate = () =>
    updateSettings({
      templates: [
        ...settings.templates,
        { id: newId(), name: '新しいテンプレート', body: '{name}様\n\n' },
      ],
    });

  const removeTemplate = (id) => {
    if (settings.templates.length <= 1) return;
    updateSettings({ templates: settings.templates.filter((t) => t.id !== id) });
  };

  const resetTemplates = () => {
    if (window.confirm('テンプレートを初期状態に戻しますか？')) {
      updateSettings({ templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })) });
    }
  };

  return (
    <div className="page">
      {notice && <div className="notice">{notice}</div>}

      <section className="card form">
        <div className="card-title">基本設定</div>
        <label className="field">
          <span>あなたの名前（メッセージの差し込みに使用）</span>
          <input
            className="input"
            value={settings.therapistName}
            onChange={(e) => updateSettings({ therapistName: e.target.value })}
            placeholder="例：山田"
          />
        </label>
        <label className="field">
          <span>今月の指名目標（件）</span>
          <input
            type="number"
            className="input"
            min="0"
            value={settings.monthlyGoal}
            onChange={(e) => updateSettings({ monthlyGoal: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
      </section>

      <section className="card form">
        <div className="card-title-row">
          <div className="card-title">メッセージテンプレート</div>
          <button className="btn small" onClick={resetTemplates}>初期に戻す</button>
        </div>
        <p className="hint">
          {'{name}'}＝お客様名、{'{therapist}'}＝あなたの名前、{'{days}'}＝最終来店からの日数、
          {'{menu}'}＝前回メニュー が差し込まれます。
        </p>
        {settings.templates.map((t) => (
          <div key={t.id} className="template-editor">
            <div className="toolbar">
              <input
                className="input grow"
                value={t.name}
                onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
              />
              {settings.templates.length > 1 && (
                <button className="btn small danger-text" onClick={() => removeTemplate(t.id)}>
                  削除
                </button>
              )}
            </div>
            <textarea
              className="input"
              rows="5"
              value={t.body}
              onChange={(e) => updateTemplate(t.id, { body: e.target.value })}
            />
          </div>
        ))}
        <button className="btn" onClick={addTemplate}>＋ テンプレートを追加</button>
      </section>

      <section className="card form">
        <div className="card-title">バックアップと復元</div>
        <p className="hint">
          データはこの端末のブラウザ内にのみ保存されます。機種変更やブラウザの変更前に
          バックアップを書き出してください。
        </p>
        <div className="form-actions">
          <button className="btn" onClick={exportBackup}>📤 書き出す</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>📥 復元する</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importBackup}
          />
        </div>
      </section>

      <section className="card form">
        <div className="card-title">その他</div>
        <div className="form-actions">
          <button className="btn" onClick={loadDemo}>🌱 デモデータを読み込む</button>
          <button className="btn danger" onClick={wipe}>すべてのデータを削除</button>
        </div>
      </section>

      <p className="hint center">
        指名アップ手帳 — データは端末内（localStorage）にのみ保存され、外部送信されません。
      </p>
    </div>
  );
}
