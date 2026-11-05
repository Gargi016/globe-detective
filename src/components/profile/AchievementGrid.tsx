import type { AchievementStatus } from '../../profile/achievements';

const GROUPS = ['Investigating', 'Exploring', 'Challenges', 'Streaks'] as const;
const when = (t: number) => new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' });

export default function AchievementGrid({ statuses }: { statuses: AchievementStatus[] }) {
  const earned = statuses.filter((s) => s.unlocked).length;
  return (
    <section className="panel" aria-labelledby="ach-h">
      <h2 id="ach-h" className="desk__h3">
        Achievements <span className="muted" data-testid="ach-count">{earned} of {statuses.length}</span>
      </h2>
      {GROUPS.map((g) => {
        const rows = statuses.filter((s) => s.def.group === g);
        if (rows.length === 0) return null;
        return (
          <div key={g}>
            <h3 className="ach__group">{g}</h3>
            <ul className="achv-list">
              {rows.map((s) => {
                const fraction = s.target === 0 ? 0 : Math.min(1, s.current / s.target);
                return (
                  <li key={s.def.id} className={`achv${s.unlocked ? ' achv--on' : ''}`} data-testid={`badge-${s.def.id}`} data-unlocked={s.unlocked}>
                    <span className="achv__glyph" aria-hidden="true">{s.unlocked ? s.def.glyph : '🔒︎'}</span>
                    <span className="achv__body">
                      <strong>{s.def.title}</strong>
                      <span className="muted">{s.def.description}</span>
                      {s.unlocked ? (
                        <span className="achv__state">Earned{s.unlockedAt ? ` ${when(s.unlockedAt)}` : ''}</span>
                      ) : (
                        <span className="meter meter--small" role="progressbar" aria-valuemin={0} aria-valuemax={s.target} aria-valuenow={s.current} aria-label={`${s.def.title} progress`}>
                          <span className="meter__track"><span className="meter__fill" style={{ width: `${fraction * 100}%` }} /></span>
                          <span className="meter__value">{s.note ?? `${s.current}/${s.target}`}</span>
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
