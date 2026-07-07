import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@ag-extension/shared';
import CONFIG from '../../shared/config';
import '../../assets/index.css';

const reportingEndpoint = CONFIG.API_BASE_URL.startsWith('http')
  ? `${CONFIG.API_BASE_URL}/errors`
  : `${globalThis.location.origin}${CONFIG.API_BASE_URL}/errors`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary variant="extension" reportingEndpoint={reportingEndpoint}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

