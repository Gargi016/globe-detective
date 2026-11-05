import { useCallback, useEffect, useMemo, useState } from 'react';
import AchievementGrid from '../components/profile/AchievementGrid';
import { ChallengeHistory, InvestigationHistory } from '../components/profile/HistoryLists';
import ProfileHeader from '../components/profile/ProfileHeader';
import StatsDashboard from '../components/profile/StatsDashboard';
import { PROGRESS_KEY, loadProgress, localDateKey } from '../challenge/progress';
import type { ProgressState } from '../challenge/progress';
import { CURRENT_KEY, SAVES_KEY, browserStorage, saveCurrent } from '../detective/investigation';
import { evaluateAchievements } from '../profile/achievements';
import { onProgressChanged, notifyProgressChanged } from '../profile/events';
import {
  DEFAULT_NAME,
  PROFILE_KEY,
  clearRunLog,
  loadProfile,
  removeRun,
  renameProfile,
  saveProfile,
  setEmblem,
} from '../profile/profileStore';
import type { EmblemId, InvestigationRecord, ProfileData } from '../profile/profileStore';
import { computeDashboard } from '../profile/stats';
import { syncAchievements } from '../profile/sync';
import { useAuth } from '../hooks/useAuth';
import { syncCloudStats } from '../profile/userProfileService';
import { reconcileAchievements, syncAchievementsWithCloud } from '../profile/achievementCloudService';

