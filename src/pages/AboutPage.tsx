import DataBadge from '../components/DataBadge';

export default function AboutPage() {
  return (
    <section className="page page--narrow">
      <p className="eyebrow">About the project</p>
      <h1 className="page__title">
        Reading time in <span>borders</span>
      </h1>

      <div className="card">
        <p>
          Globe Detective is an educational investigation platform inspired by the habit of studying
          vintage globes and working out when they were made. A globe’s country names and borders
          are a snapshot of one moment in history, and spotting what is present, missing or renamed
          narrows down its age.
        </p>

        <h2 className="card__h2">What you can do here</h2>
        <ul className="card__list">
          <li><strong>Globe</strong>: explore modern borders and look up any country.</li>
          <li><strong>Timeline</strong>: move through 1886–2019 and see which states existed, with sourced name changes and border events.</li>
          <li><strong>Detective Mode</strong>: record what a globe shows or lacks. The desk combines those clues into a date range and shows its reasoning, its confidence, and any clues that contradict each other.</li>
          <li><strong>Challenge Mode</strong>: guess the year of a mystery map. Answers come from the real border data, never at random.</li>
          <li><strong>Profile</strong>: points, streaks, badges and history, kept in this browser only.</li>
        </ul>
        <p>
          A date range here is an inference from the clues you enter, not a verdict. A globe can carry older map content
          than the year it was manufactured (printing plates were reused), so the estimator reports the date of the map
          information and a separate, wider window for manufacture.
        </p>

        <h2 className="card__h2">How information is labelled</h2>
        <ul className="card__list card__list--badges">
          <li>
            <DataBadge kind="verified" /> Checked against the cited sources, which are linked next to it.
          </li>
          <li>
            <DataBadge kind="dataset" /> Taken directly from CShapes 2.0, including its labels and coding
            conventions, which can differ from the formal date or name of an event.
          </li>
          <li>
            <DataBadge kind="descriptive" /> This project’s own wording for a situation with no official state
            name, such as an occupation zone.
          </li>
          <li>
            <DataBadge kind="computed" /> Calculated from the map geometry in this app, such as
            centre point or area. Approximate.
          </li>
          <li>
            <DataBadge kind="estimate" /> An inference or best guess, such as a date range for a
            globe.
          </li>
        </ul>

        <h2 className="card__h2">Modern borders (Home)</h2>
        <p>
          The Home globe shows <strong>modern</strong> borders from Natural Earth (1:110m),
          distributed through the <code>world-atlas</code> package.
        </p>

        <h2 className="card__h2">Historical borders (Timeline)</h2>
        <p>
          The Timeline uses <strong>CShapes 2.0</strong>: polygons for the states of the international
          system, with exact start and end dates, from <strong>1 January 1886 to 31 December 2019</strong>.
          It also codes colonies, protectorates, mandates and occupations, which the app colours separately.
          For any year outside that range the app draws nothing and says so.
        </p>
        <p className="card__cite">
          Schvitz, G., Girardin, L., Rüegger, S., Weidmann, N. B., Cederman, L.-E., &amp; Gleditsch, K. S.
          (2022). Mapping the International System, 1886–2019: The CShapes 2.0 Dataset. <em>Journal of
          Conflict Resolution, 66</em>(1), 144–161.{' '}
          <a href="https://doi.org/10.1177/00220027211013563" target="_blank" rel="noreferrer noopener">
            doi:10.1177/00220027211013563
          </a>
          {' · '}
          <a href="https://icr.ethz.ch/data/cshapes/" target="_blank" rel="noreferrer noopener">
            project page
          </a>
        </p>
        <p>
          <strong>Licence.</strong> Sources disagree on the exact terms: the ETH Research Collection record lists
          CC BY-NC 4.0, and an earlier review of the project page recorded CC BY-NC-SA 4.0. This app applies the
          stricter terms. That means attribution is required, use must be <strong>non-commercial</strong>, and
          adaptations must be shared alike. The R package that distributes the data is separately declared GPL.
          Check the project page before reusing the data or this app commercially.
        </p>
        <p>
          <strong>What was changed.</strong> Borders are generalised (Douglas–Peucker, 3 km) so they load quickly.
          Nothing was added or moved by hand, and areas are computed from the original geometry. Country names
          for a given year come from a separate, sourced name table; where it has no entry the app shows
          CShapes’ own label and marks it as such.
        </p>

        <h2 className="card__h2">Data sources, attribution and licences</h2>
        <div className="tablewrap">
          <table className="scoretable sources">
            <thead>
              <tr><th scope="col">Material</th><th scope="col">Used for</th><th scope="col">Licence</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <a href="https://icr.ethz.ch/data/cshapes/" target="_blank" rel="noreferrer noopener">CShapes 2.0</a> (Schvitz et al. 2022)
                </th>
                <td>All historical borders, 1886–2019. Simplified copy; see above.</td>
                <td>CC BY-NC 4.0 per the ETH record; this app applies the stricter CC BY-NC-SA 4.0. Non-commercial, attribution required.</td>
              </tr>
              <tr>
                <th scope="row">
                  <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer noopener">Natural Earth</a> 1:110m, via{' '}
                  <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noreferrer noopener">world-atlas</a>
                </th>
                <td>Modern borders on the Globe page.</td>
                <td>Natural Earth is public domain. The world-atlas package is ISC-licensed.</td>
              </tr>
              <tr>
                <th scope="row">Earth imagery and relief map (from the three-globe examples)</th>
                <td>Surface of the 3D globe.</td>
                <td>Distributed with three-globe (MIT); the imagery appears to be NASA Blue Marble material. Confirm the image terms before any commercial use.</td>
              </tr>
              <tr>
                <th scope="row">Event, name and clue tables (this project)</th>
                <td>Detective clues, name histories, challenge hints.</td>
                <td>Written for this project from the sources linked beside each entry. Wikipedia and similar sources are cited as references only.</td>
              </tr>
              <tr>
                <th scope="row">Software</th>
                <td>React, Vite, three.js, react-globe.gl, d3-geo, topojson-client.</td>
                <td>MIT or ISC licences. Full list in THIRD_PARTY_NOTICES.md in the project.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Because the historical borders are non-commercial, this app must be used and hosted non-commercially: no
          ads, paywalls or paid plans built on it. This page is not legal advice; check the
          licence pages linked above before reusing the data.
        </p>

        <h2 className="card__h2">Privacy</h2>
        <p>
          Globe Detective has no accounts, no server-side storage and no analytics. Your profile, scores, streaks and
          saved investigations live in this browser’s LocalStorage and are never uploaded. Because of that, scores are
          personal records and cannot be compared with other people’s; there is no global leaderboard. You can export or
          erase everything from the Profile page.
        </p>

        <h2 className="card__h2">Known limitations</h2>
        <ul className="card__list">
          <li>The 110m dataset omits very small states and islands, so they can’t be searched or clicked.</li>
          <li>
            CShapes does not include internal divisions: Soviet and Yugoslav republics, for example, only appear
            as separate polygons from the date CShapes codes them as independent.
          </li>
          <li>
            CShapes’ dates follow its own coding rules and sometimes differ by days from the formal date of an
            event. Where the app knows of such a difference it says so.
          </li>
          <li>Small islands and coastline detail under about 3 km are missing from the historical borders.</li>
          <li>Coastlines and borders are simplified, so computed areas can differ from official figures.</li>
          <li>Disputed territories follow Natural Earth’s conventions and have no ISO code here.</li>
          <li>CShapes ends on 31 December 2019; later changes are not shown on the Timeline.</li>
          <li>The clue library is a curated set of well-documented changes, not every change in history, and date estimates inherit that limit.</li>
          <li>Progress is stored per browser and device. Clearing site data, or using a private window, removes it.</li>
          <li>The 3D globe needs WebGL; without it the globe pages show a notice instead.</li>
        </ul>

        <a className="btn" href="#/">
          Back to the globe
        </a>
      </div>
    </section>
  );
}
