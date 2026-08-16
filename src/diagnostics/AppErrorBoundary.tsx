import { Component, type ErrorInfo, type ReactNode } from 'react';
import { formatDiagnosticEvents, recordDiagnostic } from './diagnostic-log';

interface Props { readonly children: ReactNode }
interface State { readonly error?: string }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    recordDiagnostic('react-error-boundary', {
      message: error.message.slice(0, 500),
      componentStack: info.componentStack?.slice(0, 1_500) ?? 'unavailable',
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="dp-crash-recovery">
        <section>
          <p>Defuse Protocol diagnostics</p>
          <h1>Presentation error recovered</h1>
          <p>The game interface encountered an error. The latest local diagnostic events are preserved below.</p>
          <pre>{formatDiagnosticEvents()}</pre>
          <button type="button" onClick={() => window.location.reload()}>Reload simulator</button>
        </section>
      </main>
    );
  }
}
