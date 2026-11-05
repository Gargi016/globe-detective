import type { DateRange } from '../../detective/types';

export interface RangeBarProps {
  information: DateRange[];
  likely: DateRange[] | null;
  possible: DateRange[] | null;
  today: string;
  earliest: string;
}

const AXIS_MIN = 1850;

const yearFrac = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y + (m - 1) / 12 + (d - 1) / 365;
};

function Row({ label, ranges, tone, axisMax, earliest, today }: { label: string; ranges: DateRange[]; tone: string; axisMax: number; earliest: string; today: string }) {
  const pct = (v: number) => ((Math.min(Math.max(v, AXIS_MIN), axisMax) - AXIS_MIN) / (axisMax - AXIS_MIN)) * 100;
  return (
    <div className="rangebar__row">
      <span className="rangebar__label">{label}</span>
      <div className="rangebar__track" role="img" aria-label={`${label}: ${ranges.map((r) => `${r.start ?? 'earlier'} to ${r.end ?? 'today'}`).join(', ')}`}>
        {ranges.map((r, i) => {
          const s = r.start === null || r.start <= earliest ? -Infinity : yearFrac(r.start);
          const e = r.end === null || r.end >= today ? Infinity : yearFrac(r.end);
          const left = pct(s === -Infinity ? AXIS_MIN : s);
          const right = pct(e === Infinity ? axisMax : e);
          return (
            <span
              key={i}
              className={`rangebar__seg rangebar__seg--${tone}${s === -Infinity ? ' is-open-left' : ''}${e === Infinity ? ' is-open-right' : ''}`}
              style={{ left: `${left}%`, width: `${Math.max(right - left, 0.8)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** The estimate drawn on a time axis. Bars fading at an end mean that end is open: nothing bounds it. */
export default function RangeBar({ information, likely, possible, today, earliest }: RangeBarProps) {
  const axisMax = Math.ceil(yearFrac(today) / 10) * 10;
  const ticks: number[] = [];
  for (let y = 1850; y <= axisMax; y += 25) ticks.push(y);
  return (
    <div className="rangebar">
      <Row label="Map content" ranges={information} tone="info" axisMax={axisMax} earliest={earliest} today={today} />
      {likely && <Row label="Likely made" ranges={likely} tone="likely" axisMax={axisMax} earliest={earliest} today={today} />}
      {possible && <Row label="Possibly made" ranges={possible} tone="possible" axisMax={axisMax} earliest={earliest} today={today} />}
      <div className="rangebar__axis" aria-hidden="true">
        {ticks.map((y) => (
          <span key={y} style={{ left: `${((y - AXIS_MIN) / (axisMax - AXIS_MIN)) * 100}%` }}>{y}</span>
        ))}
      </div>
    </div>
  );
}
