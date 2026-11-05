import type { SourceRef } from '../../history/types';

export default function SourceLinks({ sources }: { sources: readonly SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="sources">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noreferrer noopener">
            {s.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
