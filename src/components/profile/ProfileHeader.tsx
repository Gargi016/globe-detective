import { useState } from 'react';
import { EMBLEMS } from '../../profile/profileStore';
import type { EmblemId, ProfileData } from '../../profile/profileStore';
import { rankFor } from '../../profile/stats';

export interface ProfileHeaderProps {
  profile: ProfileData;
  totalPoints: number;
  onRename: (name: string) => void;
  onEmblem: (e: EmblemId) => void;
  username?: string;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onUpdateUsername?: (username: string) => Promise<void>;
}

export default function ProfileHeader({
  profile,
  totalPoints,
  onRename,
  onEmblem,
  username,
  isGuest = true,
  onOpenAuth,
  onUpdateUsername,
}: ProfileHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const [draftUser, setDraftUser] = useState(username ?? '');
  const { rank, next, fraction } = rankFor(totalPoints);
  const emblem = EMBLEMS.find((e) => e.id === profile.emblem) ?? EMBLEMS[0];

  const commit = async () => {
    onRename(draft);
    if (!isGuest && onUpdateUsername && draftUser && draftUser !== username) {
      await onUpdateUsername(draftUser);
    }
    setEditing(false);
  };

  return (
    <section className="panel pheader" aria-label="Profile">
      <div className="pheader__emblem" aria-hidden="true">
        {emblem.glyph}
      </div>
      <div className="pheader__main">
        {editing ? (
          <form
            className="pheader__edit"
            onSubmit={(e) => {
              e.preventDefault();
              void commit();
            }}
          >
            <div className="pheader__edit-fields">
              <div className="field">
                <label className="pheader__edit-label" htmlFor="profile-name">
                  Display name
                </label>
                <input
                  id="profile-name"
                  className="input"
                  value={draft}
                  maxLength={30}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>

              {!isGuest && onUpdateUsername && (
                <div className="field">
                  <label className="pheader__edit-label" htmlFor="profile-username">
                    Codename (@username)
                  </label>
                  <input
                    id="profile-username"
                    className="input"
                    value={draftUser}
                    maxLength={20}
                    onChange={(e) => setDraftUser(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  />
                </div>
              )}
            </div>

            <div className="chips">
              <button type="submit" className="btn btn--small">
                Save
              </button>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => {
                  setDraft(profile.name);
                  setDraftUser(username ?? '');
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h2 className="pheader__name" data-testid="profile-name">
              <span>{profile.name}</span>
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => {
                  setDraft(profile.name);
                  setDraftUser(username ?? '');
                  setEditing(true);
                }}
              >
                Edit Profile
              </button>
            </h2>

            <div className="pheader__status-row">
              {isGuest ? (
                <>
                  <span className="pheader__sync-pill pheader__sync-pill--guest">
                    <span className="pheader__sync-dot" aria-hidden="true" />
                    Guest Mode (Local)
                  </span>
                  {onOpenAuth && (
                    <button
                      type="button"
                      className="link-btn pheader__sync-link"
                      onClick={onOpenAuth}
                    >
                      Sign in to sync
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span
                    className="pheader__sync-pill pheader__sync-pill--cloud"
                    title="Profile and statistics synchronized to cloud"
                  >
                    <span className="pheader__sync-dot" aria-hidden="true" />
                    Cloud Synced
                  </span>
                  {username && <span className="pheader__username">@{username}</span>}
                </>
              )}
            </div>
          </div>
        )}

        <p className="pheader__rank">
          <strong data-testid="profile-rank">{rank.title}</strong>
          <span className="muted">
            {' '}
            · member since {new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          </span>
        </p>

        <div className="pheader__progress">
          <div
            className="meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction * 100)}
            aria-label="Progress to next rank"
          >
            <div className="meter__track">
              <div className="meter__fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
            </div>
          </div>
          <span className="muted">
            {next ? `${Math.max(0, next.from - totalPoints)} points to ${next.title}` : 'Highest rank reached'}
          </span>
        </div>

        <div className="chips" role="group" aria-label="Emblem">
          {EMBLEMS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={e.id === profile.emblem}
              aria-label={e.label}
              title={e.label}
              className="chip"
              onClick={() => onEmblem(e.id)}
            >
              {e.glyph}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
