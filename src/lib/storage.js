// 永続化（localStorage）とバックアップの読み書き。
// パース・正規化は純関数として切り出してテスト可能にしている。
import { DEFAULT_TEMPLATES } from './messages.js';
import { TIP_SEEDS } from '../data/tipSeeds.js';

export const STORAGE_KEY = 'salon-shimei-app-v1';
export const SCHEMA_VERSION = 1;
export const APP_ID = 'salon-shimei-app';

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function defaultSettings() {
  return {
    therapistName: '',
    monthlyGoal: 20,
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t })),
    ai: { provider: 'gemini', apiKey: '', model: '' },
  };
}

export function defaultTips() {
  return TIP_SEEDS.map((t) => ({ ...t }));
}

export function emptyState() {
  return { clients: [], visits: [], tips: defaultTips(), settings: defaultSettings() };
}

// 外部から来たデータ（localStorage / バックアップファイル）を安全な形に整える
export function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;

  if (Array.isArray(raw.clients)) {
    state.clients = raw.clients
      .filter((c) => c && typeof c === 'object' && c.name)
      .map((c) => ({
        id: String(c.id || newId()),
        name: String(c.name),
        kana: String(c.kana || ''),
        birthday: String(c.birthday || ''),
        pressure: String(c.pressure || ''),
        focusAreas: String(c.focusAreas || ''),
        likes: String(c.likes || ''),
        ngTopics: String(c.ngTopics || ''),
        notes: String(c.notes || ''),
        createdAt: String(c.createdAt || ''),
      }));
  }

  const clientIds = new Set(state.clients.map((c) => c.id));
  if (Array.isArray(raw.visits)) {
    state.visits = raw.visits
      .filter(
        (v) =>
          v &&
          typeof v === 'object' &&
          clientIds.has(String(v.clientId)) &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(v.date || ''))
      )
      .map((v) => ({
        id: String(v.id || newId()),
        clientId: String(v.clientId),
        date: String(v.date),
        menu: String(v.menu || ''),
        minutes: Number.isFinite(Number(v.minutes)) ? Number(v.minutes) : 0,
        price: Number.isFinite(Number(v.price)) && Number(v.price) > 0 ? Number(v.price) : 0,
        nominated: Boolean(v.nominated),
        notes: String(v.notes || ''),
        talk: String(v.talk || ''),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  // 対処法ノート：フィールド自体が無い（旧バージョンのデータ）場合は初期データを
  // 入れる。空配列は「全部削除した」状態として尊重する。
  if (Array.isArray(raw.tips)) {
    state.tips = raw.tips
      .filter((t) => t && typeof t === 'object' && t.symptom)
      .map((t) => ({
        id: String(t.id || newId()),
        category: String(t.category || 'その他'),
        symptom: String(t.symptom),
        approach: String(t.approach || ''),
      }));
  }

  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings;
    state.settings.therapistName = String(s.therapistName || '');
    const goal = Number(s.monthlyGoal);
    state.settings.monthlyGoal = Number.isFinite(goal) && goal >= 0 ? goal : 20;
    if (s.ai && typeof s.ai === 'object') {
      state.settings.ai = {
        provider: s.ai.provider === 'claude' ? 'claude' : 'gemini',
        apiKey: String(s.ai.apiKey || ''),
        model: String(s.ai.model || ''),
      };
    }
    if (Array.isArray(s.templates) && s.templates.length) {
      state.settings.templates = s.templates
        .filter((t) => t && typeof t === 'object' && t.body)
        .map((t) => ({
          id: String(t.id || newId()),
          name: String(t.name || '無題のテンプレート'),
          body: String(t.body),
        }));
      if (!state.settings.templates.length) {
        state.settings.templates = defaultSettings().templates;
      }
    }
  }
  return state;
}

export function loadState() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return emptyState();
    return normalizeState(JSON.parse(text));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 容量超過などは黙って無視（次回保存で再試行される）
  }
}

// バックアップファイル（JSON文字列）を作る。
// APIキーは共有・保管されるファイルに含めない（復元後に再設定してもらう）。
export function makeBackup(state, savedAt = new Date().toISOString()) {
  const data = {
    ...state,
    settings: {
      ...state.settings,
      ai: { ...(state.settings?.ai || {}), apiKey: '' },
    },
  };
  return JSON.stringify(
    { app: APP_ID, version: SCHEMA_VERSION, savedAt, data },
    null,
    2
  );
}

// バックアップファイルを読み込む。壊れていれば例外を投げる。
export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み込めないファイルです');
  }
  const data = raw && typeof raw === 'object' && raw.app === APP_ID ? raw.data : raw;
  if (!data || typeof data !== 'object' || (!Array.isArray(data.clients) && !Array.isArray(data.visits))) {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  return normalizeState(data);
}
