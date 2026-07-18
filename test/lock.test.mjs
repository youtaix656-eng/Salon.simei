import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, isValidPin, verifyPin } from '../src/lib/lock.js';

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
