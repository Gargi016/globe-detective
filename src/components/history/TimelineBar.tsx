import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { formatDate } from '../../history/historyService';
import { EXAMPLES } from '../../history/examples';
import type { HistoricalExample } from '../../history/examples';
import type { Anchor } from '../../history/types';

/** Years the slider spans. It deliberately extends past the dataset so the gaps are visible. */
export const TIMELINE_MIN = 1870;
export const TIMELINE_MAX = 2030;

const ANCHORS: { value: Anchor; label: string; title: string }[] = [
  { value: 'start', label: '1 Jan', title: 'The world on 1 January' },
  { value: 'mid', label: '1 Jul', title: 'The world on 1 July' },
  { value: 'end', label: '31 Dec', title: 'The world on 31 December' },
];

export interface TimelineBarProps {
  year: number;
  anchor: Anchor;
  /** Exact date shown, or '' when the year is not a valid calendar year. */
  date: string;
  coverageFirst: number;
  coverageLast: number;
  /** Years with a renaming or major change: drawn as ticks and used by prev/next. */
  markerYears: readonly number[];
  activeExampleId: string | null;
  onYear: (year: number) => void;
  onAnchor: (anchor: Anchor) => void;
  onExample: (example: HistoricalExample) => void;
}

const pct = (year: number) => ((Math.min(Math.max(year, TIMELINE_MIN), TIMELINE_MAX) - TIMELINE_MIN) / (TIMELINE_MAX - TIMELINE_MIN)) * 100;

export default function TimelineBar({
  year,
  anchor,
  date,
  coverageFirst,
  coverageLast,
  markerYears,
  activeExampleId,
  onYear,
  onAnchor,
  onExample,
}: TimelineBarProps) {
  const [draft, setDraft] = useState(String(year));
  useEffect(() => setDraft(String(year)), [year]);

  const covered = year >= coverageFirst && year <= coverageLast;
  const clampedYear = Math.min(Math.max(year, TIMELINE_MIN), TIMELINE_MAX);

  const commit = (text: string) => {
    const n = Number(text);
    if (text.trim() !== '' && Number.isInteger(n) && n >= 1000 && n <= 2100) onYear(n);
    else setDraft(String(year));
  };

  const prevMarker = useMemo(() => [...markerYears].reverse().find((y) => y < year), [markerYears, year]);
  const nextMarker = useMemo(() => markerYears.find((y) => y > year), [markerYears, year]);

  const step = (delta: number) => onYear(Math.min(2100, Math.max(1000, year + delta)));

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit(draft);
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(1);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(-1);
    }
  };

  const bandLeft = pct(coverageFirst);
  const bandRight = pct(coverageLast + 1);

  return (
    <section className="timebar" aria-label="Timeline">
      <div className="timebar__head">
        <div className="timebar__year">
          <label className="sr-only" htmlFor="timeline-year">
            Year
          </label>
          <input
            id="timeline-year"
            className="timebar__input"
            inputMode="numeric"
            maxLength={4}
            value={draft}
            aria-invalid={!covered}
            onChange={(e) => {
              setDraft(e.target.value);
              if (/^\d{4}$/.test(e.target.value)) commit(e.target.value);
            }}
            onBlur={() => commit(draft)}
            onKeyDown={onInputKey}
          />
          <p className="timebar__date" aria-live="polite">
            {date ? `as of ${formatDate(date)}` : 'not a valid year'}
            {!covered && <span className="timebar__nocover"> · no coverage</span>}
          </p>
        </div>

        <div className="timebar__controls">
          <div className="seg" role="group" aria-label="Day of the year shown">
            {ANCHORS.map((a) => (
              <button
                key={a.value}
                type="button"
                className="seg__btn"
                aria-pressed={anchor === a.value}
                title={a.title}
                onClick={() => onAnchor(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="stepper" role="group" aria-label="Step through time">
            <button type="button" className="stepper__btn" onClick={() => step(-10)} aria-label="Back 10 years">
              −10
            </button>
            <button type="button" className="stepper__btn" onClick={() => step(-1)} aria-label="Back 1 year">
              −1
            </button>
            <button type="button" className="stepper__btn" onClick={() => step(1)} aria-label="Forward 1 year">
              +1
            </button>
            <button type="button" className="stepper__btn" onClick={() => step(10)} aria-label="Forward 10 years">
              +10
            </button>
          </div>
          <div className="stepper" role="group" aria-label="Jump between notable years">
            <button
              type="button"
              className="stepper__btn stepper__btn--wide"
              disabled={prevMarker === undefined}
              onClick={() => prevMarker !== undefined && onYear(prevMarker)}
              title="Previous year with a renaming or major boundary change"
            >
              ◂ Notable
            </button>
            <button
              type="button"
              className="stepper__btn stepper__btn--wide"
              disabled={nextMarker === undefined}
              onClick={() => nextMarker !== undefined && onYear(nextMarker)}
              title="Next year with a renaming or major boundary change"
            >
              Notable ▸
            </button>
          </div>
        </div>
      </div>

      <div className="track">
        <div className="track__bar" aria-hidden="true">
          <div className="track__band" style={{ left: `${bandLeft}%`, width: `${bandRight - bandLeft}%` }} />
          {markerYears.map((y) => (
            <span key={y} className="track__tick" style={{ left: `${pct(y)}%` }} />
          ))}
        </div>
        <input
          className="track__slider"
          type="range"
          min={TIMELINE_MIN}
          max={TIMELINE_MAX}
          step={1}
          value={clampedYear}
          aria-label="Year"
          aria-valuetext={`${year}${covered ? '' : ', outside dataset coverage'}`}
          onChange={(e) => onYear(Number(e.target.value))}
        />
        <div className="track__scale" aria-hidden="true">
          <span style={{ left: `${pct(1886)}%` }}>{coverageFirst}</span>
          {[1900, 1925, 1950, 1975, 2000].map((y) => (
            <span key={y} style={{ left: `${pct(y)}%` }}>
              {y}
            </span>
          ))}
          <span style={{ left: `${pct(2019)}%` }}>{coverageLast}</span>
        </div>
        <p className="track__key">
          <span className="track__key-band" /> CShapes 2.0 coverage ({coverageFirst}–{coverageLast})
          <span className="track__key-tick" /> year with a renaming or major change
        </p>
      </div>

      <div className="cases" role="group" aria-label="Case files">
        <span className="cases__label">Case files</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            className="chip"
            aria-pressed={activeExampleId === ex.id}
            title={`${ex.hint} · opens ${ex.year}`}
            onClick={() => onExample(ex)}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
