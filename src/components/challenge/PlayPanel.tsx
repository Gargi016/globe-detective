import { useState } from 'react';
import type { FormEvent } from 'react';
import { DIFFICULTIES } from '../../challenge/generator';
import type { Challenge } from '../../challenge/generator';
import type { Hint } from '../../challenge/hints';
import { MAX_GUESS_YEAR, MIN_GUESS_YEAR, parseGuess } from '../../challenge/scoring';
import { STATUS_LABEL } from '../../history/types';
import type { HistoricalFeature } from '../../history/types';

export interface PlayPanelProps {
  challenge: Challenge;
  hints: Hint[];
  hintsUsed: number;
  guessText: string;
  selected: HistoricalFeature | null;
  onGuessText: (text: string) => void;
  onHint: () => void;
  onSubmit: (year: number) => void;
  onSkip: () => void;
  onLeave: () => void;
}

export default function PlayPanel(p: PlayPanelProps) {
  const cfg = DIFFICULTIES[p.challenge.difficulty];
  const [error, setError] = useState<string | null>(null);
  const sliderValue = /^\d{4}$/.test(p.guessText) ? Math.min(Math.max(Number(p.guessText), 1886), 2019) : 1960;
  const remaining = p.hints.length - p.hintsUsed;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = parseGuess(p.guessText);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setError(null);
    p.onSubmit(r.year);
  };

  return (
    <div className="play">
      <header className="play__head">
        <span className="cat">{cfg.label}</span>
        {p.challenge.daily && <span className="cat cat--independence">Daily</span>}
        <h2 className="play__title">Mystery globe</h2>
        <p className="muted">When was this map drawn? Rotate it, hover and click the states, read the names and the borders, then guess the year.</p>
      </header>

      <section className="play__selected" aria-live="polite">
        {p.selected ? (
          <p>
            <strong>{cfg.showNames ? p.selected.properties.name : 'Name hidden on Hard'}</strong>
            <span className="muted"> · {STATUS_LABEL[p.selected.properties.status]} · about {Math.round(p.selected.properties.areaKm2).toLocaleString('en-US')} km²</span>
          </p>
        ) : (
          <p className="muted">Click a state on the globe to inspect it.</p>
        )}
      </section>

      <section aria-label="Hints">
        <h3 className="desk__h3">Hints <span className="muted">({p.hintsUsed} of {p.hints.length} used)</span></h3>
        <ol className="hints">
          {p.hints.slice(0, p.hintsUsed).map((h, i) => (
            <li key={h.id} className="hint">
              <span className="hint__n">{i + 1}</span>
              <div><strong>{h.title}</strong><p>{h.text}</p></div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--ghost btn--small" onClick={p.onHint} disabled={remaining <= 0}>
          {remaining > 0 ? `Reveal hint ${p.hintsUsed + 1} of ${p.hints.length}` : 'No hints left'}
        </button>
      </section>

      <form className="guess" onSubmit={submit} noValidate>
        <h3 className="desk__h3">Your guess</h3>
        <div className="guess__row">
          <label className="field">
            <span className="field__label">Year</span>
            <input
              className="select guess__input"
              inputMode="numeric"
              maxLength={4}
              placeholder="1962"
              value={p.guessText}
              onChange={(e) => { p.onGuessText(e.target.value.replace(/[^\d]/g, '')); setError(null); }}
              aria-invalid={error !== null}
              aria-describedby={error ? 'guess-error' : undefined}
            />
          </label>
          <button type="submit" className="btn">Submit guess</button>
        </div>
        <input
          className="guess__slider"
          type="range"
          min={1886}
          max={2019}
          value={sliderValue}
          onChange={(e) => { p.onGuessText(e.target.value); setError(null); }}
          aria-label="Choose a year with the slider"
        />
        <div className="guess__scale" aria-hidden="true"><span>1886</span><span>1950</span><span>2019</span></div>
        {error && <p id="guess-error" className="form-error" role="alert">{error}</p>}
        <p className="muted">Any year from {MIN_GUESS_YEAR} to {MAX_GUESS_YEAR} is accepted; the map covers 1886–2019.</p>
      </form>

      <div className="play__actions">
        {!p.challenge.daily && <button type="button" className="btn btn--ghost btn--small" onClick={p.onSkip}>Skip: new globe</button>}
        <button type="button" className="btn btn--ghost btn--small" onClick={p.onLeave}>Back to menu (keeps this globe)</button>
      </div>
    </div>
  );
}
