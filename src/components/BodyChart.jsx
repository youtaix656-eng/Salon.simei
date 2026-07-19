// タップで部位を選べる人体図（前面・背面）。
// onToggle を渡すと編集モード、渡さなければ表示専用になる。
import { BODY_ZONES } from '../data/bodyZones.js';

const VIEWS = [
  { key: 'back', caption: '背面（左右はお客様基準）' },
  { key: 'front', caption: '前面' },
];

// 前面ビューの飾り（タップ対象外の腕）— 図としての形を保つため
const FRONT_DECO = [
  { x: 14, y: 50, w: 12, h: 56 },
  { x: 94, y: 50, w: 12, h: 56 },
];

function Zone({ zone, on, onToggle }) {
  const s = zone.shape;
  const props = {
    className: on ? 'body-zone on' : 'body-zone',
    onClick: onToggle ? () => onToggle(zone.id) : undefined,
    role: onToggle ? 'button' : undefined,
    'aria-label': zone.label,
    'aria-pressed': onToggle ? on : undefined,
  };
  if (s.type === 'circle') {
    return (
      <circle cx={s.cx} cy={s.cy} r={s.r} {...props}>
        <title>{zone.label}</title>
      </circle>
    );
  }
  return (
    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="4" {...props}>
      <title>{zone.label}</title>
    </rect>
  );
}

export default function BodyChart({ selected = [], onToggle }) {
  const set = new Set(selected);
  return (
    <div className={onToggle ? 'body-chart' : 'body-chart readonly'}>
      {VIEWS.map(({ key, caption }) => (
        <div key={key} className="body-chart-view">
          <svg viewBox="0 0 120 232" aria-label={caption}>
            {key === 'front' &&
              FRONT_DECO.map((d, i) => (
                <rect key={i} x={d.x} y={d.y} width={d.w} height={d.h} rx="4" className="body-zone-deco" />
              ))}
            {BODY_ZONES.filter((z) => z.view === key).map((zone) => (
              <Zone key={zone.id} zone={zone} on={set.has(zone.id)} onToggle={onToggle} />
            ))}
          </svg>
          <div className="body-chart-caption">{caption}</div>
        </div>
      ))}
    </div>
  );
}
