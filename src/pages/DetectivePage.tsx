import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import GlobeView from '../components/GlobeView';
import type { GlobeViewHandle } from '../components/GlobeView';
import GlobeLoader from '../components/GlobeLoader';
import CoverageNotice from '../components/history/CoverageNotice';
import StatusLegend from '../components/history/StatusLegend';
import TimelineBar from '../components/history/TimelineBar';
import { colorOf, keyOf, tooltipOf } from '../components/history/globeStyle';
import EstimatePanel from '../components/detective/EstimatePanel';
import NameSearch from '../components/detective/NameSearch';
import ObservationList from '../components/detective/ObservationList';
import type { ClueRole } from '../components/detective/ObservationList';
import PrintedDateForm from '../components/detective/PrintedDateForm';
import ProgressTracker from '../components/detective/ProgressTracker';
import SavePanel from '../components/detective/SavePanel';
import { estimateDate } from '../detective/dateEstimator';
import { containsDate, intersect } from '../detective/dateRange';
import { findConflicts, inspectClueSet } from '../detective/clueValidation';
import { HISTORICAL_EVENTS, searchEvents } from '../detective/historicalEvents';
import {
  addEventObservation,
  addPrintedDate,
  applyPreset,
  browserStorage,
  clearCurrent,
  clueIdOf,
  cluesOf,
  deleteSaved,
  listSaved,
  loadCurrent,
  newInvestigation,
  PRESETS,
  progressOf,
  removeObservation,
  saveCurrent,
  saveNamed,
  updateObservation,
} from '../detective/investigation';
import type { Investigation, ObservationPatch, Preset, SavedInvestigation } from '../detective/investigation';
import type { Certainty, PrintedDateMeaning } from '../detective/clues';
import type { Estimate, HistoricalEvent, Observation } from '../detective/types';
import { formatDate } from '../history/historyService';
import { notifyProgressChanged } from '../profile/events';
import { recordInvestigationRun, recordYearViewed } from '../profile/profileStore';
import { useHistoryService } from '../history/useHistoryService';
import type { HistoricalExample } from '../history/examples';
import { STATUS_LABEL } from '../history/types';
import { useAuth } from '../hooks/useAuth';
import {
  deleteCloudInvestigation,
  saveCloudInvestigation,
  syncInvestigationsWithCloud,
} from '../detective/investigationCloudService';
import type { Anchor, HistoricalFeature } from '../history/types';

type Tab = 'search' | 'case' | 'estimate' | 'cases';
type Notice = { kind: 'ok' | 'warn'; text: string } | null;

const EMPTY: readonly HistoricalFeature[] = [];

