// アプリロック（4桁PIN）
// PINそのものは保存せず、ソルト付きSHA-256ハッシュのみを localStorage に保存する。
// バックアップファイルには含まれない（別キーで保存するため）。
// PINを忘れた場合の救済はデータ全消去のみ（個人情報保護のため）。

export const LOCK_KEY = 'salon-shimei-lock-v1';

// 連続誤入力によるロックアウト（総当たり対策）。
// PIN自体とは別キーで保存し、バックアップには含まれない。
export const ATTEMPTS_KEY = 'salon-shimei-lock-attempts-v1';
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30 * 1000;

export function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

export function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadLock() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCK_KEY));
    if (raw && typeof raw === 'object' && raw.salt && raw.hash) return raw;
  } catch {
    /* 壊れたデータはロックなし扱い */
  }
  return null;
}

export async function enableLock(pin) {
  if (!isValidPin(pin)) throw new Error('PINは4桁の数字で設定してください');
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash }));
  resetAttempts();
}

export function disableLock() {
  localStorage.removeItem(LOCK_KEY);
  resetAttempts();
}

export async function verifyPin(pin, lock = loadLock()) {
  if (!lock) return true; // ロック未設定
  if (!isValidPin(pin)) return false;
  return (await hashPin(pin, lock.salt)) === lock.hash;
}

// ---- 連続誤入力によるロックアウト ----

function loadAttempts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ATTEMPTS_KEY));
    if (raw && typeof raw === 'object') {
      return { count: Number(raw.count) || 0, lockedUntil: Number(raw.lockedUntil) || 0 };
    }
  } catch {
    /* 壊れたデータは未ロック扱い */
  }
  return { count: 0, lockedUntil: 0 };
}

function saveAttempts(attempts) {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

// 現在ロックアウト中かどうかと、残り時間（ミリ秒）
export function lockoutStatus(now = Date.now()) {
  const { lockedUntil } = loadAttempts();
  if (lockedUntil > now) return { locked: true, remainingMs: lockedUntil - now };
  return { locked: false, remainingMs: 0 };
}

// 誤入力のたびに呼ぶ。MAX_ATTEMPTS 回連続で誤ると LOCKOUT_MS の間ロックする。
export function recordFailedAttempt(now = Date.now()) {
  const { count } = loadAttempts();
  const next = count + 1;
  if (next >= MAX_ATTEMPTS) {
    saveAttempts({ count: 0, lockedUntil: now + LOCKOUT_MS });
  } else {
    saveAttempts({ count: next, lockedUntil: 0 });
  }
}

// 正しいPINが入力できた時・PINを設定/解除した時に呼ぶ
export function resetAttempts() {
  saveAttempts({ count: 0, lockedUntil: 0 });
}
