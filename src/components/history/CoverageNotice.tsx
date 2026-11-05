import type { CoverageGap } from '../../history/types';

export interface CoverageNoticeProps {
  gap: CoverageGap;
  firstYear: number;
  lastYear: number;
  onGoTo: (year: number) => void;
}

/** Shown over the globe when the dataset has nothing for the chosen year. */
export default function CoverageNotice({ gap, firstYear, lastYear, onGoTo }: CoverageNoticeProps) {
  return (
    <div className="coverage" role="alert">
      <p className="eyebrow">Outside dataset coverage</p>
      <h2 className="coverage__title">{gap.title}</h2>
      <p>{gap.message}</p>
      <div className="coverage__actions">
        {gap.reason !== 'after' && (
          <button type="button" className="btn" onClick={() => onGoTo(firstYear)}>
            Go to {firstYear}
          </button>
        )}
        {gap.reason !== 'before' && (
          <button type="button" className="btn" onClick={() => onGoTo(lastYear)}>
            Go to {lastYear}
          </button>
        )}
        {gap.reason === 'after' && (
          <a className="btn btn--ghost" href="#/">
            Modern borders (Home)
          </a>
        )}
      </div>
    </div>
  );
}
