import { useStore } from '../lib/useStore.js';
import { todayStr } from '../lib/cycle.js';
import {
  monthlyStats,
  monthProgress,
  repeatStats,
  clientRanking,
  overallAverageInterval,
  revenueStats,
} from '../lib/stats.js';

// 依存ライブラリなしの SVG 棒グラフ（来店数と指名数の重ね棒 + 指名率ラベル）
function MonthlyChart({ data }) {
  const W = 320;
  const H = 150;
  const pad = { top: 24, bottom: 22, left: 8, right: 8 };
  const max = Math.max(1, ...data.map((d) => d.total));
  const bw = (W - pad.left - pad.right) / data.length;
  const scale = (v) => (v / max) * (H - pad.top - pad.bottom);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="月別の来店数と指名数">
      {data.map((d, i) => {
        const x = pad.left + i * bw;
        const totalH = scale(d.total);
        const nomH = scale(d.nominated);
        const baseY = H - pad.bottom;
        return (
          <g key={d.key}>
            <rect
              x={x + bw * 0.18}
              y={baseY - totalH}
              width={bw * 0.64}
              height={totalH}
              rx="3"
              className="bar-total"
            />
            <rect
              x={x + bw * 0.18}
              y={baseY - nomH}
              width={bw * 0.64}
              height={nomH}
              rx="3"
              className="bar-nominated"
            />
            {d.total > 0 && (
              <text x={x + bw / 2} y={baseY - totalH - 6} textAnchor="middle" className="chart-rate">
                {Math.round(d.rate * 100)}%
              </text>
            )}
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="chart-label">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard({ onOpenClient }) {
  const { state } = useStore();
  const { clients, visits, settings } = state;
  const today = todayStr();

  const monthly = monthlyStats(visits, 6, today);
  const progress = monthProgress(visits, settings.monthlyGoal, today);
  const repeat = repeatStats(visits);
  const ranking = clientRanking(clients, visits, 5);
  const avgInterval = overallAverageInterval(clients, visits);
  const revenue = revenueStats(visits, today);

  return (
    <div className="page">
      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-value">{progress.nominated}<span className="unit">件</span></div>
          <div className="stat-label">今月の指名</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">
            {progress.total ? Math.round(progress.rate * 100) : 0}
            <span className="unit">%</span>
          </div>
          <div className="stat-label">今月の指名率</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">
            {repeat.visited ? Math.round(repeat.rate * 100) : 0}
            <span className="unit">%</span>
          </div>
          <div className="stat-label">リピート率</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">
            {avgInterval != null ? Math.round(avgInterval) : '－'}
            <span className="unit">日</span>
          </div>
          <div className="stat-label">平均来店周期</div>
        </div>
      </div>

      <section className="card">
        <div className="card-title">💰 今月の売上メモ</div>
        {revenue.recorded === 0 ? (
          <p className="empty">
            施術の記録で「料金」を入力すると、売上と指名による売上効果がここに集計されます。
          </p>
        ) : (
          <>
            <div className="stat-row stat-row-3">
              <div className="stat">
                <div className="stat-value">¥{revenue.total.toLocaleString()}</div>
                <div className="stat-label">売上合計</div>
              </div>
              <div className="stat">
                <div className="stat-value">¥{revenue.nominated.toLocaleString()}</div>
                <div className="stat-label">うち指名</div>
              </div>
              <div className="stat">
                <div className="stat-value">¥{revenue.average.toLocaleString()}</div>
                <div className="stat-label">平均単価</div>
              </div>
            </div>
            <p className="hint">
              売上の {Math.round(revenue.nominatedShare * 100)}% が指名によるものです
              （料金入力済み {revenue.recorded} 件の集計）。
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title">月別の来店数と指名率（直近6ヶ月）</div>
        {visits.length === 0 ? (
          <p className="empty">施術を記録するとグラフが表示されます。</p>
        ) : (
          <>
            <MonthlyChart data={monthly} />
            <div className="legend">
              <span><i className="dot dot-total" /> 来店数</span>
              <span><i className="dot dot-nominated" /> うち指名</span>
              <span className="legend-note">棒の上は指名率</span>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title">指名の多いお客様</div>
        {ranking.length === 0 ? (
          <p className="empty">まだ記録がありません。</p>
        ) : (
          <ul className="list">
            {ranking.map((r, i) => (
              <li key={r.client.id}>
                <button className="list-row" onClick={() => onOpenClient(r.client.id)}>
                  <div className="rank-no">{i + 1}</div>
                  <div className="list-main">
                    <div className="list-name">{r.client.name} 様</div>
                    <div className="list-sub">
                      指名{r.nominated}回 ／ 来店{r.visits}回 ・ 最終 {r.lastVisit}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-title">リピートの内訳</div>
        <p className="empty">
          来店経験のあるお客様 {repeat.visited} 名のうち、2回以上来店してくださった方は{' '}
          {repeat.repeated} 名です。初回のお客様への来店後フォローがリピートへの近道です。
        </p>
      </section>
    </div>
  );
}
