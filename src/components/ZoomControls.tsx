export interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function ZoomControls({ onZoomIn, onZoomOut, onReset, disabled }: ZoomControlsProps) {
  return (
    <div className="zoom-controls" role="group" aria-label="Globe view controls">
      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomIn}
        disabled={disabled}
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomOut}
        disabled={disabled}
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        className="zoom-btn zoom-btn--reset"
        onClick={onReset}
        disabled={disabled}
        aria-label="Reset view"
        title="Reset view"
      >
        ⟲
      </button>
    </div>
  );
}
