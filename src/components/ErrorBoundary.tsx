import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CargaRadar ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                Sistema CargaRadar
              </h2>
              <p className="text-sm text-slate-300">
                Ocorreu uma instabilidade inesperada na renderização. Seus dados estão seguros no banco.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-rose-300 font-mono overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl transition-all border border-slate-600 active:scale-95 cursor-pointer text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Limpar Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
