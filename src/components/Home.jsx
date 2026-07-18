import { useStore } from '../lib/useStore.js';
import { followUpStatus, STATUS_LABELS, todayStr } from '../lib/cycle.js';
import { monthProgress } from '../lib/stats.js';

// フォロー優先度：離反リスク → 超過 → そろそろ の順、同状態内では超過率の高い順
const STATUS_ORDER = { risk: 0, due: 1, soon: 2 };

export default function Home({ onOpenClient, onRecord }) {
  const { state } = useStore();
  const { clients, visits, settings } = state;
  const today = todayStr();

  const progress = monthProgress(visits, settings.monthlyGoal, today);

  const followUps = clients
    .map((c) => ({
      client: c,
      info: followUpStatus(
        visits.filter((v) => v.clientId === c.id).map((v) => v.date),
        today
      ),
    }))
    .filter((x) => x.info && x.info.status !== 'recent')
    .sort(
      (a, b) =>
        STATUS_ORDER[a.info.status] - STATUS_ORDER[b.info.status] ||
        b.info.ratio - a.info.ratio
    );

  const goalPercent = Math.round(progress.goalRatio * 100);

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

      <section className="card">
        <div className="card-title">フォローアップ推奨</div>
        {followUps.length === 0 ? (
          <p className="empty">
            {clients.length === 0
              ? 'まずは「お客様」タブからお客様を登録し、施術を記録しましょう。'
              : '今フォローが必要なお客様はいません。施術の記録を続けましょう 🌿'}
          </p>
        ) : (
          <ul className="list">
            {followUps.map(({ client, info }) => (
              <li key={client.id}>
                <button className="list-row" onClick={() => onOpenClient(client.id)}>
                  <div className="list-main">
                    <div className="list-name">{client.name} 様</div>
                    <div className="list-sub">
                      最終来店 {info.lastVisit}（{info.daysSince}日前）・通常
                      {info.intervalDays}日周期
                    </div>
                  </div>
                  <span className={`chip chip-${info.status}`}>
                    {STATUS_LABELS[info.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {followUps.length > 0 && (
          <p className="hint">
            タップするとお客様のカルテが開き、フォローメッセージを作成できます。
          </p>
        )}
      </section>

      <section className="card tips-card">
        <div className="card-title">指名を増やすヒント</div>
        <ul className="tips">
          <li>施術後24時間以内のお礼メッセージは再来店率を大きく上げます。</li>
          <li>前回の会話や好みをカルテに残し、次回の接客で一言添えましょう。</li>
          <li>「そろそろ来店時期」のお客様には先回りの声かけが効果的です。</li>
        </ul>
      </section>
    </div>
  );
}
