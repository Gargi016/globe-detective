import { DIFFICULTIES } from '../../challenge/generator';
import type { Dashboard } from '../../profile/stats';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

export default function StatsDashboard({ d }: { d: Dashboard }) {
  const max = Math.max(1, ...d.tiers.map((t) => t.count));
  return (
    <section className="panel" aria-labelledby="dash-h">
      <h2 id="dash-h" className="desk__h3">Personal statistics</h2>
      <dl className="stats" data-testid="stats">
        <div><dt>Total points</dt><dd data-testid="stat-points">{d.totalPoints}</dd></div>
        <div><dt>Challenges completed</dt><dd data-testid="stat-completed">{d.completed}</dd></div>
        <div>
          <dt>Average accuracy</dt>
          <dd data-testid="stat-accuracy">{d.completed === 0 ? '—' : `${d.accuracy}%`}</dd>
        </div>
        <div><dt>Best score</dt><dd data-testid="stat-best">{d.bestScore}</dd></div>
        <div>
          <dt>Daily streak</dt>
          <dd data-testid="stat-daily">{d.dailyStreak} <span className="muted">best {d.bestDailyStreak}</span></dd>
        </div>
        <div>
          <dt>Sharp streak</dt>
          <dd>{d.currentStreak} <span className="muted">best {d.bestStreak}</span></dd>
        </div>
        <div><dt>Investigations</dt><dd data-testid="stat-investigations">{d.investigations}</dd></div>
        <div><dt>Years explored</dt><dd>{d.yearsExplored}</dd></div>
      </dl>
      <p className="muted dash__note">
        Accuracy is the average points per challenge on the 0–100 scale (100 = every guess exact).
        {d.sample > 0 && (
          <> Of the last {d.sample} result{d.sample === 1 ? '' : 's'}, {pct(d.withinFivePct)} landed within five years of the answer, mean error {d.meanErrorYears} years.</>
        )}{' '}
        Hints used: {d.hintsUsed}. Exact guesses: {d.exactGuesses}. Sharp streak = results in a row of 80 points or more.
      </p>

      {d.recent.length > 0 ? (
        <div className="dash__charts">
          <figure className="dash__fig">
            <figcaption className="desk__h3">Last {d.recent.length} scores</figcaption>
            <div className="bars" role="img" aria-label={`Scores, oldest to newest: ${d.recent.join(', ')}`}>
              {d.recent.map((p, i) => (
                <span key={i} className="bars__col" title={`${p} points`}>
                  <span className="bars__bar" style={{ height: `${p}%` }} />
                </span>
              ))}
            </div>
          </figure>
          <figure className="dash__fig">
            <figcaption className="desk__h3">How close the guesses were</figcaption>
            <ul className="hbars">
              {d.tiers.map((t) => (
                <li key={t.points}>
                  <span className="hbars__label">{t.label}</span>
                  <span className="hbars__track"><span className="hbars__fill" style={{ width: `${(t.count / max) * 100}%` }} /></span>
                  <span className="hbars__n">{t.count}</span>
                </li>
              ))}
            </ul>
          </figure>
          <figure className="dash__fig">
            <figcaption className="desk__h3">By difficulty</figcaption>
            <table className="scoretable">
              <thead><tr><th scope="col">Level</th><th scope="col">Played</th><th scope="col">Average</th><th scope="col">Best</th></tr></thead>
              <tbody>
                {d.byDifficulty.map((r) => (
                  <tr key={r.difficulty}>
                    <th scope="row">{DIFFICULTIES[r.difficulty].label}</th>
                    <td>{r.played}</td>
                    <td>{r.played ? r.average : '—'}</td>
                    <td>{r.played ? r.best : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </div>
      ) : (
        <p className="muted">Play a challenge to see score charts here.</p>
      )}
    </section>
  );
}
