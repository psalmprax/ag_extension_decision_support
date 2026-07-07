import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Clock,
  RefreshCw,
  Shield,
  Server,
  Database,
  Zap,
  Wifi,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import {
  fetchHealthStatus,
  fetchRecoveryLog,
  triggerRecovery,
  HealthCheck,
  RecoveryAction,
} from '../api/systemHealthService';
import { runDiagnostics, DiagnosticResult } from '../api/diagnosticsService';
import { MetricCard } from '@/components/MetricCard';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';
import { RATE_LIMIT_STATUS, CERT_EXPIRY_WARN_DAYS, ERROR_COOLDOWN_MS } from '@/lib/constants';

function IssuesSummary({ issues, summary }: { issues?: string[]; summary?: string }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-sm font-bold text-green-700 dark:text-green-300">{summary ?? ''}</p>
      </div>
    );
  }
  return (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
        {issues.length} Issue(s) Detected
      </p>
      <ul className="list-disc list-inside space-y-1">
        {issues.map((issue, i) => (
          <li key={i} className="text-sm text-red-600 dark:text-red-400">
            {issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DnsSection({ dns }: { dns?: Record<string, Record<string, unknown>> }) {
  if (!dns) return null;
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        DNS Resolution
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(dns).map(([domain, info]) => {
          const isResolved = Boolean(info.resolved);
          const resolvedIps = (info.ips as string[] | undefined)?.join(', ');
          const dnsDetail = isResolved
            ? `→ ${resolvedIps}`
            : `✗ ${(info.error as string) || 'Failed'}`;
          return (
            <div
              key={domain}
              className={`p-3 rounded-lg border ${getHealthBorderClass(isResolved, 'redOrGreen')}`}
            >
              <p className="text-xs font-mono font-bold">{domain}</p>
              <p className="text-sm">{String(dnsDetail)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortsSection({ ports }: { ports?: Array<Record<string, unknown>> }) {
  if (!ports) return null;
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        Port Connectivity
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {ports.map(p => (
          <div
            key={p.port as string}
            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-mono ${p.open ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300'}`}
          >
            <span className="font-bold">{p.open ? '✓' : '✗'}</span>
            <span>
              {p.name as string} ({String(p.port ?? '')})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraefikSection({ traefik }: { traefik?: Record<string, unknown> }) {
  if (!traefik) return null;
  const backendOk = traefik.backend_via_traefik === 'reachable';
  const frontendOk = traefik.frontend_via_traefik === 'reachable';
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        Traefik Routing
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg border ${getHealthBorderClass(backendOk, 'redOrGreen')}`}>
          <p className="text-xs font-bold mb-1">Backend via Traefik</p>
          <p className="text-sm">
            {backendOk ? '✓ Reachable' : '✗ Unreachable'} (HTTP{' '}
            {String(traefik.backend_http_status ?? '')})
          </p>
        </div>
        <div className={`p-3 rounded-lg border ${getHealthBorderClass(frontendOk, 'redOrGreen')}`}>
          <p className="text-xs font-bold mb-1">Frontend via Traefik</p>
          <p className="text-sm">
            {frontendOk ? '✓ Reachable' : '✗ Unreachable'} (HTTP{' '}
            {String(traefik.frontend_http_status ?? '')})
          </p>
        </div>
      </div>
    </div>
  );
}

function ContainerNetworkSection({
  container_network,
}: {
  container_network?: Array<Record<string, unknown>>;
}) {
  if (!container_network) return null;
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        Container Network
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {container_network.map(c => (
          <div
            key={c.name as string}
            className={`flex items-center gap-2 p-2 rounded-lg text-xs font-mono ${c.reachable ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300'}`}
          >
            <span className="font-bold">{c.reachable ? '✓' : '✗'}</span>
            <span>{String(c.name ?? '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type SslCert = {
  issuer?: string;
  subject?: string;
  validTo?: string;
  daysLeft?: number;
};

/**
 * Renders the Issuer / Subject / conditional Expires lines for a healthy SSL cert.
 * Extracted from SslSection to flatten the prior nested-ternary (outer guard plus
 * an inline daysLeft color guard wedged into a className attribute).
 */
function SslCertDetails({ cert }: { cert: SslCert }) {
  const daysLeftColorClass =
    cert.daysLeft != null && cert.daysLeft < CERT_EXPIRY_WARN_DAYS
      ? 'text-red-500 font-bold'
      : 'text-green-500';
  return (
    <div className="text-sm space-y-1">
      <p>
        <span className="font-bold">Issuer:</span> {cert.issuer ?? '—'}
      </p>
      <p>
        <span className="font-bold">Subject:</span> {cert.subject ?? '—'}
      </p>
      {cert.validTo && (
        <p>
          <span className="font-bold">Expires:</span> {new Date(cert.validTo).toLocaleDateString()}{' '}
          <span className={daysLeftColorClass}>({cert.daysLeft ?? '—'} days)</span>
        </p>
      )}
    </div>
  );
}

function SslSection({ ssl }: { ssl?: Record<string, unknown> }) {
  if (!ssl) return null;
  const isHealthy = Boolean(ssl.ok);
  const cert = ssl.cert as SslCert | undefined;
  const errorText = String(ssl.error ?? 'Not available (HTTPS not configured)');
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        SSL Certificate
      </h4>
      <div className={`p-3 rounded-lg border ${getHealthBorderClass(isHealthy, 'amberOrGreen')}`}>
        {isHealthy && cert ? (
          <SslCertDetails cert={cert} />
        ) : (
          <p className="text-sm">{errorText}</p>
        )}
      </div>
    </div>
  );
}

function DeploymentSection({ deployment }: { deployment?: Record<string, unknown> }) {
  if (!deployment) return null;
  const prodOk = Boolean(deployment.prod_override_detected);
  const httpsOk = Boolean(deployment.https_active);
  const acmeOk = Boolean(deployment.acme_email_configured);
  return (
    <div className="mb-4">
      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
        Deployment
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-500">NODE_ENV</p>
          <p className="text-sm font-mono">{String(deployment.node_env ?? '')}</p>
        </div>
        <div className={`p-3 rounded-lg border ${getHealthBorderClass(prodOk, 'redOrGreen')}`}>
          <p className="text-xs font-bold text-gray-500">Prod Override</p>
          <p className="text-sm font-bold">{prodOk ? '✓ Active' : '✗ Missing'}</p>
        </div>
        <div className={`p-3 rounded-lg border ${getHealthBorderClass(httpsOk, 'amberOrGreen')}`}>
          <p className="text-xs font-bold text-gray-500">HTTPS</p>
          <p className="text-sm font-bold">{httpsOk ? '✓ Active' : '✗ Inactive'}</p>
        </div>
        <div className={`p-3 rounded-lg border ${getHealthBorderClass(acmeOk, 'amberOrGreen')}`}>
          <p className="text-xs font-bold text-gray-500">ACME Email</p>
          <p className="text-sm font-bold">{acmeOk ? '✓ Set' : '✗ Not set'}</p>
        </div>
      </div>
    </div>
  );
}

function RecommendationsSection({ recommendations }: { recommendations?: string[] }) {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">Recommendations</p>
      <ul className="list-disc list-inside space-y-1">
        {recommendations.map((rec, i) => (
          <li
            key={i}
            className="text-sm text-blue-600 dark:text-blue-400 whitespace-pre-wrap font-mono text-xs"
          >
            {rec}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticResult }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-amber-500" />
          Infrastructure Diagnostics
          {diagnostics.cached && (
            <span className="text-xs text-gray-400 font-normal">(cached)</span>
          )}
        </h3>
        <span className="text-xs text-gray-500">
          {new Date(diagnostics.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <IssuesSummary issues={diagnostics.issues} summary={diagnostics.summary} />
      <DnsSection dns={diagnostics.dns} />
      <PortsSection ports={diagnostics.ports} />
      <TraefikSection traefik={diagnostics.traefik} />
      <ContainerNetworkSection container_network={diagnostics.container_network} />
      <SslSection ssl={diagnostics.ssl} />
      <DeploymentSection deployment={diagnostics.deployment} />
      <RecommendationsSection recommendations={diagnostics.recommendations} />
    </div>
  );
}
function getHealthBorderClass(isHealthy: boolean, palette: 'redOrGreen' | 'amberOrGreen'): string {
  const healthyClass = 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800';
  if (palette === 'redOrGreen') {
    return isHealthy
      ? healthyClass
      : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
  }
  return isHealthy
    ? healthyClass
    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    case 'degraded':
      return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    case 'unhealthy':
      return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    case 'offline':
      return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return CheckCircle;
    case 'degraded':
      return AlertTriangle;
    case 'unhealthy':
      return XCircle;
    case 'offline':
      return XCircle;
    default:
      return Clock;
  }
}

function getComponentIcon(component: string) {
  if (component.toLowerCase().includes('database')) return Database;
  if (component.toLowerCase().includes('redis') || component.toLowerCase().includes('cache'))
    return Zap;
  if (component.toLowerCase().includes('network') || component.toLowerCase().includes('api'))
    return Wifi;
  return Server;
}

function ComponentHealthCard({
  check,
  isTriggering,
  onRecover,
  radiusClass,
  btnClass,
  t,
}: {
  check: HealthCheck;
  isTriggering: boolean;
  onRecover: () => void;
  radiusClass: string;
  btnClass: string;
  t: (key: string) => string;
}) {
  const StatusIcon = getStatusIcon(check.status);
  const ComponentIcon = getComponentIcon(check.component);
  const canRecover = check.status !== 'healthy' && check.consecutiveFailures > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-6 border-2 ${radiusClass} bg-white dark:bg-gray-800 ${getStatusColor(check.status)}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ComponentIcon className="w-8 h-8 text-gray-600 dark:text-gray-400" />
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">{check.component}</h4>
            <div
              className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}
            >
              <StatusIcon className="w-4 h-4" />
              {check.status}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Last Check</span>
          <span className="font-medium">{new Date(check.lastCheck).toLocaleString()}</span>
        </div>

        {check.lastSuccess && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Last Success</span>
            <span className="font-medium">{new Date(check.lastSuccess).toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Consecutive Failures</span>
          <span className="font-medium">{check.consecutiveFailures}</span>
        </div>

        {check.error && (
          <div
            className={`mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${radiusClass}`}
          >
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">Error:</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{check.error}</p>
          </div>
        )}

        {canRecover && (
          <button
            onClick={onRecover}
            disabled={isTriggering}
            className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50 text-sm`}
          >
            <RotateCcw className={`w-4 h-4 ${isTriggering ? 'animate-spin' : ''}`} />
            {t('system_health_trigger_recovery')}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function notifyLoadError(
  error: unknown,
  lastErrorTimeRef: React.MutableRefObject<number>,
  cooldownMs: number,
  addNotification: (n: { type: 'error' | 'success' | 'info' | 'warning'; message: string }) => void,
  t: (key: string) => string
): void {
  const now = Date.now();
  if (now - lastErrorTimeRef.current <= cooldownMs) return;
  const axiosError = error as { response?: { status?: number } };
  addNotification({
    type: 'error',
    message:
      axiosError?.response?.status === RATE_LIMIT_STATUS
        ? 'Too many health check requests. Please wait.'
        : t('system_health_failed_load'),
  });
  lastErrorTimeRef.current = now;
}

function RecoveryLogList({
  actions,
  radiusClass,
  t,
}: {
  actions: RecoveryAction[];
  radiusClass: string;
  t: (key: string) => string;
}) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {t('system_health_recovery_log')}
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {actions.slice(0, 20).map((action, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 ${radiusClass}`}
          >
            <div className="flex items-center gap-4">
              <Shield className={`w-5 h-5 ${action.success ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {action.component}: {action.action}
                </p>
                {action.details && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{action.details}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  action.success
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}
              >
                {action.success ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {action.success ? t('system_health_success') : t('system_health_failed')}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {new Date(action.triggeredAt).toLocaleString()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function useSystemHealthData(
  addNotification: (n: { type: 'error' | 'success' | 'info' | 'warning'; message: string }) => void,
  t: (key: string) => string
) {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [recoveryLog, setRecoveryLog] = useState<RecoveryAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isFetchingRef = useRef(false);
  const lastErrorTimeRef = useRef<number>(0);

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);
        const [healthRes, recoveryRes] = await Promise.all([
          fetchHealthStatus(),
          fetchRecoveryLog(),
        ]);
        if (healthRes.success) setHealthChecks(healthRes.data);
        if (recoveryRes.success) setRecoveryLog(recoveryRes.data);
      } catch (error) {
        console.error('Failed to load health data:', error);
        notifyLoadError(error, lastErrorTimeRef, ERROR_COOLDOWN_MS, addNotification, t);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [addNotification, t]
  );

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const overallHealth =
    healthChecks.length > 0
      ? {
          healthy: healthChecks.filter(h => h.status === 'healthy').length,
          degraded: healthChecks.filter(h => h.status === 'degraded').length,
          unhealthy: healthChecks.filter(h => h.status === 'unhealthy').length,
          offline: healthChecks.filter(h => h.status === 'offline').length,
        }
      : { healthy: 0, degraded: 0, unhealthy: 0, offline: 0 };

  return { healthChecks, recoveryLog, isLoading, isRefreshing, overallHealth, reload: loadData };
}

export function SystemHealth() {
  const { t } = useLanguage();
  const { headingClass, isModern, radiusClass, btnClass } = useThemeClasses();
  const { addNotification } = useAppStore();
  const { healthChecks, recoveryLog, isLoading, isRefreshing, overallHealth, reload } =
    useSystemHealthData(addNotification, t);

  const [triggeringRecovery, setTriggeringRecovery] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const handleTriggerRecovery = async (component: string) => {
    setTriggeringRecovery(component);
    try {
      const res = await triggerRecovery(component);
      if (res.success) {
        addNotification({
          type: 'success',
          message: `Recovery triggered for ${component}`,
        });
        setTimeout(() => reload(), 2000);
      }
    } catch (error) {
      console.error('Failed to trigger recovery:', error);
      addNotification({
        type: 'error',
        message: `Failed to trigger recovery for ${component}`,
      });
    } finally {
      setTriggeringRecovery(null);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const result = await runDiagnostics();
      setDiagnostics(result);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to run diagnostics',
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingHeaderSkeleton
        title="Self-Healing Monitor"
        description="Monitor system health and automatic recovery"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl ${headingClass}`}>
            {isModern ? 'Infrastructure Vitality' : 'System Health'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('system_health_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDiagnostics}
            disabled={isRunningDiagnostics}
            className={`flex items-center gap-2 px-4 py-2 bg-amber-600 text-white ${btnClass} hover:bg-amber-700 disabled:opacity-50 transition-all`}
          >
            <Activity className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-pulse' : ''}`} />
            {isRunningDiagnostics ? 'Running...' : 'Run Diagnostics'}
          </button>
          <button
            onClick={() => reload(true)}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={t('system_health_healthy_components')}
          value={overallHealth.healthy}
          icon={CheckCircle}
          color="green"
        />
        <MetricCard
          title={t('system_health_degraded')}
          value={overallHealth.degraded}
          icon={AlertTriangle}
          color="yellow"
        />
        <MetricCard
          title={t('system_health_unhealthy')}
          value={overallHealth.unhealthy}
          icon={XCircle}
          color="red"
        />
        <MetricCard
          title={t('system_health_offline')}
          value={overallHealth.offline}
          icon={XCircle}
          color="gray"
        />
      </div>

      {/* Component Health Grid */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          {t('system_health_component_status')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {healthChecks.map(check => (
            <ComponentHealthCard
              key={check.component}
              check={check}
              isTriggering={triggeringRecovery === check.component}
              onRecover={() => handleTriggerRecovery(check.component)}
              radiusClass={radiusClass}
              btnClass={btnClass}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* Diagnostics Results */}
      {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} />}

      {/* Recovery Log */}
      <RecoveryLogList actions={recoveryLog} radiusClass={radiusClass} t={t} />
    </div>
  );
}

export default SystemHealth;