export default function DetectivePage() {
  const { load, retry } = useHistoryService();
  const service = load.status === 'ready' ? load.service : null;
  const store = useMemo(() => browserStorage(), []);

  const { user, isGuest } = useAuth();
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const restored = useMemo(() => loadCurrent(store), [store]);
  const [inv, setInv] = useState<Investigation>(() => restored?.investigation ?? newInvestigation());
  const [saves, setSaves] = useState<SavedInvestigation[]>(() => listSaved(store));
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimateSig, setEstimateSig] = useState('');
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>(() => (restored && restored.investigation.observations.length > 0 ? 'case' : 'search'));
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<Notice>(() =>
    restored && restored.investigation.observations.length > 0
      ? {
          kind: restored.dropped > 0 ? 'warn' : 'ok',
          text: `Restored “${restored.investigation.name}” with ${restored.investigation.observations.length} observation${restored.investigation.observations.length === 1 ? '' : 's'}.${restored.dropped > 0 ? ` ${restored.dropped} saved item${restored.dropped === 1 ? ' was' : 's were'} no longer valid and left out.` : ''}`,
        }
      : null,
  );
  const globeRef = useRef<GlobeViewHandle>(null);

  // Autosave the working investigation.
  useEffect(() => {
    saveCurrent(store, inv);
  }, [store, inv]);

  // Synchronize case files with Firestore when authenticated
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setCloudSyncing(true);
    void syncInvestigationsWithCloud(user.uid, saves)
      .then((merged) => {
        if (!cancelled) {
          setSaves(merged);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCloudSyncing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ----- reference globe ---------------------------------------------------------------------
  const year = inv.viewYear;
  const anchor = inv.anchor;
  const shownYear = useDeferredValue(year);
  const snapshot = useMemo(() => service?.snapshot(shownYear, anchor) ?? null, [service, shownYear, anchor]);
  const features = snapshot?.covered ? snapshot.features : EMPTY;
  const date = snapshot?.date ?? '';
  useEffect(() => {
    if (snapshot?.covered && recordYearViewed(store, shownYear)) notifyProgressChanged();
  }, [snapshot, shownYear, store]);
  const selectedFeature = useMemo(
    () => (selectedGw === null ? null : (features.find((f) => f.properties.gw === selectedGw) ?? null)),
    [features, selectedGw],
  );
  const markerYears = useMemo(() => service?.markerYears() ?? [], [service]);
  const gap = snapshot && !snapshot.covered ? snapshot.gap : null;

  const setView = useCallback((patch: Partial<Pick<Investigation, 'viewYear' | 'anchor'>>) => {
    setInv((cur) => ({ ...cur, ...patch, explored: true }));
  }, []);
  const handleYear = useCallback((y: number) => setView({ viewYear: y }), [setView]);
  const handleAnchor = useCallback((a: Anchor) => setView({ anchor: a }), [setView]);
  const handleExample = useCallback(
    (ex: HistoricalExample) => {
      setView({ viewYear: ex.year, anchor: 'start' });
      setSelectedGw(ex.gw);
      setTab('search');
    },
    [setView],
  );
  const handleSelect = useCallback((f: HistoricalFeature) => {
    setSelectedGw(f.properties.gw);
    setTab('search');
    setInv((cur) => (cur.explored ? cur : { ...cur, explored: true }));
  }, []);
  const markExplored = useCallback(() => setInv((cur) => (cur.explored ? cur : { ...cur, explored: true })), []);

  // ----- observations / clues ----------------------------------------------------------------
  const clues = useMemo(() => cluesOf(inv), [inv]);
  const signature = useMemo(
    () => JSON.stringify([inv.observations.map((o) => [clueIdOf(o), o.certainty]), inv.reuseLagYears]),
    [inv.observations, inv.reuseLagYears],
  );
  const stale = estimate !== null && estimateSig !== signature;
  const estimateCurrent = estimate !== null && !stale;

  const liveConflicts = useMemo(() => findConflicts(clues), [clues]);
  const issues = useMemo(() => inspectClueSet(clues), [clues]);
  const conflicting = useMemo(() => {
    const ids = new Set<string>();
    for (const c of liveConflicts) c.clueIds.forEach((id) => ids.add(id));
    for (const i of issues) if (i.kind === 'opposite' || i.kind === 'exclusive-group') i.clueIds.forEach((id) => ids.add(id));
    return ids;
  }, [liveConflicts, issues]);

  const roles = useMemo<ReadonlyMap<string, ClueRole> | null>(() => {
    if (!estimate || stale || estimate.status !== 'ok' || !estimate.information) return null;
    const first = estimate.information.ranges[0];
    const last = estimate.information.ranges[estimate.information.ranges.length - 1];
    const map = new Map<string, ClueRole>();
    for (const c of clues) {
      if (!estimate.bindingClueIds.includes(c.id)) {
        map.set(c.id, 'consistent');
        continue;
      }
      const sets = {
        earliest: first.start !== null && first.start !== estimate.assumptions.earliestPlausible && c.contentRanges.some((r) => r.start === first.start),
        latest: last.end !== null && last.end !== estimate.assumptions.today && c.contentRanges.some((r) => r.end === last.end),
      };
      map.set(c.id, sets.earliest && sets.latest ? 'sets-both' : sets.earliest ? 'sets-earliest' : sets.latest ? 'sets-latest' : 'sets-both');
    }
    return map;
  }, [estimate, stale, clues]);

  const progress = useMemo(() => progressOf(inv, { estimateCurrent, estimate }), [inv, estimateCurrent, estimate]);
  const addedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const o of inv.observations) if (o.source === 'event' && o.eventId) s.add(`${o.observation}:${o.eventId}`);
    return s;
  }, [inv.observations]);

  const run = useCallback(() => {
    if (clues.length === 0) return;
    const result = estimateDate(clues, { reuseLagYears: inv.reuseLagYears });
    setEstimate(result);
    setEstimateSig(signature);
    setTab('estimate');
    setNotice(null);
    recordInvestigationRun(store, {
      name: inv.name,
      clueCount: clues.length,
      status: result.status === 'contradictory' ? 'contradictory' : 'ok',
      rangeText: result.information?.text ?? 'no estimate',
      widthYears: result.information?.widthYears ?? null,
      confidence: result.confidence.information.level,
      labels: clues.slice(0, 6).map((c) => c.label),
      investigation: inv,
    });
    notifyProgressChanged();
  }, [clues, inv, signature, store]);

  const handleAdd = useCallback(
    (eventId: string, observation: Observation, certainty: Certainty) => {
      const r = addEventObservation(inv, eventId, observation, certainty);
      if (r.status === 'added') {
        setInv({ ...r.investigation, explored: true });
        const name = HISTORICAL_EVENTS.find((e) => e.id === eventId)?.subject ?? eventId;
        setNotice({ kind: 'ok', text: `Added to the case file: ${observation === 'shows' ? 'globe shows' : 'globe lacks'} ${name}.` });
      } else {
        setNotice({ kind: 'warn', text: r.message });
      }
    },
    [inv],
  );

  const handleAddPrinted = useCallback(
    (y: number, meaning: PrintedDateMeaning, certainty: Certainty): string | null => {
      const r = addPrintedDate(inv, y, meaning, certainty);
      if (r.status !== 'added') return r.message;
      setInv({ ...r.investigation, explored: true });
      setNotice({ kind: 'ok', text: `Added the printed date ${y} to the case file.` });
      return null;
    },
    [inv],
  );

  const handleUpdate = useCallback(
    (id: string, patch: ObservationPatch): string | null => {
      const r = updateObservation(inv, id, patch);
      if (r.error) return r.error;
      setInv(r.investigation);
      return null;
    },
    [inv],
  );

  const handleRemove = useCallback((id: string) => {
    setInv((cur) => removeObservation(cur, id));
    setNotice({ kind: 'ok', text: 'Observation removed.' });
  }, []);

  const removeClueById = useCallback((clueId: string) => {
    setInv((cur) => {
      const o = cur.observations.find((x) => clueIdOf(x) === clueId);
      return o ? removeObservation(cur, o.id) : cur;
    });
  }, []);

  const keepOnly = useCallback((ids: string[]) => {
    setInv((cur) => ({ ...cur, observations: cur.observations.filter((o) => ids.includes(clueIdOf(o) ?? '')) }));
    setNotice({ kind: 'ok', text: 'Kept only the clues in that reading. Run the estimate again.' });
  }, []);

  const loadPreset = useCallback((p: Preset) => {
    setInv((cur) => applyPreset(cur, p));
    setEstimate(null);
    setTab('case');
    setNotice({ kind: 'ok', text: `Loaded the example “${p.title}”. Run the estimate to see what it implies.` });
  }, []);

  const clearAll = useCallback(() => {
    setInv((cur) => ({ ...newInvestigation(), viewYear: cur.viewYear, anchor: cur.anchor }));
    setEstimate(null);
    setEstimateSig('');
    setSelectedGw(null);
    setConfirmClear(false);
    clearCurrent(store);
    setTab('search');
    setNotice({ kind: 'ok', text: 'Investigation cleared. Saved investigations are untouched.' });
  }, [store]);

  const save = useCallback(
    (name: string): string | null => {
      const r = saveNamed(store, name, inv);
      if (!r.ok) return r.error ?? 'Could not save.';
      setSaves(r.saves);
      const clean = name.trim().slice(0, 80);
      const updatedInv = { ...inv, name: clean };
      setInv(updatedInv);
      if (user) {
        const savedEntry = r.saves.find((s) => s.name.toLowerCase() === clean.toLowerCase());
        void saveCloudInvestigation(user.uid, updatedInv, savedEntry?.id);
      }
      return null;
    },
    [store, inv, user],
  );

  const openSaved = useCallback(
    (id: string) => {
      const s = saves.find((x) => x.id === id);
      if (!s) return;
      setInv(s.investigation);
      setEstimate(null);
      setEstimateSig('');
      setSelectedGw(null);
      setTab('case');
      setNotice({ kind: 'ok', text: `Opened “${s.name}”. Run the estimate to refresh the result.` });
    },
    [saves],
  );

  const removeSaved = useCallback(
    (id: string) => {
      setSaves(deleteSaved(store, id));
      if (user) {
        void deleteCloudInvestigation(user.uid, id);
      }
    },
    [store, user],
  );

  // ----- moving the reference globe ----------------------------------------------------------
  const showEventOnGlobe = useCallback(
    (e: HistoricalEvent) => {
      if (!service) return;
      const { firstYear, lastYear } = service.meta;
      const r = e.valid.find((v) => v.start !== null && Number(v.start.slice(0, 4)) >= firstYear) ?? e.valid[e.valid.length - 1];
      const clampYear = (y: number) => Math.min(Math.max(y, firstYear), lastYear);
      let y: number;
      let a: Anchor;
      if (r.start !== null && r.start >= `${firstYear}-01-01`) {
        y = clampYear(Number(r.start.slice(0, 4)));
        a = 'end';
      } else {
        y = clampYear(Number((r.end ?? r.start ?? `${firstYear}`).slice(0, 4)));
        a = 'start';
      }
      setView({ viewYear: y, anchor: a });
      setSelectedGw(e.gw ?? null);
      setNotice({ kind: 'ok', text: `Reference globe moved to ${a === 'end' ? '31 Dec' : '1 Jan'} ${y}.` });
    },
    [service, setView],
  );

  const periodYear = useMemo(() => {
    if (!service || !estimate || estimate.status !== 'ok' || !estimate.information) return null;
    const cov = [{ start: `${service.meta.firstYear}-01-01`, end: `${service.meta.lastYear}-12-31` }];
    const hit = intersect(estimate.information.ranges, cov);
    if (hit.length === 0) return null;
    const s = Number((hit[0].start ?? cov[0].start).slice(0, 4));
    const e = Number((hit[hit.length - 1].end ?? cov[0].end).slice(0, 4));
    return Math.round((s + e) / 2);
  }, [service, estimate]);

  const showPeriod = useCallback(() => {
    if (periodYear === null) return;
    setView({ viewYear: periodYear, anchor: 'mid' });
    setNotice({ kind: 'ok', text: `Reference globe moved to 1 Jul ${periodYear}, the middle of the estimated period.` });
  }, [periodYear, setView]);

  // ----- selected state → clue suggestions ---------------------------------------------------
  const related = useMemo(() => {
    if (!selectedFeature) return [];
    const p = selectedFeature.properties;
    const seen = new Set<string>();
    const out: HistoricalEvent[] = [];
    for (const e of [...HISTORICAL_EVENTS.filter((x) => x.gw === p.gw), ...searchEvents(p.name, 4)]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        out.push(e);
      }
    }
    return out.sort((a, b) => Number(containsDate(b.valid, date)) - Number(containsDate(a.valid, date))).slice(0, 6);
  }, [selectedFeature, date]);

  const overlay = (
    <>
      {load.status === 'loading' && <GlobeLoader visible message="Opening the archive…" detail="Loading historical boundaries" />}
      {load.status === 'error' && (
        <div className="globe-overlay globe-overlay--error" role="alert">
          <p className="globe-overlay__title">Couldn’t load the reference globe</p>
          <p className="globe-overlay__detail">{load.message}</p>
          <button type="button" className="btn" onClick={retry}>Try again</button>
        </div>
      )}
      {gap && service && <CoverageNotice gap={gap} firstYear={service.meta.firstYear} lastYear={service.meta.lastYear} onGoTo={handleYear} />}
    </>
  );

  const n = inv.observations.length;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'search', label: 'Search' },
    { id: 'case', label: `Case file${n ? ` (${n})` : ''}` },
    { id: 'estimate', label: stale ? 'Estimate ●' : 'Estimate' },
    { id: 'cases', label: 'Cases' },
  ];

  return (
    <section className="atlas desk">
      <header className="atlas__head">
        <p className="eyebrow">Mode 1 · Investigate</p>
        <h1 className="page__title">
          The <span>investigation</span> desk
        </h1>
        <p className="atlas__intro">
          Compare your globe with the reference globe, search the names you find on it, and record what it shows or lacks. Each clue narrows the range of dates; the desk shows its reasoning.
        </p>
      </header>

      <TimelineBar
        year={year}
        anchor={anchor}
        date={date}
        coverageFirst={service?.meta.firstYear ?? 1886}
        coverageLast={service?.meta.lastYear ?? 2019}
        markerYears={markerYears}
        activeExampleId={null}
        onYear={handleYear}
        onAnchor={handleAnchor}
        onExample={handleExample}
      />

      <div className="atlas__body">
        <div className="atlas__globe">
          <div className="atlas__globe-frame">
            <GlobeView<HistoricalFeature>
              ref={globeRef}
              polygons={features}
              keyOf={keyOf}
              tooltipOf={tooltipOf}
              polygonColor={colorOf}
              selectedKey={selectedFeature?.properties.key ?? null}
              onSelect={handleSelect}
              overlay={overlay}
              hint="Reference globe · click a state to see clues linked to it"
            />
          </div>
          <StatusLegend counts={snapshot?.covered ? snapshot.counts : null} undefinedBoundaryCount={snapshot?.covered ? snapshot.undefinedBoundaryCount : 0} />
        </div>

        <aside className="atlas__panel panel desk__panel" aria-label="Investigation desk">
          <ProgressTracker steps={progress.steps} done={progress.done} fraction={progress.fraction} />

          <div className="desk__actions">
            <button type="button" className="btn" onClick={run} disabled={n === 0} title={n === 0 ? 'Add an observation first' : 'Combine the observations into a date range'}>
              Run estimate
            </button>
            {!confirmClear ? (
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmClear(true)} disabled={n === 0 && estimate === null}>
                Clear investigation
              </button>
            ) : (
              <span className="desk__confirm" role="group" aria-label="Confirm clearing">
                <span>Remove all observations?</span>
                <button type="button" className="btn btn--small btn--danger" onClick={clearAll}>Yes, clear</button>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </span>
            )}
          </div>

          {notice && (
            <div className={`notice notice--${notice.kind}`} role="status">
              {notice.text}
              <button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button>
            </div>
          )}

          {liveConflicts.length > 0 && tab !== 'estimate' && (
            <div className="notice notice--bad" role="alert">
              <strong>Contradiction:</strong> {liveConflicts[0].message}
              {liveConflicts.length > 1 && ` (and ${liveConflicts.length - 1} more)`}
              <button type="button" className="btn btn--small" onClick={() => setTab('case')}>Review the clues</button>
            </div>
          )}
          {issues.filter((i) => i.kind === 'redundant').length > 0 && tab === 'case' && (
            <p className="muted desk__issue">
              {issues.filter((i) => i.kind === 'redundant').map((i) => i.message).join(' ')}
            </p>
          )}

          <div className="tabs" role="tablist" aria-label="Desk sections">
            {tabs.map((t) => (
              <button key={t.id} role="tab" type="button" id={`dtab-${t.id}`} aria-selected={tab === t.id} aria-controls={`dpanel-${t.id}`} className="tabs__tab" onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`dpanel-${tab}`} aria-labelledby={`dtab-${tab}`} className="tabs__panel">
            {tab === 'search' && (
              <>
                <p className="selected-line">
                  {selectedFeature ? (
                    <>
                      On the globe: <strong>{selectedFeature.properties.name}</strong> · {STATUS_LABEL[selectedFeature.properties.status]} · {formatDate(date)}{' '}
                      <a href={`#/timeline?year=${year}&gw=${selectedFeature.properties.gw}`}>Open on the timeline</a>
                    </>
                  ) : (
                    'Click a state on the reference globe to see clues linked to it.'
                  )}
                </p>
                <NameSearch
                  added={addedKeys}
                  related={related}
                  relatedTitle={selectedFeature ? `Clues linked to ${selectedFeature.properties.name}` : null}
                  onAdd={handleAdd}
                  onShowOnGlobe={showEventOnGlobe}
                  onSearched={markExplored}
                />
                <PrintedDateForm onAdd={handleAddPrinted} />
              </>
            )}
            {tab === 'case' && (
              <ObservationList
                observations={inv.observations}
                conflicting={conflicting}
                roles={roles}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                onShowOnGlobe={showEventOnGlobe}
              />
            )}
            {tab === 'estimate' && (
              <EstimatePanel
                estimate={estimate}
                stale={stale}
                observations={inv.observations}
                reuseLagYears={inv.reuseLagYears}
                onLagChange={(y) => setInv((cur) => ({ ...cur, reuseLagYears: y }))}
                onRun={run}
                canRun={n > 0}
                onShowPeriod={showPeriod}
                canShowPeriod={periodYear !== null}
                onKeepOnly={keepOnly}
                onRemoveClue={removeClueById}
              />
            )}
            {tab === 'cases' && (
              <>
                <h2 className="desk__h3">Try an example</h2>
                <ul className="presets">
                  {PRESETS.map((p) => (
                    <li key={p.id} className="preset">
                      <div>
                        <strong>{p.title}</strong>
                        <p className="muted">{p.blurb}</p>
                      </div>
                      <button type="button" className="btn btn--small" onClick={() => loadPreset(p)}>Load</button>
                    </li>
                  ))}
                </ul>
                <SavePanel storageAvailable={store !== null} name={inv.name} saves={saves} onSave={save} onLoad={openSaved} onDelete={removeSaved} isGuest={isGuest} cloudSyncing={cloudSyncing} />
              </>
            )}
          </div>
        </aside>
      </div>

      <p className="atlas__credit">
        Reference borders: CShapes 2.0 (Schvitz et al. 2022), non-commercial use. Event dates are curated with sources; see <a href="#/about">About</a> for limits. An estimate is a range with stated assumptions, never a certain year.
      </p>
    </section>
  );
}
