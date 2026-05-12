import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    componentName?: string;
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
        // Prevent duplicate logging
        if (this.errorLogged) return;
        this.errorLogged = true;

        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // Call optional error handler
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // Send to error tracking service if configured
        this.reportError(error, errorInfo);
    }

    private reportError(error: Error, errorInfo: ErrorInfo): void {
        // Log to analytics/error tracking service
        if (typeof window !== 'undefined') {
            // Example: Send to Sentry
            // if (window.Sentry) {
            //     window.Sentry.captureException(error, {
            //         extra: {
            //             componentStack: errorInfo.componentStack,
            //             componentName: this.props.componentName,
            //         },
            //     });
            // }

            // Log to backend error tracking endpoint
            if (import.meta.env.PROD) {
                fetch('/api/errors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: {
                            message: error.message,
                            stack: error.stack,
                            name: error.name,
                        },
                        componentStack: errorInfo.componentStack,
                        componentName: this.props.componentName,
                        url: window.location.href,
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString(),
                    }),
                }).catch(() => {
                    // Silent fail - don't throw error while handling error
                });
            }
        }
    }

    handleReset = (): void => {
        this.errorLogged = false;
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false,
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    handleGoHome = (): void => {
        window.location.href = '/';
    };

    handleCopyError = (): void => {
        const errorText = this.state.error
            ? `${this.state.error.message}\n\n${this.state.error.stack}\n\n${this.state.errorInfo?.componentStack}`
            : 'No error details available';

        navigator.clipboard.writeText(errorText).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        }).catch(() => {
            // Fallback for older browsers
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
                            We encountered an unexpected error. Please try again or contact support if the problem persists.
                        </p>

                        {this.state.error && (
                            <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-left">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-mono text-red-600 dark:text-red-400 truncate flex-1" aria-label="Error message">
                                        {this.state.error.message}
                                    </p>
                                    <button
                                        onClick={this.handleCopyError}
                                        className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                        aria-label={this.state.copied ? 'Copied!' : 'Copy error details'}
                                        title="Copy error details"
                                    >
                                        {this.state.copied ? (
                                            <Check className="w-4 h-4 text-green-600" aria-hidden="true" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-gray-500" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                                {this.props.componentName && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        Component: <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">{this.props.componentName}</code>
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

                        {/* Show error details in development */}
                        {import.meta.env.DEV && this.state.errorInfo && (
                            <details className="mt-6 text-left">
                                <summary
                                    className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                                    aria-label="Show technical details"
                                >
                                    Technical Details
                                </summary>
                                <pre
                                    className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-auto max-h-40 text-gray-600 dark:text-gray-300"
                                    aria-label="Error stack trace"
                                >
                                    {this.state.error?.stack}
                                    {'\n\n'}
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

// Higher-order component for wrapping components
// eslint-disable-next-line react-refresh/only-export-components
export const withErrorBoundary = <P extends object>(
    Component: React.ComponentType<P>,
    options?: Partial<Props> & { componentName?: string }
): React.FC<P> => {
    const WrappedComponent: React.FC<P> = (props) => (
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
    const [, setError] = React.useState<Error | null>(null);

    return React.useCallback((error: Error | string) => {
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
    const context = React.useContext(ErrorBoundaryContext);
    if (!context) {
        throw new Error('useErrorBoundary must be used within an ErrorBoundaryProvider');
    }
    return context;
};

interface ErrorBoundaryProviderProps {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const ErrorBoundaryProvider: React.FC<ErrorBoundaryProviderProps> = ({ children, onError }) => {
    const [hasError, setHasError] = React.useState(false);
    const [lastError, setLastError] = React.useState<Error | null>(null);

    const handleError = React.useCallback((error: Error) => {
        setHasError(true);
        setLastError(error);
        console.error('ErrorBoundaryProvider caught:', error);
    }, []);

    const resetError = React.useCallback(() => {
        setHasError(false);
        setLastError(null);
    }, []);

    const contextValue = React.useMemo(
        () => ({
            reportError: handleError,
            resetError,
            hasError,
            error: lastError,
        }),
        [hasError, lastError, handleError, resetError]
    );

    const handleBoundaryError = React.useCallback(
        (error: Error, errorInfo: ErrorInfo) => {
            handleError(error);
            if (onError) {
                onError(error, errorInfo);
            }
        },
        [handleError, onError]
    );

    if (hasError && lastError) {
        return (
            <ErrorBoundary onError={handleBoundaryError}>
                {children}
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundaryContext.Provider value={contextValue}>
            {children}
        </ErrorBoundaryContext.Provider>
    );
};