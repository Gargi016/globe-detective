import { STATUS_LABEL, STATUS_ORDER } from '../../history/types';
import type { EntityStatus } from '../../history/types';

export const STATUS_COLOR: Record<EntityStatus, string> = {
  independent: 'rgb(86, 138, 214)',
  colony: 'rgb(201, 142, 70)',
  protectorate: 'rgb(170, 128, 196)',
  mandate: 'rgb(92, 178, 156)',
  occupied: 'rgb(208, 98, 98)',
  unclassified: 'rgb(150, 156, 170)',
};

export interface StatusLegendProps {
  counts: Record<EntityStatus, number> | null;
  undefinedBoundaryCount: number;
  indiaOverlayVisible?: boolean;
  onToggleIndiaOverlay?: () => void;
}

export default function StatusLegend({
  counts,
  undefinedBoundaryCount,
  indiaOverlayVisible = true,
  onToggleIndiaOverlay,
}: StatusLegendProps) {
  return (
    <div className="legend" aria-label="Map legend">
      <ul className="legend__list">
        {STATUS_ORDER.filter((s) => !counts || counts[s] > 0).map((s) => (
          <li key={s} className="legend__item">
            <span className="legend__swatch" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />
            {STATUS_LABEL[s]}
            {counts && <span className="legend__count">{counts[s]}</span>}
          </li>
        ))}
        {undefinedBoundaryCount > 0 && (
          <li className="legend__item legend__item--faint">
            <span className="legend__swatch legend__swatch--faint" aria-hidden="true" />
            Boundaries undefined
            <span className="legend__count">{undefinedBoundaryCount}</span>
          </li>
        )}
        {onToggleIndiaOverlay && (
          <li className="legend__item legend__item--india-overlay">
            <button
              type="button"
              className={`legend__toggle-btn ${indiaOverlayVisible ? 'is-active' : ''}`}
              onClick={onToggleIndiaOverlay}
              title="Toggle India's Present-Day Official Claim Overlay"
              aria-pressed={indiaOverlayVisible}
              data-testid="toggle-india-overlay"
            >
              <span className="legend__swatch legend__swatch--india-overlay" aria-hidden="true" />
              India claim (present-day)
              <span className="legend__status-tag">{indiaOverlayVisible ? 'ON' : 'OFF'}</span>
            </button>
          </li>
        )}
      </ul>
      <p className="legend__note">
        Historical boundaries follow CShapes 2.0. The amber dashed line indicates India's present-day
        official territorial claim (Survey of India standard) for historical comparison. Unshaded land
        has no polygon in CShapes on this date.
      </p>
    </div>
  );
}
