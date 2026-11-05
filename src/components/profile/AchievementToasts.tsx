import { useEffect, useRef, useState } from 'react';
import { browserStorage } from '../../detective/investigation';
import { onProgressChanged } from '../../profile/events';
import { syncAchievements } from '../../profile/sync';
import type { AchievementDef } from '../../profile/achievements';
import { useAuth } from '../../hooks/useAuth';
import { saveCloudAchievement } from '../../profile/achievementCloudService';

interface Toast {
  key: number;
  def: AchievementDef;
}

/** Watches for progress changes, stamps newly earned badges, and announces them. */
export default function AchievementToasts() {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const store = browserStorage();
    const check = () => {
      const added = syncAchievements(store);
      if (added.length === 0) return;
      setToasts((t) => [...t, ...added.map((def) => ({ key: ++counter.current, def }))]);
      if (user) {
        for (const badge of added) {
          void saveCloudAchievement(user.uid, badge.id);
        }
      }
    };
    check();
    return onProgressChanged(check);
  }, [user]);

  const dismiss = (key: number) => setToasts((t) => t.filter((x) => x.key !== key));

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(({ key, def }) => (
        <div className="toast" key={key} data-testid="achievement-toast">
          <span className="toast__glyph" aria-hidden="true">
            {def.glyph}
          </span>
          <span className="toast__text">
            <strong>Badge earned: {def.title}</strong>
            <span className="muted">{def.description}</span>
            <a href="#/profile" onClick={() => dismiss(key)}>
              View on profile
            </a>
          </span>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => dismiss(key)}
            aria-label={`Dismiss ${def.title}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
