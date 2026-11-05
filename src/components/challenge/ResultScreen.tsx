import EventDetails from '../detective/EventDetails';
import ScoreTable from './ScoreTable';
import { DIFFICULTIES } from '../../challenge/generator';
import type { Challenge } from '../../challenge/generator';
import type { ProgressState } from '../../challenge/progress';
import { effectiveDailyStreak } from '../../challenge/progress';
import type { Reveal } from '../../challenge/reveal';
import { describeResult } from '../../challenge/scoring';
import type { GuessScore } from '../../challenge/scoring';

export interface ResultScreenProps {
  challenge: Challenge;
  score: GuessScore;
  hintsUsed: number;
  reveal: Reveal;
  progress: ProgressState;
  today: string;
  streakBroken: boolean;
  onAnother: () => void;
  onMenu: () => void;
  verified?: boolean;
  isGuest?: boolean;
}

const grade = (p: number) =>
  p === 100
    ? 'Perfect'
    : p >= 95
      ? 'Superb'
      : p >= 80
        ? 'Sharp'
        : p >= 60
          ? 'Close'
          : p >= 30
            ? 'Keep digging'
            : 'Back to the archive';

export default function ResultScreen(p: ResultScreenProps) {
  const { challenge: c, score, reveal } = p;
  const single = c.interval.startYear === c.interval.endYear;
  const s = p.progress.stats;

  return (
    <div className="result-screen">
      <section
        className={`result__hero result__hero--${score.points >= 80 ? 'good' : score.points >= 60 ? 'ok' : 'low'}`}
        aria-live="polite"
      >
        <div className="result__badge-row">
          <p className="eyebrow">
            Case closed · {DIFFICULTIES[c.difficulty].label}
            {c.daily ? ' · Daily' : ''}
          </p>
          {p.verified ? (
            <span
              className="pheader__sync-pill pheader__sync-pill--cloud"
              title="Score validated and recorded server-side"
            >
              <span className="pheader__sync-dot" aria-hidden="true" /> Server Verified
            </span>
          ) : (
            <span
              className="pheader__sync-pill pheader__sync-pill--guest"
              title={p.isGuest ? 'Playing in Guest Mode' : 'Local Score'}
            >
              <span className="pheader__sync-dot" aria-hidden="true" /> {p.isGuest ? 'Guest Mode' : 'Local Score'}
            </span>
          )}
        </div>

        <p className="result__points">
          {score.points}
          <span> points</span>
        </p>
        <p className="result__grade">
          {grade(score.points)} · {score.tier.label}
        </p>
        <p className="muted">{describeResult(score, c.interval)}</p>
      </section>

      <dl className="result__facts">
        <div>
          <dt>Your guess</dt>
          <dd>{score.guess}</dd>
        </div>
        <div>
          <dt>Reference date</dt>
          <dd>{reveal.refDateText}</dd>
        </div>
        <div className="result__wide">
          <dt>This map looks the same</dt>
          <dd>{reveal.intervalText}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>
            {score.distance === 0
              ? 'Inside the span'
              : `${score.distance} year${score.distance === 1 ? '' : 's'}`}
          </dd>
        </div>
        <div>
          <dt>Hints used</dt>
          <dd>
            {p.hintsUsed}
            {score.penalty > 0 ? ` (−${score.penalty})` : ''}
          </dd>
        </div>
      </dl>
      <p className="muted">
        The reference date is the moment the map was drawn for.{' '}
        {single
          ? 'No other year shows this exact map.'
          : `The years ${c.interval.startYear}–${c.interval.endYear} all show it, so the whole span counts as correct.`}
      </p>

      <section className="result__streaks" aria-label="Streaks">
        <div>
          <span className="muted">Streak</span> <strong>{s.streak.current}</strong>{' '}
          <span className="muted">best {s.streak.best}</span>
          {p.streakBroken && <span className="muted"> · streak ended</span>}
        </div>
        {c.daily && (
          <div>
            <span className="muted">Daily streak</span> <strong>{effectiveDailyStreak(s, p.today)}</strong>{' '}
            <span className="muted">best {s.daily.best}</span>
          </div>
        )}
        <div>
          <span className="muted">Total</span> <strong>{s.totalPoints}</strong>{' '}
          <span className="muted">over {s.played} played</span>
        </div>
      </section>

      <div className="result__actions">
        {!c.daily ? (
          <button type="button" className="btn" onClick={p.onAnother}>
            Play another challenge
          </button>
        ) : (
          <button type="button" className="btn" onClick={p.onAnother}>
            Play a {DIFFICULTIES[p.progress.difficulty].label} globe
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={p.onMenu}>
          Menu and history
        </button>
        <a className="btn btn--ghost" href={`#/timeline?year=${c.year}`}>
          Open {c.year} on the timeline
        </a>
      </div>

      <section>
        <h3 className="desk__h3">Why this span</h3>
        <ul className="why">
          <li>
            <strong>{reveal.begins.label}.</strong>
            {reveal.begins.items.length > 0 && <> This map began with: {reveal.begins.items.join('; ')}.</>}
          </li>
          <li>
            <strong>{reveal.ends.label}.</strong>
            {reveal.ends.items.length > 0 && <> What changed next: {reveal.ends.items.join('; ')}.</>}
          </li>
        </ul>
        <p className="muted">
          A “visible change” is a state appearing or disappearing, a change of status or owner, a renaming, or an
          area change of 1% or more (CShapes 2.0 plus the sourced name table). Smaller boundary revisions are not
          counted.
        </p>
      </section>

      {reveal.names.length > 0 && (
        <section>
          <h3 className="desk__h3">Names that dated this map</h3>
          <ul className="chips">
            {reveal.names.map((n) => (
              <li key={n.gw} className="chip chip--static" title={n.official ?? undefined}>
                {n.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reveal.events.length > 0 && (
        <section>
          <h3 className="desk__h3">Historical clues</h3>
          <ul className="results">
            {reveal.events.map((e) => (
              <li key={e.id} className="result">
                <strong className="result__title">{e.title}</strong>
                <EventDetails event={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="desk__h3">Scoring</h3>
        <ScoreTable activePoints={score.base} />
      </section>
    </div>
  );
}
