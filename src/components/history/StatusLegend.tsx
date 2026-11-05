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
}

export default function StatusLegend({ counts, undefinedBoundaryCount }: StatusLegendProps) {
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
      </ul>
      <p className="legend__note">
        Unshaded land has no polygon in CShapes on this date: it is not drawn, rather than guessed. The Earth
        image underneath is modern.
      </p>
    </div>
  );
}
