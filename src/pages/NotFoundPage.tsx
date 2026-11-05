export default function NotFoundPage() {
  return (
    <section className="page page--narrow">
      <p className="eyebrow">Off the map</p>
      <h1 className="page__title">Page <span>not found</span></h1>
      <div className="card">
        <p>There is no page at this address. Try one of the sections below.</p>
        <div className="chips">
          <a className="btn" href="#/">Globe</a>
          <a className="btn btn--ghost" href="#/timeline">Timeline</a>
          <a className="btn btn--ghost" href="#/detective">Detective Mode</a>
          <a className="btn btn--ghost" href="#/challenge">Challenge Mode</a>
          <a className="btn btn--ghost" href="#/profile">Profile</a>
        </div>
      </div>
    </section>
  );
}
