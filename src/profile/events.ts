/** A tiny signal so any page can say "progress changed" without importing the profile code. */
export const PROGRESS_EVENT = 'gd:progress';

export function notifyProgressChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    /* no window (tests) */
  }
}

export function onProgressChanged(handler: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, handler);
  return () => window.removeEventListener(PROGRESS_EVENT, handler);
}
