export interface GlobeLoaderProps {
  visible: boolean;
  /** Short status line, e.g. "Unrolling the map…". */
  message: string;
  /** Optional second line describing the current stage. */
  detail?: string;
}

/** Armillary-style loading indicator that fades out instead of popping away. */
export default function GlobeLoader({ visible, message, detail }: GlobeLoaderProps) {
  return (
    <div
      className="globe-loader"
      data-visible={visible}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="armillary" aria-hidden="true">
        <span className="armillary__ring armillary__ring--a" />
        <span className="armillary__ring armillary__ring--b" />
        <span className="armillary__ring armillary__ring--c" />
        <span className="armillary__core" />
      </div>
      <p className="globe-loader__message">{message}</p>
      {detail && <p className="globe-loader__detail">{detail}</p>}
    </div>
  );
}
