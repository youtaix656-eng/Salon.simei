// カレンダー：施術記録（時間つき）・お客様の誕生日・来店予測を月表示で確認する
import { useMemo, useState } from 'react';
import { useStore } from '../lib/useStore.js';
import { todayStr } from '../lib/cycle.js';
import { monthKey, shiftMonth } from '../lib/stats.js';
import { buildMonthGrid, calendarEvents, monthLabel, WEEKDAY_LABELS } from '../lib/calendar.js';

export default function CalendarView({ onOpenClient }) {
  const { state } = useStore();
  const { clients, visits } = state;
  const today = todayStr();
  const [month, setMonth] = useState(() => monthKey(today));
  const [selected, setSelected] = useState(today);

  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const events = useMemo(
    () => calendarEvents(clients, visits, month, today),
    [clients, visits, month, today]
  );

  const goMonth = (delta) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(next === monthKey(today) ? today : `${next}-01`);
  };

  const dayInfo = events.get(selected);

  return (
    <div className="page">
      <section className="card">
        <div className="cal-header">
          <button className="btn small" onClick={() => goMonth(-1)}>←</button>
          <div className="cal-title">{monthLabel(month)}</div>
          <button className="btn small" onClick={() => goMonth(1)}>→</button>
        </div>
        {month !== monthKey(today) && (
          <div className="form-actions" style={{ justifyContent: 'center', marginBottom: 6 }}>
            <button
              className="btn small"
              onClick={() => {
                setMonth(monthKey(today));
                setSelected(today);
              }}
            >
              今月へ戻る
            </button>
          </div>
        )}

        <div className="cal-grid">
          {WEEKDAY_LABELS.map((w, i) => (
            <div key={w} className={`cal-weekday${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>
              {w}
            </div>
          ))}
          {grid.map((date, i) =>
            date === null ? (
              <div key={`pad-${i}`} className="cal-cell empty" />
            ) : (
              <button
                key={date}
                className={[
                  'cal-cell',
                  date === today ? 'today' : '',
                  date === selected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelected(date)}
              >
                <span className="cal-day">{Number(date.slice(8, 10))}</span>
                <span className="cal-marks">
                  {events.get(date)?.birthdays.length ? '🎂' : ''}
                  {events.get(date)?.visits.length ? <span className="cal-dot" /> : null}
                  {events.get(date)?.predicted.length ? <span className="cal-dot predicted" /> : null}
                </span>
              </button>
            )
          )}
        </div>
        <p className="cal-legend">
          <span className="cal-dot" /> 施術記録
          <span className="cal-dot predicted" /> 来店予測　🎂 誕生日
        </p>
      </section>

      <section className="card">
        <div className="card-title">
          {Number(selected.slice(5, 7))}月{Number(selected.slice(8, 10))}日
          {selected === today && '（今日）'}
        </div>
        {!dayInfo ||
        (dayInfo.visits.length === 0 &&
          dayInfo.birthdays.length === 0 &&
          dayInfo.predicted.length === 0) ? (
          <p className="empty">この日の予定・記録はありません。</p>
        ) : (
          <>
            {dayInfo.birthdays.map((client) => (
              <button
                key={`b-${client.id}`}
                className="list-row"
                onClick={() => onOpenClient(client.id)}
              >
                <div className="list-main">
                  <div className="list-name">🎂 {client.name} 様</div>
                  <div className="list-sub">お誕生日です！</div>
                </div>
              </button>
            ))}
            {dayInfo.predicted.map(({ client, info }) => (
              <button
                key={`p-${client.id}`}
                className="list-row"
                onClick={() => onOpenClient(client.id)}
              >
                <div className="list-main">
                  <div className="list-name">{client.name} 様</div>
                  <div className="list-sub">来店予測（周期 約{info.intervalDays}日）</div>
                </div>
                <span className="chip chip-soon">予測</span>
              </button>
            ))}
            {dayInfo.visits.map((v) => (
              <button
                key={v.id}
                className="list-row"
                onClick={() => v.client && onOpenClient(v.client.id)}
              >
                <div className="list-main">
                  <div className="list-name">
                    {v.time && <span className="cal-time">{v.time}</span>}
                    {v.client ? `${v.client.name} 様` : '（削除されたお客様）'}
                  </div>
                  <div className="list-sub">
                    {v.menu || 'メニュー未記入'}
                    {v.minutes ? `（${v.minutes}分）` : ''}
                  </div>
                </div>
                <span className={v.nominated ? 'chip chip-nominated' : 'chip chip-free'}>
                  {v.nominated ? '指名' : 'フリー'}
                </span>
              </button>
            ))}
          </>
        )}
        <p className="hint">タップするとお客様のカルテが開きます。</p>
      </section>
    </div>
  );
}
