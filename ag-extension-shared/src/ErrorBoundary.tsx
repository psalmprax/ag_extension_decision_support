import React, { Component, ErrorInfo, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Home, RefreshCw, RotateCcw } from 'lucide-react';

export interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
  /**
   * Optional backend endpoint to POST the error to. When provided, the
   * boundary will send a telemetry payload (silently swallowing any network
   * failure) in addition to calling `onError`. Leave undefined to disable
   * automatic reporting.
   */
  reportingEndpoint?: string;
  /**
   * Visual variant. "dashboard" (default) is a centered light/dark card
   * with three recovery actions; "extension" is a compact dark card
   * suitable for browser-extension popups and side panels.
   */
  variant?: 'dashboard' | 'extension';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private errorLogged = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.errorLogged) return;
    this.errorLogged = true;

    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo): void {
    const { reportingEndpoint, componentName } = this.props;
    if (!reportingEndpoint || typeof fetch === 'undefined') return;

    try {
      const payload = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        componentStack: errorInfo.componentStack,
        componentName,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
      };

      fetch(reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silent fail — never throw while handling an error.
      });
    } catch {
      // Ignore — reporting must never crash the boundary.
    }
  }

  handleReset = (): void => {
    this.errorLogged = false;
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  handleReload = (): void => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  handleCopyError = (): void => {
    const errorText = this.state.error
      ? `${this.state.error.message}\n\n${this.state.error.stack}\n\n${this.state.errorInfo?.componentStack}`
      : 'No error details available';

    const onCopied = () => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(errorText).then(onCopied).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = errorText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        onCopied();
      });
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return this.props.variant === 'extension'
      ? this.renderExtensionFallback()
      : this.renderDashboardFallback();
  }

  private renderDashboardFallback(): ReactNode {
    const { error, errorInfo, copied } = this.state;
    const isDev = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4"
        role="alert"
        aria-live="assertive"
        aria-labelledby="error-title"
      >
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle
              className="w-8 h-8 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
          </div>

          <h1 id="error-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We encountered an unexpected error. Please try again or contact support if the problem
            persists.
          </p>

          {error && (
            <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-sm font-mono text-red-600 dark:text-red-400 truncate flex-1"
                  aria-label="Error message"
                >
                  {error.message}
                </p>
                <button
                  onClick={this.handleCopyError}
                  className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  aria-label={copied ? 'Copied!' : 'Copy error details'}
                  title="Copy error details"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  )}
                </button>
              </div>
              {this.props.componentName && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Component:{' '}
                  <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">
                    {this.props.componentName}
                  </code>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Try again"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Reload page"
            >
              Reload Page
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              aria-label="Go to home page"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Go Home
            </button>
          </div>

          {isDev && errorInfo && (
            <details className="mt-6 text-left">
              <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-auto max-h-40 text-gray-600 dark:text-gray-300">
                {error?.stack}
                {'\n\n'}
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  private renderExtensionFallback(): ReactNode {
    const { error, copied } = this.state;
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 bg-slate-950 text-slate-200 font-sans">
        <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20 shadow-lg mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h2 className="text-base font-bold text-white mb-2 uppercase tracking-wider">Extension Error</h2>
        <p className="text-xs text-slate-400 text-center mb-6 max-w-[240px]">
          Something went wrong while rendering the extension interface.
        </p>
        {error && (
          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-mono text-red-400 break-all select-all">
                {error.message}
              </span>
              <button
                onClick={this.handleCopyError}
                className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300 shrink-0"
                title="Copy stack trace"
              >
                {copied ? (
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
}

export default ErrorBoundary;
export { ErrorBoundary };

// Higher-order component for wrapping components
// eslint-disable-next-line react-refresh/only-export-components
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: Partial<Props> & { componentName?: string }
): React.FC<P> => {
  const WrappedComponent: React.FC<P> = props => (
    <ErrorBoundary
      {...options}
      componentName={options?.componentName || Component.displayName || Component.name || 'Component'}
    >
      <Component {...props} />
    </ErrorBoundary>
  );
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
};

// Hook for programmatic error handling
// eslint-disable-next-line react-refresh/only-export-components
export const useErrorHandler = () => {
  const [, setError] = useState<Error | null>(null);
  return useCallback((error: Error | string) => {
    const err = typeof error === 'string' ? new Error(error) : error;
    setError(() => {
      throw err;
    });
  }, []);
};

// Error boundary context for nested error handling
interface ErrorBoundaryContextType {
  reportError: (error: Error) => void;
  resetError: () => void;
  hasError: boolean;
  error: Error | null;
}

const ErrorBoundaryContext = React.createContext<ErrorBoundaryContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useErrorBoundary = (): ErrorBoundaryContextType => {
  const context = useContext(ErrorBoundaryContext);
  if (!context) {
    throw new Error('useErrorBoundary must be used within an ErrorBoundaryProvider');
  }
  return context;
};

interface ErrorBoundaryProviderProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  reportingEndpoint?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ErrorBoundaryProvider: React.FC<ErrorBoundaryProviderProps> = ({
  children,
  onError,
  reportingEndpoint,
}) => {
  const [hasError, setHasError] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const handleError = useCallback((error: Error) => {
    setHasError(true);
    setLastError(error);
    // eslint-disable-next-line no-console
    console.error('ErrorBoundaryProvider caught:', error);
  }, []);

  const resetError = useCallback(() => {
    setHasError(false);
    setLastError(null);
  }, []);

  const contextValue = useMemo(
    () => ({ reportError: handleError, resetError, hasError, error: lastError }),
    [hasError, lastError, handleError, resetError]
  );

  const handleBoundaryError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      handleError(error);
      if (onError) onError(error, errorInfo);
    },
    [handleError, onError]
  );

  if (hasError && lastError) {
    return (
      <ErrorBoundary onError={handleBoundaryError} reportingEndpoint={reportingEndpoint}>
        {children}
      </ErrorBoundary>
    );
  }

  return <ErrorBoundaryContext.Provider value={contextValue}>{children}</ErrorBoundaryContext.Provider>;
};
