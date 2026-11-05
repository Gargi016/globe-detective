import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchLeaderboard, getMonthlyPeriodKey, getWeeklyPeriodKey } from '../leaderboard/leaderboardService';
import type { LeaderboardEntryDoc, LeaderboardPeriodType } from '../types/database';
import { EMBLEMS } from '../profile/profileStore';
import { browserStorage } from '../detective/investigation';
import { loadProgress } from '../challenge/progress';
import { reconcileCloudLeaderboard, syncLocalChallengesToCloud } from '../challenge/challengeCloudService';

export default function LeaderboardPage() {
  const { user, isGuest, openAuthModal } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriodType>('global');
  const [entries, setEntries] = useState<LeaderboardEntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const store = useMemo(() => browserStorage(), []);
  const localProgress = useMemo(() => loadProgress(store), [store]);

  const loadRankings = useCallback(async (selectedPeriod: LeaderboardPeriodType) => {
    setLoading(true);
    setError(null);
    try {
      if (user && !isGuest) {
        // Automatically sync any offline or guest challenges to the cloud & leaderboard
        const currentProgress = loadProgress(store);
        if (currentProgress.history.length > 0) {
          await syncLocalChallengesToCloud(user.uid, currentProgress.history);
          await reconcileCloudLeaderboard(user.uid, currentProgress.stats.totalPoints, currentProgress.stats.played);
        }
      }
      const data = await fetchLeaderboard(selectedPeriod);
      setEntries(data);
    } catch {
      setError('Could not load leaderboard rankings. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user, isGuest, store]);

  useEffect(() => {
    void loadRankings(period);
  }, [period, loadRankings]);

  const myEntry = useMemo(() => entries.find((e) => e.uid === user?.uid), [entries, user]);
  const localPoints = localProgress.stats.totalPoints;
  const cloudPoints = myEntry?.points ?? 0;
  const hasUnsyncedPoints = !isGuest && user && localPoints > cloudPoints;

  const handleManualSync = async () => {
    if (!user) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const currentProgress = loadProgress(store);
      // 1. Submit any missing attempts
      await syncLocalChallengesToCloud(user.uid, currentProgress.history);
      // 2. Reconcile leaderboard entry with full points
      const rec = await reconcileCloudLeaderboard(user.uid, currentProgress.stats.totalPoints, currentProgress.stats.played);
      if (rec.success) {
        setSyncStatus({
          type: 'ok',
          message: `Successfully verified and synced! Leaderboard updated to ${rec.points ?? localPoints} pts.`,
        });
        await loadRankings(period);
      } else {
        setSyncStatus({
          type: 'error',
          message: rec.error ? `Sync issue: ${rec.error}` : 'Could not synchronize. Please try again.',
        });
      }
    } catch (err) {
      setSyncStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred during synchronization.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const currentPeriodSubtitle =
    period === 'global'
      ? 'All-time verified detective rankings across all challenge modes.'
      : period === 'weekly'
        ? `Rankings for Week ${getWeeklyPeriodKey().split('-W')[1]} (${getWeeklyPeriodKey()}). Resets every Monday.`
        : `Rankings for ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} (${getMonthlyPeriodKey()}).`;

  const getGlyph = (emblemId: string) => {
    return EMBLEMS.find((e) => e.id === emblemId)?.glyph ?? '✦';
  };

  return (
    <section className="page leaderboard">
      <p className="eyebrow">Hall of Cartographers</p>
      <h1 className="page__title">
        Global <span>Leaderboard</span>
      </h1>

      {isGuest && (
        <div className="notice notice--ok leaderboard__guest-notice">
          <div>
            <strong>Guest Mode:</strong> You are currently playing as a guest. Sign in with an account to compete and record verified scores on the leaderboard.
          </div>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => openAuthModal('signin')}
          >
            Sign in to Compete
          </button>
        </div>
      )}

      {hasUnsyncedPoints && (
        <div className="notice notice--ok" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <strong>Local Scores Ready to Sync:</strong> You have <strong>{localPoints} pts ({localProgress.stats.played} challenges)</strong> on this device, but only <strong>{cloudPoints} pts</strong> are recorded on the cloud leaderboard.
            {syncStatus && (
              <div style={{ marginTop: '0.25rem', color: syncStatus.type === 'error' ? 'var(--red, #f87171)' : 'var(--green, #4ade80)' }}>
                {syncStatus.message}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn--small btn--primary"
            disabled={syncing}
            onClick={() => void handleManualSync()}
          >
            {syncing ? 'Verifying with Edge…' : `Sync ${localPoints - cloudPoints} pts to Leaderboard`}
          </button>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Leaderboard Periods">
        <button
          type="button"
          role="tab"
          aria-selected={period === 'global'}
          className="tabs__tab"
          onClick={() => setPeriod('global')}
        >
          All-Time (Global)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'weekly'}
          className="tabs__tab"
          onClick={() => setPeriod('weekly')}
        >
          This Week
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={period === 'monthly'}
          className="tabs__tab"
          onClick={() => setPeriod('monthly')}
        >
          This Month
        </button>
      </div>

      <p className="muted leaderboard__subtitle">{currentPeriodSubtitle}</p>

      {loading ? (
        <div className="page-loading" role="status" aria-live="polite">
          <span className="page-loading__ring" aria-hidden="true" />
          <p>Consulting the global archive…</p>
        </div>
      ) : error ? (
        <div className="notice notice--bad" role="alert">
          {error}
          <button type="button" className="btn btn--small" onClick={() => void loadRankings(period)}>
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="panel leaderboard__empty">
          <p className="desk__h3">The board is clear</p>
          <p className="muted">
            No detectives have recorded verified scores for this period yet. Solve a challenge to claim the first spot in the archive!
          </p>
          <a href="#/challenge" className="btn btn--primary">
            Play Challenge Mode
          </a>
        </div>
      ) : (
        <div className="panel leaderboard__table-wrap">
          <table className="leaderboard__table">
            <thead>
              <tr>
                <th scope="col" className="col--rank">Rank</th>
                <th scope="col" className="col--detective">Detective</th>
                <th scope="col" className="col--points">Points</th>
                <th scope="col" className="col--played">Challenges</th>
                <th scope="col" className="col--streak">Best Streak</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = user?.uid === entry.uid;
                return (
                  <tr
                    key={entry.uid}
                    className={`leaderboard__row${isMe ? ' leaderboard__row--me' : ''}`}
                  >
                    <td className="col--rank">
                      <span className={`rank-badge ${entry.rank && entry.rank <= 3 ? `rank-badge--top rank-badge--${entry.rank}` : ''}`}>
                        {entry.rank ?? '—'}
                      </span>
                    </td>
                    <td className="col--detective">
                      <div className="leaderboard__user-cell">
                        <span className="leaderboard__emblem" aria-hidden="true">
                          {getGlyph(entry.emblem)}
                        </span>
                        <div>
                          <div className="leaderboard__display-name">
                            {entry.displayName}
                            {isMe && <span className="leaderboard__you-pill">You</span>}
                          </div>
                          <div className="leaderboard__username">@{entry.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col--points">
                      <strong>{entry.points}</strong>
                    </td>
                    <td className="col--played">{entry.challengesPlayed}</td>
                    <td className="col--streak">{entry.bestStreak}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
