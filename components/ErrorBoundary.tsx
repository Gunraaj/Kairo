import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Kairo Uncaught Component Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    if (window.confirm('Reset local project cache to recover? Your session history will be preserved.')) {
      try {
        localStorage.removeItem('kairo_projects');
        localStorage.removeItem('kairo_active_task');
      } catch {
        // Ignore
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="k-error-boundary-screen" role="alert">
          <div className="k-error-boundary-card">
            <div className="k-error-boundary-icon" aria-hidden="true">
              ⛩️
            </div>
            <h1 className="k-error-boundary-title">Kairo · Calm Recovery</h1>
            <p className="k-error-boundary-msg">
              A temporary display glitch occurred. Your focus data and settings are safely stored in your browser.
            </p>

            <div className="k-error-boundary-actions">
              <button
                type="button"
                className="k-btn-hero"
                onClick={this.handleReset}
              >
                Restore Session
              </button>
              <button
                type="button"
                className="k-btn-secondary"
                onClick={this.handleReload}
              >
                Reload App
              </button>
              <button
                type="button"
                className="k-btn-secondary is-danger"
                onClick={this.handleResetStorage}
                title="Clears corrupted project cache if an invalid task caused the error"
              >
                Reset Projects Cache
              </button>
            </div>

            {this.state.error && (
              <details className="k-error-boundary-details">
                <summary>Diagnostic Details</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && <pre>{this.state.errorInfo.componentStack}</pre>}
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
