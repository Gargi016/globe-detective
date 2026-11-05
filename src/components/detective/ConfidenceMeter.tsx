import type { Confidence } from '../../detective/types';

const LABEL = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' } as const;

/** Confidence level, score, and the factors behind it. */
export default function ConfidenceMeter({ title, confidence }: { title: string; confidence: Confidence }) {
  return (
    <div className={`confidence confidence--${confidence.level}`}>
      <div className="confidence__head">
        <span className="confidence__title">{title}</span>
        <span className="confidence__level">{LABEL[confidence.level]}</span>
      </div>
      <div className="meter" title={`Score ${(confidence.score * 100).toFixed(0)} out of 100. A rough indicator, not a probability.`}>
        <span className="meter__track"><span className="meter__fill" style={{ width: `${Math.round(confidence.score * 100)}%` }} /></span>
        <span className="meter__value">{Math.round(confidence.score * 100)}</span>
      </div>
      {confidence.factors.length > 0 && (
        <details className="confidence__factors">
          <summary>Why this rating</summary>
          <ul>
            {confidence.factors.map((f) => (
              <li key={f.id}>
                <strong>{f.label}</strong> <span className="muted">({Math.round(f.score * 100)}%)</span>
                <br />
                {f.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
