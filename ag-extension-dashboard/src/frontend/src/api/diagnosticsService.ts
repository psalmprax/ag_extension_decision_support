import apiClient from './client';

export interface DiagnosticResult {
  success: boolean;
  cached: boolean;
  timestamp: string;
  hostname: string;
  node_env: string;
  domain: string;
  server_ip: string;
  dns: Record<string, { resolved: boolean; ips: string[]; error?: string }>;
  ports: Array<{ port: number; name: string; host: string; open: boolean }>;
  traefik: Record<string, unknown>;
  container_network: Array<{ name: string; port: number; reachable: boolean }>;
  ssl: {
    ok: boolean;
    error?: string;
    cert?: {
      validFrom: string;
      validTo: string;
      issuer: string;
      subject: string;
      daysLeft: number;
    };
  };
  deployment: {
    node_env: string;
    docker_hostname: string;
    acme_email_configured: boolean;
    https_active: boolean;
    prod_override_detected: boolean;
    recommendation: string;
  };
  issues: string[];
  recommendations: string[];
  summary: string;
}

/**
 * Runs comprehensive infrastructure diagnostics on the server.
 * Checks DNS, port connectivity, Traefik routing, SSL, and container networking.
 */
export const runDiagnostics = async (): Promise<DiagnosticResult> => {
  const response = await apiClient.get('/health/diagnostics', { timeout: 30000 });
  return response.data;
};
