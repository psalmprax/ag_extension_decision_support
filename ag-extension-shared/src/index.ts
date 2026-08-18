export {
  ErrorBoundary,
  default,
  withErrorBoundary,
  useErrorHandler,
  useErrorBoundary,
  ErrorBoundaryProvider,
} from './ErrorBoundary';
export type { Props as ErrorBoundaryProps } from './ErrorBoundary';

// Shared API contract (zod schemas + inferred types) — also available via the
// `@ag-extension/shared/api` subpath for consumers that want only the contract.
export * from './api';
