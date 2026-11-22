import { Component } from "react";
import { WarningIcon } from "./Icons";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;

    return (
      <div className="error-screen">
        <div className="error-screen__card">
          <div
            className="lumen-dialog__icon-badge lumen-dialog__icon-badge--danger"
            style={{ marginBottom: 0 }}
          >
            <WarningIcon size={22} />
          </div>

          <h1 className="error-screen__title">Something went wrong</h1>

          <p className="error-screen__desc">
            An unexpected error occurred in this section. Your data is safe —
            try recovering or reloading the app.
          </p>

          {error?.message && (
            <pre className="error-screen__trace">{error.message}</pre>
          )}

          <div className="error-screen__actions">
            <button
              type="button"
              className="btn btn-secondary btn--sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-primary btn--sm"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
