import { beforeEach, describe, expect, it } from 'vitest';
import { estimateDate } from '../dateEstimator';
import {
  addEventObservation,
  addPrintedDate,
  applyPreset,
  clearObservations,
  cluesOf,
  CURRENT_KEY,
  deleteSaved,
  listSaved,
  loadCurrent,
  newInvestigation,
  parseInvestigation,
  PRESETS,
  progressOf,
  removeObservation,
  saveCurrent,
  saveNamed,
  SAVES_KEY,
  updateObservation,
} from '../investigation';
import type { SafeStorage } from '../investigation';

class MemoryStorage implements SafeStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const added = (r: ReturnType<typeof addEventObservation>) => {
  if (r.status !== 'added') throw new Error(r.status);
  return r;
};

describe('editing an investigation', () => {
  it('adds, refuses duplicates, and rejects unknown events', () => {
    let inv = newInvestigation();
    inv = added(addEventObservation(inv, 'ceylon-name', 'shows')).investigation;
    expect(inv.observations).toHaveLength(1);
    const dup = addEventObservation(inv, 'ceylon-name', 'shows');
    expect(dup.status).toBe('duplicate');
    expect(dup.investigation).toBe(inv);
    expect(addEventObservation(inv, 'ceylon-name', 'absent').status).toBe('added'); // opposite is allowed (and flagged by validation)
    expect(addEventObservation(inv, 'nope', 'shows').status).toBe('unknown-event');
  });

  it('adds printed dates with validation', () => {
    const inv = newInvestigation();
    expect(addPrintedDate(inv, 1962).status).toBe('added');
    expect(addPrintedDate(inv, 12).status).toBe('invalid');
    expect(addPrintedDate(inv, 1962.5).status).toBe('invalid');
    const once = added(addPrintedDate(inv, 1962)).investigation;
    expect(addPrintedDate(once, 1962).status).toBe('duplicate');
    expect(addPrintedDate(once, 1962, 'corrected-to').status).toBe('added');
  });

  it('modifies certainty, seen/missing, and printed year', () => {
    let inv = added(addEventObservation(newInvestigation(), 'ussr-exists', 'shows')).investigation;
    const id = inv.observations[0].id;
    inv = updateObservation(inv, id, { certainty: 'uncertain' }).investigation;
    expect(inv.observations[0].certainty).toBe('uncertain');
    inv = updateObservation(inv, id, { observation: 'absent' }).investigation;
    expect(cluesOf(inv)[0].id).toBe('absent:ussr-exists');

    let p = added(addPrintedDate(inv, 1960)).investigation;
    const pid = p.observations[1].id;
    p = updateObservation(p, pid, { printedYear: 1975 }).investigation;
    expect(p.observations[1].printedYear).toBe(1975);
    expect(updateObservation(p, pid, { printedYear: 3 }).error).toMatch(/four-digit/);
    // a printed date cannot be turned into "missing"
    expect(updateObservation(p, pid, { observation: 'absent' }).investigation.observations[1].observation).toBe('shows');
  });

  it('refuses a modification that would duplicate another observation', () => {
    let inv = added(addEventObservation(newInvestigation(), 'ussr-exists', 'shows')).investigation;
    inv = added(addEventObservation(inv, 'ussr-exists', 'absent')).investigation;
    const r = updateObservation(inv, inv.observations[1].id, { observation: 'shows' });
    expect(r.error).toMatch(/duplicate/);
  });

  it('removes and clears', () => {
    let inv = applyPreset(newInvestigation(), PRESETS[0]);
    expect(inv.observations).toHaveLength(3);
    inv = removeObservation(inv, inv.observations[0].id);
    expect(inv.observations).toHaveLength(2);
    expect(clearObservations(inv).observations).toEqual([]);
    expect(removeObservation(inv, 'missing')).toEqual(inv);
  });

  it('presets run through the estimator as documented', () => {
    const cold = estimateDate(cluesOf(applyPreset(newInvestigation(), PRESETS[0])), { today: '2026-11-01' });
    expect(cold.status).toBe('ok');
    expect(cold.information!.ranges).toEqual([{ start: '1949-10-07', end: '1972-05-21' }]);
    const bad = estimateDate(cluesOf(applyPreset(newInvestigation(), PRESETS[2])), { today: '2026-11-01' });
    expect(bad.status).toBe('contradictory');
  });
});

