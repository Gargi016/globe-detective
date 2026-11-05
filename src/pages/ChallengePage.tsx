import { useCallback, useEffect, useMemo, useState } from 'react';
import GlobeView from '../components/GlobeView';
import GlobeLoader from '../components/GlobeLoader';
import StatusLegend from '../components/history/StatusLegend';
import { colorOf, keyOf, tooltipOf } from '../components/history/globeStyle';
import ChallengeMenu from '../components/challenge/ChallengeMenu';
import PlayPanel from '../components/challenge/PlayPanel';
import ResultScreen from '../components/challenge/ResultScreen';
import { dailySeed, DIFFICULTIES, generateChallenge } from '../challenge/generator';
import type { Challenge, Difficulty } from '../challenge/generator';
import { buildHints } from '../challenge/hints';
import { browserStorage, loadProgress, localDateKey, recordResult, resetProgress, saveProgress, STREAK_MIN_POINTS } from '../challenge/progress';
import type { ChallengeResult, ProgressState } from '../challenge/progress';
import { randomSeed } from '../challenge/random';
import { buildReveal } from '../challenge/reveal';
import type { Reveal } from '../challenge/reveal';
import type { GuessScore } from '../challenge/scoring';
import { escapeHtml } from '../lib/html';
import { notifyProgressChanged } from '../profile/events';
import { STATUS_LABEL } from '../history/types';
import { useAuth } from '../hooks/useAuth';
import { fetchCloudChallenges, submitChallengeAttempt } from '../challenge/challengeCloudService';
import type { HistoricalFeature } from '../history/types';
import { useHistoryService } from '../history/useHistoryService';

type Screen = 'menu' | 'play' | 'result';
const EMPTY: readonly HistoricalFeature[] = [];

interface Finished {
  challenge: Challenge;
  score: GuessScore;
  hintsUsed: number;
  reveal: Reveal;
  streakBroken: boolean;
  verified?: boolean;
}

/** On Hard the names are hidden until the reveal: the tooltip gives only the status. */
function tooltipHidden(f: HistoricalFeature): string {
  const p = f.properties;
  const status = p.ownerName ? `${STATUS_LABEL[p.status]}` : STATUS_LABEL[p.status];
  return `<div class="globe-tooltip"><strong>${escapeHtml(status)}</strong><span>Name hidden on Hard</span></div>`;
}

