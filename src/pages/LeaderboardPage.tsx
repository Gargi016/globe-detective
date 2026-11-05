import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchLeaderboard, getMonthlyPeriodKey, getWeeklyPeriodKey } from '../leaderboard/leaderboardService';
import type { LeaderboardEntryDoc, LeaderboardPeriodType } from '../types/database';
import { EMBLEMS } from '../profile/profileStore';
import { browserStorage } from '../detective/investigation';
import { loadProgress } from '../challenge/progress';
import { syncLocalChallengesToCloud } from '../challenge/challengeCloudService';

export default function LeaderboardPage() {
  const { user, isGuest, openAuthModal } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriodType>('global');
  const [entries, setEntries] = useState<LeaderboardEntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRankings = useCallback(async (selectedPeriod: LeaderboardPeriodType) => {
    setLoading(true);
    setError(null);
    try {
      if (user && !isGuest) {
        // Automatically sync any offline or guest challenges to the cloud & leaderboard
        const store = browserStorage();
        const localProgress = loadProgress(store);
        if (localProgress.history.length > 0) {
          await syncLocalChallengesToCloud(user.uid, localProgress.history);
        }
      }
      const data = await fetchLeaderboard(selectedPeriod);
      setEntries(data);
    } catch {
      setError('Could not load leaderboard rankings. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  useEffect(() => {
    void loadRankings(period);
  }, [period, loadRankings]);

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
