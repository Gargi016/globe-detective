import type { ProgressStep } from '../../detective/investigation';

export default function ProgressTracker({ steps, done, fraction }: { steps: ProgressStep[]; done: number; fraction: number }) {
  const next = steps.find((s) => !s.done);
  return (
    <div className="progress">
      <div className="progress__head">
        <span className="progress__title">Investigation progress</span>
        <span className="progress__count">{done} of {steps.length}</span>
      </div>
      <div className="progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Investigation progress">
        <span style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
      <ol className="progress__steps">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'is-done' : s === next ? 'is-next' : ''} title={s.hint}>
            <span className="progress__dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
            {s.label}
          </li>
        ))}
      </ol>
      {next && <p className="progress__hint">Next: {next.hint}</p>}
      {!next && <p className="progress__hint">Every step is complete. Add clues to tighten the range or save the investigation.</p>}
    </div>
  );
}