describe('progress', () => {
  it('advances with the work done', () => {
    let inv = newInvestigation();
    let p = progressOf(inv, { estimateCurrent: false, estimate: null });
    expect(p.done).toBe(0);
    inv = { ...inv, explored: true };
    expect(progressOf(inv, { estimateCurrent: false, estimate: null }).done).toBe(1);
    inv = applyPreset(inv, PRESETS[0]);
    p = progressOf(inv, { estimateCurrent: false, estimate: null });
    expect(p.steps.map((s) => s.done)).toEqual([true, true, true, false, false]);
    const est = estimateDate(cluesOf(inv), { today: '2026-11-01' });
    p = progressOf(inv, { estimateCurrent: true, estimate: est });
    expect(p.done).toBe(5);
    expect(p.fraction).toBe(1);
    // a contradictory result does not complete the review
    const bad = estimateDate(cluesOf(applyPreset(inv, PRESETS[2])), { today: '2026-11-01' });
    expect(progressOf(inv, { estimateCurrent: true, estimate: bad }).steps[4].done).toBe(false);
  });
});

describe('saving and restoring', () => {
  let store: MemoryStorage;
  beforeEach(() => { store = new MemoryStorage(); });

  it('round-trips the working investigation', () => {
    const inv = { ...applyPreset(newInvestigation(), PRESETS[0]), viewYear: 1975, anchor: 'mid' as const, reuseLagYears: 15 };
    expect(saveCurrent(store, inv)).toBe(true);
    const back = loadCurrent(store)!;
    expect(back.dropped).toBe(0);
    expect(back.investigation.observations.map((o) => o.eventId)).toEqual(inv.observations.map((o) => o.eventId));
    expect(back.investigation.viewYear).toBe(1975);
    expect(back.investigation.anchor).toBe('mid');
    expect(back.investigation.reuseLagYears).toBe(15);
    expect(cluesOf(back.investigation).map((c) => c.id)).toEqual(cluesOf(inv).map((c) => c.id));
  });

  it('drops unusable data instead of trusting it', () => {
    store.setItem(
      CURRENT_KEY,
      JSON.stringify({
        version: 1,
        name: 'x',
        reuseLagYears: 9999,
        viewYear: 'soon',
        observations: [
          { source: 'event', eventId: 'ussr-exists', observation: 'shows', certainty: 'certain' },
          { source: 'event', eventId: 'ussr-exists', observation: 'shows', certainty: 'certain' },
          { source: 'event', eventId: 'removed-event', observation: 'shows' },
          { source: 'printed', printedYear: 5 },
          { source: 'printed', printedYear: 1970, printedMeaning: 'corrected-to', certainty: 'nonsense' },
          42,
        ],
      }),
    );
    const r = loadCurrent(store)!;
    expect(r.investigation.observations).toHaveLength(2);
    expect(r.investigation.observations[1].certainty).toBe('certain');
    expect(r.dropped).toBe(4);
    expect(r.investigation.reuseLagYears).toBe(10);
    expect(r.investigation.viewYear).toBe(1960);
  });

  it('treats corrupt or foreign storage as empty', () => {
    store.setItem(CURRENT_KEY, '{not json');
    expect(loadCurrent(store)).toBeNull();
    store.setItem(CURRENT_KEY, JSON.stringify({ version: 99, observations: [] }));
    expect(loadCurrent(store)).toBeNull();
    expect(loadCurrent(null)).toBeNull();
    expect(parseInvestigation('nope')).toBeNull();
  });

  it('keeps named saves, replaces a same-named one, and deletes', () => {
    const a = applyPreset(newInvestigation(), PRESETS[0]);
    const b = applyPreset(newInvestigation(), PRESETS[1]);
    expect(saveNamed(store, '  ', a).ok).toBe(false);
    const r1 = saveNamed(store, 'Atlas', a, 1000);
    expect(r1.ok).toBe(true);
    saveNamed(store, 'Globe B', b, 2000);
    expect(listSaved(store).map((s) => s.name)).toEqual(['Globe B', 'Atlas']);
    saveNamed(store, 'atlas', b, 3000); // same name, different case: replaces
    const saves = listSaved(store);
    expect(saves).toHaveLength(2);
    expect(saves[0].name).toBe('atlas');
    expect(saves[0].investigation.observations).toHaveLength(2);
    expect(deleteSaved(store, saves[0].id)).toHaveLength(1);
    expect(listSaved(store)).toHaveLength(1);
  });

  it('reports a storage failure rather than pretending it saved', () => {
    const broken: SafeStorage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    expect(saveNamed(broken, 'x', newInvestigation()).ok).toBe(false);
    expect(saveCurrent(broken, newInvestigation())).toBe(false);
    expect(saveCurrent(null, newInvestigation())).toBe(false);
  });

  it('ignores malformed entries in the saves list', () => {
    store.setItem(SAVES_KEY, JSON.stringify([{ id: 1 }, 'x', { id: 's', savedAt: 1, investigation: { version: 1, observations: [] } }]));
    expect(listSaved(store)).toHaveLength(1);
  });
});
