/**
 * Global Configuration for AG Extension
 */

export const CONFIG = {
  // API Endpoints
  // Default to producing-ready alpha URL, fallback to localhost for development
  API_BASE_URL: (import.meta as any).env?.VITE_API_URL || 'https://ag-decision-support.alpha/api/v1',
  
  // Versions and Metadata
  VERSION: '1.0.0',
  ENV: (import.meta as any).env?.MODE || 'production',

  // Feature Flags
  OFFLINE_MODE_ENABLED: true,
  VISIT_LOGGING_ENABLED: true,
};

export default CONFIG;