export default function ProfilePage() {
  const store = useMemo(() => browserStorage(), []);
  const { user, profile: cloudProfile, isGuest, openAuthModal, updateProfileData } = useAuth();

  const [profile, setProfile] = useState<ProfileData>(() => {
    syncAchievements(store);
    return loadProfile(store);
  });
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(store));
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'bad'; text: string } | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [today] = useState(() => localDateKey());

  const reload = useCallback(() => {
    setProfile(loadProfile(store));
    setProgress(loadProgress(store));
  }, [store]);

  // Pick up changes made elsewhere (badges stamped by the toast watcher).
  useEffect(() => onProgressChanged(reload), [reload]);

  const update = (next: ProfileData) => {
    if (!saveProfile(store, next)) {
      setNotice({
        kind: 'bad',
        text: 'This browser would not let the profile be saved (storage may be full or blocked). Changes will be lost on reload.',
      });
    }
    setProfile(next);
  };

  // Reconcile display name / emblem from cloud if local is still default
  useEffect(() => {
    if (cloudProfile && user) {
      setProfile((prev) => {
        let changed = false;
        let next = prev;
        if (cloudProfile.displayName && cloudProfile.displayName !== prev.name && prev.name === DEFAULT_NAME) {
          next = renameProfile(next, cloudProfile.displayName);
          changed = true;
        }
        if (cloudProfile.emblem && cloudProfile.emblem !== prev.emblem && prev.emblem === 'compass') {
          next = setEmblem(next, cloudProfile.emblem);
          changed = true;
        }
        if (changed) {
          saveProfile(store, next);
        }
        return next;
      });
    }
  }, [cloudProfile, user, store]);

  // Auto-sync statistics to cloud when authenticated
  useEffect(() => {
    if (user) {
      void syncCloudStats(user.uid, progress, profile);
    }
  }, [user, progress, profile]);

  // Synchronize unlocked achievements with cloud
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void syncAchievementsWithCloud(user.uid, profile.unlocked).then((mergedUnlocked) => {
      if (!cancelled) {
        setProfile((prev) => {
          const next = reconcileAchievements(prev, mergedUnlocked);
          if (next !== prev) {
            saveProfile(store, next);
          }
          return next;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleRename = (newName: string) => {
    const next = renameProfile(profile, newName);
    update(next);
    if (user) {
      void updateProfileData({ displayName: newName });
    }
  };

  const handleEmblem = (newEmblem: EmblemId) => {
    const next = setEmblem(profile, newEmblem);
    update(next);
    if (user) {
      void updateProfileData({ emblem: newEmblem });
    }
  };

  const handleUpdateUsername = async (newUsername: string) => {
    if (user) {
      const ok = await updateProfileData({ username: newUsername });
      if (ok) {
        setNotice({ kind: 'ok', text: `Detective codename updated to @${newUsername}.` });
      } else {
        setNotice({ kind: 'bad', text: 'Could not update codename. Please try again.' });
      }
    }
  };

  const dashboard = useMemo(() => computeDashboard(progress, profile, today), [progress, profile, today]);
  const statuses = useMemo(() => evaluateAchievements({ profile, challenge: progress }), [profile, progress]);

  const reopen = (r: InvestigationRecord) => {
    if (!saveCurrent(store, r.investigation)) {
      setNotice({ kind: 'bad', text: 'Could not hand the case file to Detective Mode because storage is unavailable.' });
      return;
    }
    window.location.hash = '#/detective';
  };

  const exportData = () => {
    const read = (k: string) => {
      try {
        const t = store?.getItem(k);
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    };
    const payload = {
      app: 'globe-detective',
      exportedAt: new Date().toISOString(),
      note: isGuest ? 'Local data from this browser only.' : `Cloud-backed data for user ${user?.email ?? user?.uid}.`,
      profile: read(PROFILE_KEY),
      challenge: read(PROGRESS_KEY),
      currentInvestigation: read(CURRENT_KEY),
      savedInvestigations: read(SAVES_KEY),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `globe-detective-${localDateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ kind: 'ok', text: 'Exported your data as a JSON file.' });
  };

  const erase = () => {
    for (const k of [PROFILE_KEY, PROGRESS_KEY, CURRENT_KEY, SAVES_KEY]) {
      try {
        store?.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    setConfirmErase(false);
    reload();
    notifyProgressChanged();
    setNotice({ kind: 'ok', text: 'All local Globe Detective data was erased from this browser.' });
  };

  return (
    <section className="page profile">
      <p className="eyebrow">Your record</p>
      <h1 className="page__title">
        Detective <span>profile</span>
      </h1>

      {!store && (
        <p className="notice notice--warn">
          This browser blocks local storage, so progress cannot be kept between visits.
        </p>
      )}
      {notice && <p className={`notice notice--${notice.kind}`} role="status">{notice.text}</p>}

      <ProfileHeader
        profile={profile}
        totalPoints={dashboard.totalPoints}
        onRename={handleRename}
        onEmblem={handleEmblem}
        username={cloudProfile?.username}
        isGuest={isGuest}
        onOpenAuth={() => openAuthModal('signin')}
        onUpdateUsername={handleUpdateUsername}
      />
      <StatsDashboard d={dashboard} />
      <AchievementGrid statuses={statuses} />
      <ChallengeHistory history={progress.history} />
      <InvestigationHistory
        log={profile.log}
        onReopen={reopen}
        onDelete={(id) => update(removeRun(profile, id))}
        onClear={() => update(clearRunLog(profile))}
      />

      <section className="panel" aria-labelledby="data-h">
        <h2 id="data-h" className="desk__h3">Your data</h2>
        {isGuest ? (
          <p className="muted">
            You are exploring in <strong>Guest Mode</strong>. Case logs, unlocked badges, and challenge statistics are stored in this browser only.
            Sign in to synchronize your profile and compete on the global leaderboard.
          </p>
        ) : (
          <p className="muted">
            Signed in as <strong>@{cloudProfile?.username ?? 'detective'}</strong> ({user?.email}).
            Your detective rank, statistics, badges, and explored years are continuously synchronized to the cloud.
          </p>
        )}
        <div className="chips">
          <button type="button" className="btn btn--small" onClick={exportData}>
            Export my data (JSON)
          </button>
          {confirmErase ? (
            <>
              <button type="button" className="btn btn--small btn--danger" onClick={erase}>
                Yes, erase everything
              </button>
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmErase(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setConfirmErase(true)}>
              Erase all local data
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
