import { useStore } from '../lib/useStore.js';
import { todayStr } from '../lib/cycle.js';
import { monthProgress, birthdaysInMonth } from '../lib/stats.js';

export default function Home({ onOpenClient, onRecord }) {
  const { state } = useStore();
  const { clients, visits, settings } = state;
  const today = todayStr();

  const progress = monthProgress(visits, settings.monthlyGoal, today);
  const goalPercent = Math.round(progress.goalRatio * 100);
  const birthdays = birthdaysInMonth(clients, today);
  const todayDay = Number(today.slice(8, 10));

  return (
    <div className="page">
      <section className="card goal-card">
        <div className="card-title">今月の指名</div>
        <div className="goal-numbers">
          <span className="big-number">{progress.nominated}</span>
          <span className="goal-target">/ 目標 {progress.goal} 件</span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={goalPercent} aria-valuemin="0" aria-valuemax="100">
          <div className="progress-fill" style={{ width: `${goalPercent}%` }} />
        </div>
        <div className="goal-sub">
          今月の施術 {progress.total} 件 ／ 指名率{' '}
          {progress.total ? Math.round(progress.rate * 100) : 0}%
        </div>
      </section>

      <button className="btn primary block" onClick={onRecord}>
        ✍️ 施術を記録する
      </button>

      {birthdays.length > 0 && (
        <section className="card birthday-card">
          <div className="card-title">🎂 今月お誕生日のお客様</div>
          <ul className="list">
            {birthdays.map(({ client, month, day }) => (
              <li key={client.id}>
                <button className="list-row" onClick={() => onOpenClient(client.id)}>
                  <div className="list-main">
                    <div className="list-name">{client.name} 様</div>
                    <div className="list-sub">
                      {month}月{day}日
                      {day === todayDay && ' — 今日がお誕生日です！'}
                    </div>
                  </div>
                  <span className="chip chip-birthday">
                    {day === todayDay ? '🎉 今日' : day < todayDay ? '済' : `${day - todayDay}日後`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">タップするとお客様のカルテが開きます。</p>
        </section>
      )}

      {clients.length === 0 && (
        <section className="card">
          <p className="empty">
            まずは「お客様」タブからお客様を登録し、施術を記録しましょう。
            設定画面からデモデータを読み込んで試すこともできます。
          </p>
        </section>
      )}
    </div>
  );
}