export default function ChallengePage() {
  const { load, retry } = useHistoryService();
  const service = load.status === 'ready' ? load.service : null;
  const store = useMemo(() => browserStorage(), []);
  const { user, isGuest } = useAuth();
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(store));
  const [screen, setScreen] = useState<Screen>('menu');
  const [finished, setFinished] = useState<Finished | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [today, setToday] = useState(() => localDateKey());

  useEffect(() => {
    saveProgress(store, progress);
    notifyProgressChanged();
  }, [store, progress]);

  // Synchronize cloud challenge attempts when user is authenticated
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchCloudChallenges(user.uid).then((cloudResults) => {
      if (!cancelled && cloudResults.length > 0) {
        setProgress((prev) => {
          const existingIds = new Set(prev.history.map((r) => r.id));
          const missing = cloudResults.filter((r) => !existingIds.has(r.id));
          if (missing.length === 0) return prev;
          let merged = prev;
          for (const item of missing.reverse()) {
            merged = recordResult(merged, item);
          }
          return merged;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // The daily challenge rolls over at the player's midnight even if the page stays open.
  useEffect(() => {
    const id = window.setInterval(() => setToday(localDateKey()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const active = progress.active;
  const challenge = useMemo<Challenge | null>(
    () => (service && active ? generateChallenge(service, active.seed, active.difficulty, active.daily) : null),
    [service, active?.seed, active?.difficulty, active?.daily], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const hints = useMemo(() => (service && challenge ? buildHints(service, challenge) : []), [service, challenge]);

  // The map on screen: the active challenge while playing, the finished one on the result screen.
  const shown = screen === 'result' && finished ? finished.challenge : screen === 'play' ? challenge : null;
  const snapshot = useMemo(() => (service && shown ? service.snapshot(shown.year, shown.anchor) : null), [service, shown]);
  const features = snapshot?.covered ? snapshot.features : EMPTY;
  const selected = useMemo(() => features.find((f) => f.properties.key === selectedKey) ?? null, [features, selectedKey]);
  const namesVisible = screen === 'result' || (shown ? DIFFICULTIES[shown.difficulty].showNames : true);

  const begin = useCallback((difficulty: Difficulty, daily: string | null) => {
    setProgress((p) => ({
      ...p,
      difficulty: daily ? p.difficulty : difficulty,
      active: { seed: daily ? dailySeed(daily) : randomSeed(), difficulty, daily, hintsUsed: 0, guessText: '', startedAt: Date.now() },
    }));
    setFinished(null);
    setSelectedKey(null);
    setScreen('play');
  }, []);

  const submit = useCallback(
    async (year: number) => {
      if (!service || !challenge || !active) return;
      const { attemptId, verified, score } = await submitChallengeAttempt(
        {
          seed: challenge.seed,
          difficulty: challenge.difficulty,
          daily: challenge.daily,
          refDate: challenge.refDate,
          intervalStart: challenge.interval.start,
          intervalEnd: challenge.interval.end,
          startYear: challenge.interval.startYear,
          endYear: challenge.interval.endYear,
          guess: year,
          hintsUsed: active.hintsUsed,
        },
        user?.uid,
      );

      const result: ChallengeResult = {
        id: attemptId || challenge.id,
        seed: challenge.seed,
        difficulty: challenge.difficulty,
        daily: challenge.daily,
        refDate: challenge.refDate,
        intervalStart: challenge.interval.start,
        intervalEnd: challenge.interval.end,
        startYear: challenge.interval.startYear,
        endYear: challenge.interval.endYear,
        guess: year,
        distance: score.distance,
        base: score.base,
        penalty: score.penalty,
        points: score.points,
        hintsUsed: active.hintsUsed,
        playedAt: Date.now(),
      };
      const streakBroken = progress.stats.streak.current > 0 && score.points < STREAK_MIN_POINTS;
      setProgress((p) => recordResult(p, result));
      setFinished({
        challenge,
        score,
        hintsUsed: active.hintsUsed,
        reveal: buildReveal(service, challenge),
        streakBroken,
        verified,
      });
      setSelectedKey(null);
      setScreen('result');
    },
    [service, challenge, active, progress.stats.streak.current, user?.uid],
  );

  const another = useCallback(() => begin(finished?.challenge.difficulty === 'medium' && finished.challenge.daily ? progress.difficulty : (finished?.challenge.difficulty ?? progress.difficulty), null), [begin, finished, progress.difficulty]);

  const overlay =
    load.status === 'loading' ? (
      <GlobeLoader visible message="Opening the archive…" detail="Loading historical boundaries" />
    ) : load.status === 'error' ? (
      <div className="globe-overlay globe-overlay--error" role="alert">
        <p className="globe-overlay__title">Couldn’t load the historical data</p>
        <p className="globe-overlay__detail">{load.message}</p>
        <button type="button" className="btn" onClick={retry}>Try again</button>
      </div>
    ) : null;

  if (screen === 'menu' || !shown) {
    return (
      <section className="page challenge">
        <p className="eyebrow">Mode 2 · Compete</p>
        <h1 className="page__title">Challenge <span>Mode</span></h1>
        <p className="atlas__intro">A mystery globe, a hidden year. Study its borders and names, ask for hints if you need them, and guess when it was drawn.</p>
        {load.status === 'error' && overlay}
        <ChallengeMenu
          progress={progress}
          today={today}
          ready={service !== null}
          storageAvailable={store !== null}
          onStart={(d) => begin(d, null)}
          onDaily={() => begin('medium', today)}
          onResume={() => { setSelectedKey(null); setScreen('play'); }}
          onReset={() => { setProgress((p) => resetProgress(p)); setFinished(null); }}
        />
      </section>
    );
  }

  return (
    <section className="atlas challenge challenge--game">
      <div className="atlas__body">
        <div className="atlas__globe">
          <div className="atlas__globe-frame">
            <GlobeView<HistoricalFeature>
              polygons={features}
              keyOf={keyOf}
              tooltipOf={namesVisible ? tooltipOf : tooltipHidden}
              polygonColor={colorOf}
              selectedKey={selectedKey}
              onSelect={(f) => setSelectedKey(f.properties.key)}
              overlay={overlay}
              hint={screen === 'result' ? 'The reveal · hover to read the names' : 'Mystery globe · rotate, zoom and click states'}
            />
          </div>
          <StatusLegend counts={snapshot?.covered ? snapshot.counts : null} undefinedBoundaryCount={snapshot?.covered ? snapshot.undefinedBoundaryCount : 0} />
        </div>

        <aside className="atlas__panel panel challenge__panel" aria-label={screen === 'result' ? 'Result' : 'Challenge'}>
          {screen === 'play' && challenge && active && (
            <PlayPanel
              challenge={challenge}
              hints={hints}
              hintsUsed={Math.min(active.hintsUsed, hints.length)}
              guessText={active.guessText}
              selected={selected}
              onGuessText={(t) => setProgress((p) => (p.active ? { ...p, active: { ...p.active, guessText: t.slice(0, 4) } } : p))}
              onHint={() => setProgress((p) => (p.active && p.active.hintsUsed < hints.length ? { ...p, active: { ...p.active, hintsUsed: p.active.hintsUsed + 1 } } : p))}
              onSubmit={submit}
              onSkip={() => begin(challenge.difficulty, null)}
              onLeave={() => setScreen('menu')}
            />
          )}
          {screen === 'result' && finished && (
            <ResultScreen
              challenge={finished.challenge}
              score={finished.score}
              hintsUsed={finished.hintsUsed}
              reveal={finished.reveal}
              progress={progress}
              today={today}
              streakBroken={finished.streakBroken}
              verified={finished.verified}
              isGuest={isGuest}
              onAnother={another}
              onMenu={() => setScreen('menu')}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
