import { SCORE_TIERS } from '../../challenge/scoring';

/** The scoring rules, with the row that applies highlighted after a guess. */
export default function ScoreTable({ activePoints }: { activePoints?: number }) {
  return (
    <table className="scoretable">
      <caption className="sr-only">How a guess is scored</caption>
      <thead>
        <tr>
          <th scope="col">Distance from the answer</th>
          <th scope="col">Points</th>
        </tr>
      </thead>
      <tbody>
        {SCORE_TIERS.map((t) => (
          <tr key={t.points} className={activePoints === t.points ? 'is-active' : undefined}>
            <td>{t.label}</td>
            <td>{t.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
