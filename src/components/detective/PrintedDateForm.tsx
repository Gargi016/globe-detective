import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Certainty, PrintedDateMeaning } from '../../detective/clues';

export interface PrintedDateFormProps {
  onAdd: (year: number, meaning: PrintedDateMeaning, certainty: Certainty) => string | null;
}

/** A date printed on the globe itself: kept apart from what the map shows, because it means something different. */
export default function PrintedDateForm({ onAdd }: PrintedDateFormProps) {
  const [text, setText] = useState('');
  const [meaning, setMeaning] = useState<PrintedDateMeaning>('copyright');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const year = /^\d{4}$/.test(text.trim()) ? Number(text.trim()) : NaN;
    const err = onAdd(year, meaning, 'certain');
    setError(err);
    if (!err) setText('');
  };

  return (
    <form className="printed" onSubmit={submit} noValidate>
      <h2 className="desk__h3">A date printed on the globe</h2>
      <p className="muted">
        Copyright or edition lines bound the <em>map content</em> from above and the <em>object’s age</em> from below, but a later impression may keep an old date.
      </p>
      <div className="printed__row">
        <label className="field">
          <span className="field__label">Year</span>
          <input className="select" inputMode="numeric" maxLength={4} placeholder="1962" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={error !== null} />
        </label>
        <label className="field">
          <span className="field__label">It says</span>
          <select className="select" value={meaning} onChange={(e) => setMeaning(e.target.value as PrintedDateMeaning)}>
            <option value="copyright">© / edition year</option>
            <option value="corrected-to">“Corrected to” year</option>
          </select>
        </label>
        <button type="submit" className="btn btn--small">
          Add printed date
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
