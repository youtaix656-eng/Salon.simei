import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPin,
  isValidPin,
  verifyPin,
  lockoutStatus,
  recordFailedAttempt,
  resetAttempts,
  enableLock,
  disableLock,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
} from '../src/lib/lock.js';

// lock.js は localStorage を直接使うため、テスト用にメモリ実装をグローバルへ差し込む
async function withStubLocalStorage(fn) {
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    await fn();
  } finally {
    globalThis.localStorage = original;
  }
}

test('isValidPin: 4桁の数字のみ有効', () => {
  assert.ok(isValidPin('1234'));
  assert.ok(isValidPin('0000'));
  assert.ok(!isValidPin('123'));
  assert.ok(!isValidPin('12345'));
  assert.ok(!isValidPin('12a4'));
  assert.ok(!isValidPin(''));
});

test('hashPin: 同じPIN+ソルトは同じハッシュ、違えば異なる', async () => {
  const a = await hashPin('1234', 'salt1');
  const b = await hashPin('1234', 'salt1');
  const c = await hashPin('1234', 'salt2');
  const d = await hashPin('9999', 'salt1');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('verifyPin: ロック情報と照合できる', async () => {
  const salt = 'testsalt';
  const lock = { salt, hash: await hashPin('4321', salt) };
  assert.ok(await verifyPin('4321', lock));
  assert.ok(!(await verifyPin('0000', lock)));
  assert.ok(!(await verifyPin('abc', lock)));
  // ロック未設定なら常にtrue
  assert.ok(await verifyPin('anything', null));
});

// ---- 連続誤入力によるロックアウト ----

test('lockoutStatus: 初期状態はロックされていない', () =>
  withStubLocalStorage(() => {
    const status = lockoutStatus();
    assert.equal(status.locked, false);
    assert.equal(status.remainingMs, 0);
  }));

test('recordFailedAttempt: MAX_ATTEMPTS未満ではロックされない', () =>
  withStubLocalStorage(() => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailedAttempt();
    assert.equal(lockoutStatus().locked, false);
  }));

test('recordFailedAttempt: MAX_ATTEMPTS回連続で誤るとロックされる', () =>
  withStubLocalStorage(() => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedAttempt();
    const status = lockoutStatus();
    assert.equal(status.locked, true);
    assert.ok(status.remainingMs > 0 && status.remainingMs <= LOCKOUT_MS);
  }));

test('resetAttempts: ロック状態をクリアできる', () =>
  withStubLocalStorage(() => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedAttempt();
    assert.equal(lockoutStatus().locked, true);
    resetAttempts();
    assert.equal(lockoutStatus().locked, false);
  }));

test('enableLock / disableLock: 呼ぶと試行回数がリセットされる', () =>
  withStubLocalStorage(async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedAttempt();
    assert.equal(lockoutStatus().locked, true);
    await enableLock('1234');
    assert.equal(lockoutStatus().locked, false);

    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailedAttempt();
    assert.equal(lockoutStatus().locked, true);
    disableLock();
    assert.equal(lockoutStatus().locked, false);
  }));
