import { useEffect, useRef, useState } from 'react';
import { StoreContext, useStoreProviderValue } from './lib/useStore.js';
import { loadLock } from './lib/lock.js';
import { syncReminderSnapshot, checkAndNotify } from './lib/reminders.js';
import LockScreen from './components/LockScreen.jsx';
import Home from './components/Home.jsx';
import Clients from './components/Clients.jsx';
import ClientDetail from './components/ClientDetail.jsx';
import VisitForm from './components/VisitForm.jsx';
import CalendarView from './components/CalendarView.jsx';
import Dashboard from './components/Dashboard.jsx';
import Consult from './components/Consult.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'home', label: 'ホーム', icon: '🏠' },
  { id: 'clients', label: 'お客様', icon: '👥' },
  { id: 'record', label: '記録', icon: '✍️' },
  { id: 'calendar', label: '予定', icon: '📅' },
  { id: 'consult', label: '相談', icon: '💡' },
  { id: 'stats', label: '分析', icon: '📊' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export default function App() {
  const store = useStoreProviderValue();
  // view: { tab, clientId?, presetClientId? }
  const [view, setView] = useState({ tab: 'home' });
  const [locked, setLocked] = useState(() => Boolean(loadLock()));
  const notifiedRef = useRef(false);

  // 通知用スナップショットを常に最新に保つ（Service Worker が参照する）
  useEffect(() => {
    syncReminderSnapshot(store.state);
  }, [store.state]);

  // アプリを開いた時に一度だけリマインダーをチェック
  useEffect(() => {
    if (locked || notifiedRef.current) return;
    if (!store.state.settings.notifications?.enabled) return;
    notifiedRef.current = true;
    checkAndNotify(store.state).catch(() => {});
  }, [locked, store.state]);

  const go = (tab, extra = {}) => setView({ tab, ...extra });
  const openClient = (clientId) => setView({ tab: 'clients', clientId });

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  let content;
  if (view.tab === 'home') {
    content = <Home onOpenClient={openClient} onRecord={() => go('record')} />;
  } else if (view.tab === 'clients') {
    content = view.clientId ? (
      <ClientDetail
        clientId={view.clientId}
        onBack={() => go('clients')}
        onRecord={(clientId) => go('record', { presetClientId: clientId })}
      />
    ) : (
      <Clients onOpenClient={openClient} />
    );
  } else if (view.tab === 'record') {
    content = (
      <VisitForm
        presetClientId={view.presetClientId}
        onSaved={(clientId) => openClient(clientId)}
      />
    );
  } else if (view.tab === 'calendar') {
    content = <CalendarView onOpenClient={openClient} />;
  } else if (view.tab === 'consult') {
    content = <Consult />;
  } else if (view.tab === 'stats') {
    content = <Dashboard onOpenClient={openClient} />;
  } else {
    content = <Settings />;
  }

  return (
    <StoreContext.Provider value={store}>
      <div className="app">
        <header className="app-header">
          <h1>
            <span className="logo">♨</span> 指名アップ手帳
          </h1>
          <p className="tagline">お客様を覚えて、また会いたい人になる</p>
        </header>
        <main className="app-main">{content}</main>
        <nav className="tabbar" aria-label="メインナビゲーション">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={view.tab === t.id ? 'tab active' : 'tab'}
              onClick={() => go(t.id)}
            >
              <span className="tab-icon" aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
