import { useRef, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { makeBackup, parseBackup } from '../lib/storage.js';
import { PROVIDERS } from '../lib/ai.js';
import { makeDemoData } from '../data/demoData.js';
import { enableNotifications } from '../lib/reminders.js';
import { loadLock, enableLock, disableLock, verifyPin, isValidPin } from '../lib/lock.js';
import MenuSettings from './MenuSettings.jsx';

export default function Settings() {
  const { state, updateSettings, replaceState, clearAll } = useStore();
  const { settings } = state;
  const fileRef = useRef(null);
  const [notice, setNotice] = useState('');
  const [notifyStatus, setNotifyStatus] = useState('');
  const [lockEnabled, setLockEnabled] = useState(() => Boolean(loadLock()));
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3000);
  };

  const turnOnNotifications = async () => {
    try {
      const result = await enableNotifications();
      updateSettings({ notifications: { enabled: true } });
      setNotifyStatus(
        result.background
          ? 'バックグラウンド通知に対応しています（アプリを閉じていても通知されます）'
          : 'この端末はアプリを開いた時に通知します（バックグラウンド通知はAndroidのインストール済みPWAのみ対応）'
      );
      flash('リマインダー通知を有効にしました');
    } catch (err) {
      setNotifyStatus(`⚠️ ${err.message}`);
    }
  };

  const turnOffNotifications = () => {
    updateSettings({ notifications: { enabled: false } });
    setNotifyStatus('');
    flash('リマインダー通知を無効にしました');
  };

  const setupLock = async () => {
    if (!isValidPin(pin1)) {
      flash('PINは4桁の数字で入力してください');
      return;
    }
    if (pin1 !== pin2) {
      flash('確認用のPINが一致しません');
      return;
    }
    await enableLock(pin1);
    setLockEnabled(true);
    setPin1('');
    setPin2('');
    flash('PINロックを設定しました（次回起動時から有効）');
  };

  const removeLock = async () => {
    const current = window.prompt('現在のPINを入力してください');
    if (current == null) return;
    if (await verifyPin(current)) {
      disableLock();
      setLockEnabled(false);
      flash('PINロックを解除しました');
    } else {
      flash('PINが違います');
    }
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
      const demo = makeDemoData();
      // 設定済みのAI設定（APIキー等）は引き継ぐ
      replaceState({ ...demo, settings: { ...demo.settings, ai: state.settings.ai } });
      flash('デモデータを読み込みました');
    }
  };

  const wipe = () => {
    if (window.confirm('すべてのデータを削除します。この操作は取り消せません。よろしいですか？')) {
      clearAll();
      flash('すべてのデータを削除しました');
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

      <MenuSettings />

      <section className="card form">
        <div className="card-title">🔔 リマインダー通知</div>
        <p className="hint">
          「そろそろ来店時期」「今日がお誕生日」のお客様を通知でお知らせします。
          iPhoneはアプリを開いた時のみ、Androidのインストール済みPWAはバックグラウンドでも通知できます。
        </p>
        <div className="form-actions">
          {settings.notifications?.enabled ? (
            <button className="btn" onClick={turnOffNotifications}>通知を無効にする</button>
          ) : (
            <button className="btn primary" onClick={turnOnNotifications}>🔔 通知を有効にする</button>
          )}
        </div>
        {notifyStatus && <p className="hint">{notifyStatus}</p>}
      </section>

      <section className="card form">
        <div className="card-title">🔐 アプリロック（4桁PIN）</div>
        <p className="hint">
          アプリを開くときにPINコードを要求します。お客様情報の保護のため設定をおすすめします。
          PINを忘れた場合はデータの初期化が必要になるのでご注意ください。
        </p>
        {lockEnabled ? (
          <div className="form-actions">
            <button className="btn" onClick={removeLock}>ロックを解除（無効化）</button>
          </div>
        ) : (
          <>
            <label className="field">
              <span>新しいPIN（4桁の数字）</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                className="input"
                value={pin1}
                onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
              />
            </label>
            <label className="field">
              <span>確認のためもう一度</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                className="input"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
              />
            </label>
            <div className="form-actions">
              <button className="btn primary" onClick={setupLock}>🔐 ロックを設定</button>
            </div>
          </>
        )}
      </section>

      <section className="card form">
        <div className="card-title">AI相談の設定</div>
        <p className="hint">
          「相談」タブのAI相談機能で使うAPIキーを設定します。キーはこの端末のブラウザ内にのみ
          保存され、選択したAIプロバイダ以外には送信されません（バックアップファイルにも含まれません）。
        </p>
        <label className="field">
          <span>AIプロバイダ</span>
          <select
            className="input"
            value={settings.ai?.provider || 'gemini'}
            onChange={(e) => updateSettings({ ai: { ...settings.ai, provider: e.target.value } })}
          >
            {Object.values(PROVIDERS).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <p className="hint">{(PROVIDERS[settings.ai?.provider] || PROVIDERS.gemini).keyHint}
          {' '}取得先：{(PROVIDERS[settings.ai?.provider] || PROVIDERS.gemini).keyUrl}
        </p>
        <label className="field">
          <span>APIキー</span>
          <input
            type="password"
            className="input"
            value={settings.ai?.apiKey || ''}
            onChange={(e) => updateSettings({ ai: { ...settings.ai, apiKey: e.target.value.trim() } })}
            placeholder="APIキーを貼り付け"
            autoComplete="off"
          />
        </label>
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
        <br />
        <a href="./privacy.html" target="_blank" rel="noreferrer">プライバシーポリシー</a>
      </p>
    </div>
  );
}
