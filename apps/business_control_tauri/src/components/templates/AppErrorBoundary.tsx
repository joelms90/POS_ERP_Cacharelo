import { Component, ErrorInfo, ReactNode } from 'react';
import { remoteLogger } from '../../services/remoteLogger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Reports React render crashes to app_logs and offers a reload instead of a blank screen. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    remoteLogger.log('fatal', `Render crash: ${error.message}`, {
      stack: error.stack,
      context: { kind: 'react_error_boundary', componentStack: info.componentStack?.slice(0, 2000) },
    });
    void remoteLogger.flush();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-screen w-screen bg-obsidian flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg text-champagne-gold font-semibold">Ocurrió un error inesperado</h1>
        <p className="text-sm text-text-secondary max-w-md">
          El problema fue reportado automáticamente. Recarga la página para continuar.
        </p>
        <button
          className="px-4 py-2 rounded border border-champagne-gold text-champagne-gold text-sm"
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
      </div>
    );
  }
}
