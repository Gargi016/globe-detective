import type { MapPerspective } from '../lib/countries';

export interface PerspectiveToggleProps {
  perspective: MapPerspective;
  onChange: (perspective: MapPerspective) => void;
  className?: string;
}

export default function PerspectiveToggle({
  perspective,
  onChange,
  className = '',
}: PerspectiveToggleProps) {
  const isOfficial = perspective === 'india-official' || (perspective as string) === 'india-claimed';

  return (
    <div
      className={`perspective-toggle ${className}`.trim()}
      role="region"
      aria-label="Territorial Border Perspective"
    >
      <div className="perspective-toggle__header">
        <span className="perspective-toggle__label">Map Perspective:</span>
        <div
          className="perspective-toggle__group"
          role="radiogroup"
          aria-label="Territorial Perspective Options"
        >
          <button
            type="button"
            role="radio"
            aria-checked={isOfficial}
            className={`perspective-toggle__btn ${
              isOfficial ? 'perspective-toggle__btn--active' : ''
            }`}
            onClick={() => onChange('india-official')}
            data-testid="toggle-india-official"
          >
            India's Official Territorial Perspective
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!isOfficial}
            className={`perspective-toggle__btn ${
              !isOfficial ? 'perspective-toggle__btn--active' : ''
            }`}
            onClick={() => onChange('de-facto')}
            data-testid="toggle-de-facto"
          >
            De Facto (Actual Administration)
          </button>
        </div>
      </div>
      <p className="perspective-toggle__notice">
        {isOfficial ? (
          <>
            <strong>India's Official Territorial Perspective:</strong> Represents the sovereign territory
            of India as defined by the Government of India and the Survey of India (Political Map of India,
            9th Edition). Includes the entire former princely state of Jammu and Kashmir under the 1947
            Instrument of Accession (incorporating Pakistan-administered Jammu & Kashmir, Gilgit-Baltistan,
            and Aksai Chin) and Arunachal Pradesh (including Tawang along the McMahon Line).
            <br />
            <em>
              Note: Represents India's official constitutional claims. Parts of this territory (PoK,
              Gilgit-Baltistan, and Aksai Chin), as well as direct administration of the Afghanistan border
              in the Wakhan region, are currently under foreign de facto control.
            </em>
          </>
        ) : (
          <>
            <strong>De Facto (Actual Administration):</strong> Depicts physical territorial administration
            as currently controlled on the ground (Natural Earth baseline). Pakistan-administered Kashmir
            and Gilgit-Baltistan are depicted under Pakistan, Aksai Chin under China, and the Durand Line
            as the administered Afghan border. Provided for comparative geographical analysis.
          </>
        )}
      </p>
    </div>
  );
}
