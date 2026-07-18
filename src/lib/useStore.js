// アプリ全体の状態管理。localStorage への保存は状態変更のたびに自動で行う。
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadState, saveState, newId, emptyState, defaultTips } from './storage.js';
import { todayStr } from './cycle.js';

const StoreContext = createContext(null);

export function useStoreProviderValue() {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return useMemo(() => {
    const addClient = (data) => {
      const client = {
        id: newId(),
        name: '',
        kana: '',
        birthday: '',
        pressure: '',
        focusAreas: '',
        likes: '',
        ngTopics: '',
        notes: '',
        createdAt: todayStr(),
        ...data,
      };
      setState((s) => ({ ...s, clients: [...s.clients, client] }));
      return client;
    };

    const updateClient = (id, patch) =>
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));

    const deleteClient = (id) =>
      setState((s) => ({
        ...s,
        clients: s.clients.filter((c) => c.id !== id),
        visits: s.visits.filter((v) => v.clientId !== id),
      }));

    const addVisit = (data) => {
      const visit = {
        id: newId(),
        clientId: '',
        date: todayStr(),
        menu: '',
        minutes: 60,
        price: 0,
        nominated: false,
        notes: '',
        talk: '',
        ...data,
      };
      setState((s) => ({
        ...s,
        visits: [...s.visits, visit].sort((a, b) => (a.date < b.date ? -1 : 1)),
      }));
      return visit;
    };

    const deleteVisit = (id) =>
      setState((s) => ({ ...s, visits: s.visits.filter((v) => v.id !== id) }));

    const updateSettings = (patch) =>
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

    const addTip = (data) => {
      const tip = { id: newId(), category: 'その他', symptom: '', approach: '', ...data };
      setState((s) => ({ ...s, tips: [tip, ...s.tips] }));
      return tip;
    };

    const updateTip = (id, patch) =>
      setState((s) => ({
        ...s,
        tips: s.tips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));

    const deleteTip = (id) =>
      setState((s) => ({ ...s, tips: s.tips.filter((t) => t.id !== id) }));

    const restoreTipSeeds = () =>
      setState((s) => {
        const existing = new Set(s.tips.map((t) => t.id));
        const missing = defaultTips().filter((t) => !existing.has(t.id));
        return { ...s, tips: [...s.tips, ...missing] };
      });

    const replaceState = (next) => setState(next);
    const clearAll = () => setState(emptyState());

    return {
      state,
      addClient,
      updateClient,
      deleteClient,
      addVisit,
      deleteVisit,
      updateSettings,
      addTip,
      updateTip,
      deleteTip,
      restoreTipSeeds,
      replaceState,
      clearAll,
    };
  }, [state]);
}

export { StoreContext };

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreContext');
  return store;
}
