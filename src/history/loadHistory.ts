import { createHistoryService } from './historyService';
import type { HistoryService } from './historyService';

export const HISTORY_DATA_URL = `${import.meta.env.BASE_URL}data/cshapes/cshapes-2.0-gw.simplified.topojson`;

let cache: Promise<HistoryService> | null = null;

/**
 * Fetches and indexes the historical dataset once per page load. A failed request is not cached,
 * so "Try again" genuinely retries.
 */
export function loadHistoryService(): Promise<HistoryService> {
  if (!cache) {
    cache = fetchService().catch((err: unknown) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

async function fetchService(): Promise<HistoryService> {
  const res = await fetch(HISTORY_DATA_URL);
  if (!res.ok) throw new Error(`Historical dataset request failed (${res.status})`);
  const topology = (await res.json()) as Parameters<typeof createHistoryService>[0];
  return createHistoryService(topology);
}
