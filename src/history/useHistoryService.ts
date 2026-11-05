import { useCallback, useEffect, useState } from 'react';
import type { HistoryService } from './historyService';
import { loadHistoryService } from './loadHistory';

export type HistoryLoad =
  | { status: 'loading' }
  | { status: 'ready'; service: HistoryService }
  | { status: 'error'; message: string };

/** Loads the historical dataset once and exposes loading / error / retry state. */
export function useHistoryService(): { load: HistoryLoad; retry: () => void } {
  const [load, setLoad] = useState<HistoryLoad>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    loadHistoryService()
      .then((service) => {
        if (!cancelled) setLoad({ status: 'ready', service });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error loading historical data',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { load, retry };
}
