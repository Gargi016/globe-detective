import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SavedInvestigation } from '../../detective/investigation';

export interface SavePanelProps {
  storageAvailable: boolean;
  name: string;
  saves: SavedInvestigation[];
  onSave: (name: string) => string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  isGuest?: boolean;
  cloudSyncing?: boolean;
}

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function SavePanel({
  storageAvailable,
  name,
  saves,
  onSave,
  onLoad,
  onDelete,
  isGuest = true,
  cloudSyncing = false,
}: SavePanelProps) {
  const [text, setText] = useState(name === 'Untitled investigation' ? '' : name);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = onSave(text);
    setMessage(
      err
        ? { ok: false, text: err }
        : {
            ok: true,
            text: isGuest
              ? `Saved “${text.trim()}” to this browser.`
              : `Saved “${text.trim()}” to your cloud case files.`,
          },
    );
  };

  return (
    <div className="savepanel">
      {!storageAvailable && (
        <div className="notice notice--warn" role="alert">
          This browser is blocking local storage (a private window, perhaps), so investigations cannot be saved locally.
        </div>
      )}

      <div className="savepanel__header">
        <p className="muted">The working investigation is saved automatically and reopens where you left it.</p>
        <div className="savepanel__badge-row">
          {isGuest ? (
            <span className="pheader__sync-pill pheader__sync-pill--guest">
              <span className="pheader__sync-dot" aria-hidden="true" /> Guest Storage
            </span>
          ) : (
            <span className="pheader__sync-pill pheader__sync-pill--cloud">
              <span className="pheader__sync-dot" aria-hidden="true" />
              {cloudSyncing ? 'Syncing Case Files…' : 'Cloud Case Files Synced'}
            </span>
          )}
        </div>
      </div>

      <form className="savepanel__form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">Name this investigation</span>
          <input
            className="select"
            maxLength={80}
            placeholder="Grandfather’s globe"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn--small" disabled={!storageAvailable && isGuest}>
          Save
        </button>
      </form>
      {message && <p className={message.ok ? 'form-ok' : 'form-error'} role="status">{message.text}</p>}

      <h2 className="desk__h3">Saved investigations</h2>
      {saves.length === 0 ? (
        <p className="muted">Nothing saved yet.</p>
      ) : (
        <ul className="saves">
          {saves.map((s) => (
            <li key={s.id} className="save">
              <div>
                <strong>{s.name}</strong>
                <span className="muted">
                  {' '}
                  · {s.investigation.observations.length} observation
                  {s.investigation.observations.length === 1 ? '' : 's'} · {when(s.savedAt)}
                </span>
              </div>
              <div className="save__actions">
                <button type="button" className="btn btn--small" onClick={() => onLoad(s.id)}>
                  Open
                </button>
                <button type="button" className="btn btn--small btn--danger" onClick={() => onDelete(s.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
