import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { LOCAL_STORAGE_KEY } from '../lib/constants';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: undefined
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught ERP Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  private handleClearStorageAndReset = () => {
    if (confirm('Are you sure you want to reset corrupted local cache and reload default state?')) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      this.setState({ hasError: false, error: undefined });
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-xl border border-slate-200 text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Application Screen Recovered
            </h2>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              एक रनटाइम एरर के कारण स्क्रीन रीसेट हो गई थी। आपका डेटा सुरक्षित है। नीचे दिए गए बटन से तुरंत स्क्रीन वापस लाएं:
            </p>

            {this.state.error && (
              <div className="text-left bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] font-mono text-rose-700 mb-6 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-[#1a365d] hover:bg-[#2b6cb0] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Hub Screen</span>
              </button>

              <button
                onClick={this.handleClearStorageAndReset}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer border border-slate-300"
              >
                <Home className="w-4 h-4" />
                <span>Reset to Clean State</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
