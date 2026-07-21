import { useEffect, useState } from 'react';
import { verifyPin, disableLock, lockoutStatus, recordFailedAttempt, resetAttempts } from '../lib/lock.js';
import { STORAGE_KEY } from '../lib/storage.js';

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(() => lockoutStatus().remainingMs);

  // 連続誤入力によるロックアウト中は1秒ごとに残り時間を更新する
  useEffect(() => {
    const id = setInterval(() => setLockRemaining(lockoutStatus().remainingMs), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pin.length !== 4) return;
    let alive = true;
    verifyPin(pin).then((ok) => {
      if (!alive) return;
      if (ok) {
        resetAttempts();
        onUnlock();
      } else {
        recordFailedAttempt();
        setLockRemaining(lockoutStatus().remainingMs);
        setError(true);
        setTimeout(() => {
          if (alive) {
            setPin('');
            setError(false);
          }
        }, 600);
      }
    });
    return () => {
      alive = false;
    };
  }, [pin, onUnlock]);

  const locked = lockRemaining > 0;
  const lockedSeconds = Math.max(1, Math.ceil(lockRemaining / 1000));

  const press = (key) => {
    if (error || locked) return;
    if (key === '⌫') setPin((p) => p.slice(0, -1));
    else if (key && pin.length < 4) setPin((p) => p + key);
  };

  const forgot = () => {
    if (
      window.confirm('PINを忘れた場合、お客様情報を守るため全データを削除して初期化します。よろしいですか？') &&
      window.confirm('本当に削除しますか？ この操作は取り消せません。')
    ) {
      localStorage.removeItem(STORAGE_KEY);
      disableLock();
      location.reload();
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-logo">♨</div>
      <div className="lock-title">指名アップ手帳</div>
      <div className="lock-sub">
        {locked
          ? `🔒 誤入力が続いたため一時停止中（あと${lockedSeconds}秒）`
          : 'PINコードを入力してください'}
      </div>
      <div className={error ? 'pin-dots shake' : 'pin-dots'}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={pin.length > i ? 'pin-dot filled' : 'pin-dot'} />
        ))}
      </div>
      <div className={locked ? 'pin-pad locked' : 'pin-pad'}>
        {PAD.map((key, i) =>
          key === '' ? (
            <span key={i} />
          ) : (
            <button key={i} className="pin-key" onClick={() => press(key)} disabled={locked}>
              {key}
            </button>
          )
        )}
      </div>
      <button className="lock-forgot" onClick={forgot}>
        PINを忘れた場合（データを初期化）
      </button>
    </div>
  );
}
