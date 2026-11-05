import { useAuth } from '../../hooks/useAuth';

export default function MigrationToast() {
  const { migrationNotice, clearMigrationNotice } = useAuth();

  if (!migrationNotice || migrationNotice.skipped) return null;
  const { investigationsCount, achievementsCount, profileMigrated } = migrationNotice;
  if (investigationsCount === 0 && achievementsCount === 0 && !profileMigrated) return null;

  return (
    <div className="toasts toasts--migration" role="status" aria-live="polite">
      <div className="toast toast--migration" data-testid="migration-toast">
        <span className="toast__glyph" aria-hidden="true">
          ✦
        </span>
        <div className="toast__text">
          <strong>Account Synchronized</strong>
          <span className="muted">
            {investigationsCount > 0 && `${investigationsCount} case file${investigationsCount === 1 ? '' : 's'} `}
            {investigationsCount > 0 && achievementsCount > 0 && 'and '}
            {achievementsCount > 0 && `${achievementsCount} badge${achievementsCount === 1 ? '' : 's'} `}
            backed up to your cloud archive.
          </span>
        </div>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={clearMigrationNotice}
          aria-label="Dismiss synchronization message"
        >
          ×
        </button>
      </div>
    </div>
  );
}
