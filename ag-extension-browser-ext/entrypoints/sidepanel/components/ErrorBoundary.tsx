import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Copy, Check } from 'lucide-react';
import { CONFIG } from '../../../shared/config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private errorLogged = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.errorLogged) return;
    this.errorLogged = true;

    console.error('Extension sidepanel ErrorBoundary caught an error:', error, errorInfo);
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    try {
      const payload = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        componentStack: errorInfo.componentStack,
        componentName: 'Sidepanel',
        url: globalThis.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };
      
      const endpoint = CONFIG.API_BASE_URL.startsWith('http')
        ? `${CONFIG.API_BASE_URL}/errors`
        : `${globalThis.location.origin}${CONFIG.API_BASE_URL}/errors`;

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => {
        console.warn('Failed to send error report to telemetry server:', err);
      });
    } catch (e) {
      console.error('ErrorBoundary telemetry report failed:', e);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      copied: false,
    });
  };

  handleCopyError = (): void => {
    if (!this.state.error) return;
    const errorText = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ''}`;
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = errorText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col h-screen items-center justify-center p-6 bg-slate-950 text-slate-200 font-sans">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20 shadow-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          
          <h2 className="text-base font-bold text-white mb-2 uppercase tracking-wider">Sidepanel Error</h2>
          <p className="text-xs text-slate-400 text-center mb-6 max-w-[240px]">
            Something went wrong while rendering the extension sidepanel interface.
          </p>

          {this.state.error && (
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-mono text-red-400 break-all select-all">
                  {this.state.error.message}
                </span>
                <button
                  onClick={this.handleCopyError}
                  className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300 shrink-0"
                  title="Copy stack trace"
                >
                  {this.state.copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-primary-500/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
