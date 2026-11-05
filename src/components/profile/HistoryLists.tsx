import { useState } from 'react';
import { DIFFICULTIES } from '../../challenge/generator';
import type { ChallengeResult } from '../../challenge/progress';
import type { InvestigationRecord } from '../../profile/profileStore';

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const PAGE = 10;

export function ChallengeHistory({ history }: { history: ChallengeResult[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? history : history.slice(0, PAGE);
  return (
    <section className="panel" aria-labelledby="ch-h">
      <h2 id="ch-h" className="desk__h3">Challenge history <span className="muted">{history.length} kept (latest 100)</span></h2>
      {history.length === 0 ? (
        <p className="muted">No challenges played yet. <a href="#/challenge">Start one</a>.</p>
      ) : (
        <>
          <ul className="history" data-testid="challenge-history">
            {rows.map((r) => {
              const single = r.startYear === r.endYear;
              return (
                <li className="hrow" key={r.id}>
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
            })}
          </ul>
          {history.length > PAGE && (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setAll((v) => !v)}>
              {all ? 'Show fewer' : `Show all ${history.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export interface InvestigationHistoryProps {
  log: InvestigationRecord[];
  onReopen: (r: InvestigationRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function InvestigationHistory({ log, onReopen, onDelete, onClear }: InvestigationHistoryProps) {
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const rows = all ? log : log.slice(0, PAGE);
  return (
    <section className="panel" aria-labelledby="ih-h">
      <h2 id="ih-h" className="desk__h3">Investigation history <span className="muted">{log.length} kept (latest 100)</span></h2>
      {log.length === 0 ? (
        <p className="muted">No investigations yet. Add observations in <a href="#/detective">Detective Mode</a> and run the estimate.</p>
      ) : (
        <>
          <ul className="history" data-testid="investigation-history">
            {rows.map((r) => (
              <li className="hrow hrow--inv" key={r.id}>
                <span className={`hrow__pts${r.status === 'contradictory' ? ' hrow__pts--low' : ''}`} title={r.status === 'contradictory' ? 'Clues contradict' : undefined}>
                  {r.status === 'contradictory' ? '⚠' : r.clueCount}
                </span>
                <span className="hrow__main">
                  <strong>{r.name}</strong>
                  <span className="muted">
                    {r.status === 'contradictory' ? 'Contradictory clues' : r.rangeText} · {r.clueCount} clue{r.clueCount === 1 ? '' : 's'} · confidence {r.confidence} · {when(r.at)}
                  </span>
                </span>
                <span className="hrow__actions">
                  <button type="button" className="btn btn--small" onClick={() => onReopen(r)}>Reopen in Detective</button>
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => onDelete(r.id)} aria-label={`Delete ${r.name} from history`}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="chips">
            {log.length > PAGE && (
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${log.length}`}</button>
            )}
            {confirm ? (
              <>
                <button type="button" className="btn btn--small btn--danger" onClick={() => { onClear(); setConfirm(false); }}>Yes, clear the list</button>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirm(false)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirm(true)}>Clear investigation history</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
