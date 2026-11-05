import { useState } from 'react';
import ScoreTable from './ScoreTable';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../challenge/generator';
import type { Difficulty } from '../../challenge/generator';
import { averagePoints, effectiveDailyStreak } from '../../challenge/progress';
import type { ChallengeResult, ProgressState } from '../../challenge/progress';
import { formatDate } from '../../history/historyService';

export interface ChallengeMenuProps {
  progress: ProgressState;
  today: string;
  ready: boolean;
  storageAvailable: boolean;
  onStart: (difficulty: Difficulty) => void;
  onDaily: () => void;
  onResume: () => void;
  onReset: () => void;
}

const when = (t: number) => new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });

function HistoryRow({ r }: { r: ChallengeResult }) {
  const single = r.startYear === r.endYear;
  return (
    <li className="hrow">
      <span className={`hrow__pts hrow__pts--${r.points >= 80 ? 'good' : r.points >= 60 ? 'ok' : 'low'}`}>{r.points}</span>
      <span className="hrow__main">
        <strong>{DIFFICULTIES[r.difficulty].label}{r.daily ? ' · Daily' : ''}</strong>
        <span className="muted">
          Guessed {r.guess} · answer {single ? r.startYear : `${r.startYear}–${r.endYear}`} · {r.distance === 0 ? 'exact' : `${r.distance} yr off`}
          {r.hintsUsed > 0 ? ` · ${r.hintsUsed} hint${r.hintsUsed === 1 ? '' : 's'}` : ''}
        </span>
      </span>
      <span className="hrow__when muted">{when(r.playedAt)}</span>
    </li>
  );
}

export default function ChallengeMenu(props: ChallengeMenuProps) {
  const { progress, today, ready } = props;
  const [confirmReset, setConfirmReset] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const s = progress.stats;
  const dailyId = progress.dailyDone[today];
  const dailyResult = dailyId ? progress.history.find((r) => r.id === dailyId) : undefined;
  const dailyStreak = effectiveDailyStreak(s, today);
  const rows = showAll ? progress.history : progress.history.slice(0, 8);

  return (
    <div className="cmenu">
      {progress.active && (
        <section className="ccard ccard--resume">
          <div>
            <h2 className="ccard__title">Challenge in progress</h2>
            <p className="muted">
              {progress.active.daily ? 'Daily challenge' : `${DIFFICULTIES[progress.active.difficulty].label} globe`}
              {progress.active.hintsUsed > 0 ? ` · ${progress.active.hintsUsed} hint${progress.active.hintsUsed === 1 ? '' : 's'} used` : ''}
            </p>
          </div>
          <button type="button" className="btn" onClick={props.onResume} disabled={!ready}>Continue</button>
        </section>
      )}

      <section className="ccard ccard--daily" aria-labelledby="daily-h">
        <div>
          <p className="eyebrow">{formatDate(today)}</p>
          <h2 id="daily-h" className="ccard__title">Daily challenge</h2>
          {dailyResult ? (
            <p className="muted">Completed today: <strong>{dailyResult.points} points</strong>. A new globe arrives at your midnight.</p>
          ) : (
            <p className="muted">One globe a day, the same for everyone, at Medium difficulty. Play every day to build a streak.</p>
          )}
          <p className="muted">Daily streak: <strong>{dailyStreak}</strong> (best {s.daily.best})</p>
        </div>
        <button type="button" className="btn" onClick={props.onDaily} disabled={!ready || dailyResult !== undefined}>
          {dailyResult ? 'Done for today' : 'Play today’s globe'}
        </button>
      </section>

      <section aria-labelledby="levels-h">
        <h2 id="levels-h" className="desk__h3">Choose a difficulty</h2>
        <div className="levels">
          {DIFFICULTY_ORDER.map((d) => {
            const c = DIFFICULTIES[d];
            return (
              <article key={d} className="ccard level">
                <h3 className="ccard__title">{c.label}</h3>
                <p className="muted">{c.blurb}</p>
                <button type="button" className="btn btn--small" onClick={() => props.onStart(d)} disabled={!ready}>
                  Play {c.label}
                </button>
              </article>
            );
          })}
        </div>
        {!ready && <p className="muted">Opening the archive…</p>}
      </section>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="desk__h3">Your record</h2>
        <dl className="stats">
          <div><dt>Played</dt><dd>{s.played}</dd></div>
          <div><dt>Total points</dt><dd>{s.totalPoints}</dd></div>
          <div><dt>Average</dt><dd>{averagePoints(s)}</dd></div>
          <div><dt>Exact</dt><dd>{s.exact}</dd></div>
          <div><dt>Streak</dt><dd>{s.streak.current}<span className="muted"> / best {s.streak.best}</span></dd></div>
          <div><dt>Daily streak</dt><dd>{dailyStreak}<span className="muted"> / best {s.daily.best}</span></dd></div>
        </dl>
        <p className="muted">A streak counts challenges in a row that scored 80 or more (within five years).</p>
      </section>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="desk__h3">Score history</h2>
        {progress.history.length === 0 ? (
          <p className="muted">No challenges played yet.</p>
        ) : (
          <>
            <ul className="history">{rows.map((r, i) => <HistoryRow key={`${r.id}-${r.playedAt}-${i}`} r={r} />)}</ul>
            {progress.history.length > 8 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${progress.history.length}`}
              </button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="rules-h">
        <h2 id="rules-h" className="desk__h3">How scoring works</h2>
        <ScoreTable />
        <p className="muted">
          Each globe is a real moment from CShapes 2.0. Several neighbouring years can show an identical map, so the answer is the span of years during which the map looks the same. A guess inside the span is exact; outside it, the distance is measured to the nearest edge. Hints are free but are recorded.
        </p>
      </section>

      {!props.storageAvailable && <div className="notice notice--warn">This browser is blocking local storage, so progress cannot be saved. The game still works.</div>}

      <div className="cmenu__reset">
        {!confirmReset ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmReset(true)} disabled={s.played === 0 && !progress.active}>
            Reset my progress
          </button>
        ) : (
          <span className="desk__confirm" role="group" aria-label="Confirm reset">
            <span>Erase history, streaks and the challenge in progress?</span>
            <button type="button" className="btn btn--small btn--danger" onClick={() => { props.onReset(); setConfirmReset(false); }}>Yes, erase</button>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
          </span>
        )}
      </div>
    </div>
  );
}
