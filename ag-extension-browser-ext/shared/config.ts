/**
 * Global Configuration for AG Extension
 */

export const CONFIG = {
  // API Endpoints — must be set via VITE_API_URL environment variable at build time
  API_BASE_URL: (import.meta as any).env?.VITE_API_URL || '/api/v1',
  
  // Versions and Metadata
  VERSION: '1.0.0',
  ENV: (import.meta as any).env?.MODE || 'production',

  // Feature Flags
  OFFLINE_MODE_ENABLED: true,
  VISIT_LOGGING_ENABLED: true,
};

export default CONFIG;
