export interface ModePlaceholderProps {
  title: string;
  tagline: string;
  description: string;
  willInclude: string[];
}

/** Honest "not built yet" page for modes that arrive in later phases. */
export default function ModePlaceholder({ title, tagline, description, willInclude }: ModePlaceholderProps) {
  return (
    <section className="page page--narrow">
      <p className="eyebrow">{tagline}</p>
      <h1 className="page__title">{title}</h1>
      <div className="card">
        <span className="card__stamp">Coming in a later phase</span>
        <p>{description}</p>
        <h2 className="card__h2">Planned</h2>
        <ul className="card__list">
          {willInclude.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <a className="btn" href="#/">
          Explore the globe meanwhile
        </a>
      </div>
    </section>
  );
}
