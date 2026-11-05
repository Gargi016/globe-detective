import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When this changes (e.g. the route), a previous error is cleared. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

/** Catches render errors so one broken page shows a message instead of a blank screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Globe Detective page error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="page page--narrow" role="alert">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="page__title">This page <span>failed to load</span></h1>
        <div className="card">
          <p>
            An unexpected error stopped this page from displaying. Your saved progress and investigations are kept in
            this browser and have not been changed.
          </p>
          <p className="muted">{this.state.error.message}</p>
          <div className="chips">
            <button type="button" className="btn" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn btn--ghost" href="#/">Back to the globe</a>
          </div>
        </div>
      </section>
    );
  }
}
