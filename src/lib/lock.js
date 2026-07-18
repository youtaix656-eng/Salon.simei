// アプリロック（4桁PIN）
// PINそのものは保存せず、ソルト付きSHA-256ハッシュのみを localStorage に保存する。
// バックアップファイルには含まれない（別キーで保存するため）。
// PINを忘れた場合の救済はデータ全消去のみ（個人情報保護のため）。

export const LOCK_KEY = 'salon-shimei-lock-v1';

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
}

export function disableLock() {
  localStorage.removeItem(LOCK_KEY);
}

export async function verifyPin(pin, lock = loadLock()) {
  if (!lock) return true; // ロック未設定
  if (!isValidPin(pin)) return false;
  return (await hashPin(pin, lock.salt)) === lock.hash;
}
