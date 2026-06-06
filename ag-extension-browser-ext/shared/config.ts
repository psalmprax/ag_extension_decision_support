/**
 * Global Configuration for AG Extension
 * 
 * Uses Vite/WXT import.meta.env — typed via ImportMeta interface extension.
 */

interface ImportMetaEnv {
  VITE_API_URL?: string;
  MODE?: string;
}

// Safely access import.meta.env with proper type handling
const metaEnv = (import.meta as unknown as { env: ImportMetaEnv }).env;

export const CONFIG = {
  // API Endpoints — must be set via VITE_API_URL environment variable at build time
  API_BASE_URL: metaEnv?.VITE_API_URL || '/api/v1',
  
  // Versions and Metadata
  VERSION: '1.0.0',
  ENV: metaEnv?.MODE || 'production',

  // Feature Flags
  OFFLINE_MODE_ENABLED: true,
  VISIT_LOGGING_ENABLED: true,
};

export default CONFIG;
