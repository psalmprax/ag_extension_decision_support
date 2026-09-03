import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  RefreshCw,
  Shield,
  Server,
  Database,
  Zap,
  Wifi,
  Radio,
  Terminal,
  Cpu,
  Globe,
  Lock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import {
  fetchHealthStatus,
  fetchRecoveryLog,
  triggerRecovery,
  HealthCheck,
  RecoveryAction,
} from '../api/systemHealthService';
import { runDiagnostics, DiagnosticResult } from '../api/diagnosticsService';
import { LoadingHeaderSkeleton } from '@/components/ui/LoadingHeaderSkeleton';
import { SyncQueuePanel } from '@/components/SyncQueuePanel';
import { RATE_LIMIT_STATUS, CERT_EXPIRY_WARN_DAYS, ERROR_COOLDOWN_MS } from '@/lib/constants';

function IssuesSummary({ issues, summary }: { issues?: string[]; summary?: string }) {
  if (!issues || issues.length === 0) {
    return (
      <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="text-xs font-bold text-emerald-300">{summary || 'All edge subsystems and container clusters operating at optimal SLO latency.'}</p>
      </div>
    );
  }
  return (
    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-5 h-5 text-rose-400" />
        <p className="text-xs font-bold text-rose-300">
          {issues.length} Infrastructure Incident(s) Detected
        </p>
      </div>
      <ul className="list-disc list-inside space-y-1 pl-1">
        {issues.map((issue, i) => (
          <li key={i} className="text-xs text-rose-200 font-mono">
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
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-emerald-400" /> DNS Resolution & Edge Routing
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(dns).map(([domain, info]) => {
          const isResolved = Boolean(info.resolved);
          const resolvedIps = (info.ips as string[] | undefined)?.join(', ');
          const dnsDetail = isResolved
            ? `→ ${resolvedIps}`
            : `✗ ${(info.error as string) || 'Resolution Failed'}`;
          return (
            <div
              key={domain}
              className={`p-3 rounded-xl border text-xs ${
                isResolved
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
              }`}
            >
              <p className="font-mono font-bold text-white">{domain}</p>
              <p className="font-mono text-xxs mt-0.5 opacity-80">{String(dnsDetail)}</p>
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
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Port Connectivity & Sockets
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {ports.map(p => (
          <div
            key={p.port as string}
            className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-mono border ${
              p.open
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            <span className="font-bold">{p.open ? '✓' : '✗'}</span>
            <span className="truncate">
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
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Reverse Proxy Ingress (Traefik)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className={`p-3 rounded-xl border text-xs ${
            backendOk
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          <p className="font-bold text-white mb-0.5">Backend API Ingress</p>
          <p className="font-mono text-xxs">
            {backendOk ? '✓ Reachable & Handshaking' : '✗ Upstream Unreachable'} (HTTP{' '}
            {String(traefik.backend_http_status ?? '')})
          </p>
        </div>
        <div
          className={`p-3 rounded-xl border text-xs ${
            frontendOk
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
          }`}
        >
          <p className="font-bold text-white mb-0.5">Frontend SPA Ingress</p>
          <p className="font-mono text-xxs">
            {frontendOk ? '✓ Reachable & Serving' : '✗ Ingress Failed'} (HTTP{' '}
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
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Server className="w-3.5 h-3.5 text-emerald-400" /> Container Mesh Topology
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {container_network.map(c => (
          <div
            key={c.name as string}
            className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-mono border ${
              c.reachable
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            <span className="font-bold">{c.reachable ? '✓' : '✗'}</span>
            <span className="truncate">{String(c.name ?? '')}</span>
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

function SslSection({ ssl }: { ssl?: Record<string, unknown> }) {
  if (!ssl) return null;
  const isHealthy = Boolean(ssl.ok);
  const cert = ssl.cert as SslCert | undefined;
  const errorText = String(ssl.error ?? 'Not available (HTTPS not configured)');
  return (
    <div className="mb-4">
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-emerald-400" /> TLS / SSL Certificate Status
      </h4>
      <div
        className={`p-3.5 rounded-xl border text-xs ${
          isHealthy
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
        }`}
      >
        {isHealthy && cert ? (
          <div className="space-y-1 font-mono text-xs">
            <p><span className="text-white/60">Issuer:</span> {cert.issuer ?? 'Let\'s Encrypt'}</p>
            <p><span className="text-white/60">Subject:</span> {cert.subject ?? 'gpexts.com'}</p>
            {cert.validTo && (
              <p>
                <span className="text-white/60">Expires:</span> {new Date(cert.validTo).toLocaleDateString()}{' '}
                <span className={cert.daysLeft != null && cert.daysLeft < CERT_EXPIRY_WARN_DAYS ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  ({cert.daysLeft ?? '—'} days remaining)
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="font-mono text-xs">{errorText}</p>
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
      <h4 className="text-xxs font-bold text-white/50 mb-2 uppercase tracking-wider">
        Deployment Runtime Specs
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border bg-white/[0.02] border-white/10 text-xs">
          <p className="text-xxs font-bold text-white/40 uppercase">NODE_ENV</p>
          <p className="text-xs font-mono font-bold text-white mt-0.5">{String(deployment.node_env ?? 'production')}</p>
        </div>
        <div className={`p-3 rounded-xl border text-xs ${prodOk ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-rose-500/10 border-rose-500/25 text-rose-300'}`}>
          <p className="text-xxs font-bold opacity-60 uppercase">Prod Override</p>
          <p className="text-xs font-bold mt-0.5">{prodOk ? '✓ Active' : '✗ Missing'}</p>
        </div>
        <div className={`p-3 rounded-xl border text-xs ${httpsOk ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'}`}>
          <p className="text-xxs font-bold opacity-60 uppercase">HTTPS TLS</p>
          <p className="text-xs font-bold mt-0.5">{httpsOk ? '✓ Enforced' : '✗ Inactive'}</p>
        </div>
        <div className={`p-3 rounded-xl border text-xs ${acmeOk ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'}`}>
          <p className="text-xxs font-bold opacity-60 uppercase">ACME Email</p>
          <p className="text-xs font-bold mt-0.5">{acmeOk ? '✓ Configured' : '✗ Not set'}</p>
        </div>
      </div>
    </div>
  );
}

function RecommendationsSection({ recommendations }: { recommendations?: string[] }) {
  if (!recommendations || recommendations.length === 0) return null;
  return (
    <div className="mt-4 p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl">
      <p className="text-xs font-bold text-sky-300 mb-2">Automated SRE Recommendations</p>
      <ul className="list-disc list-inside space-y-1">
        {recommendations.map((rec, i) => (
          <li key={i} className="text-xs text-sky-200 whitespace-pre-wrap font-mono">
            {rec}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticResult }) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          Infrastructure Diagnostic Telemetry
          {diagnostics.cached && (
            <span className="text-xxs text-white/40 font-mono">(cached)</span>
          )}
        </h3>
        <span className="text-xs text-white/40 font-mono">
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

function getStatusStyle(status: string) {
  switch (status) {
    case 'healthy':
      return {
        pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'degraded':
      return {
        pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        dot: 'bg-amber-400',
        border: 'border-amber-500/30',
      };
    case 'unhealthy':
      return {
        pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        dot: 'bg-rose-400',
        border: 'border-rose-500/30',
      };
    default:
      return {
        pill: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        dot: 'bg-slate-400',
        border: 'border-slate-500/30',
      };
  }
}

function getComponentIcon(component: string) {
  if (component.toLowerCase().includes('database') || component.toLowerCase().includes('postgres')) return Database;
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
  t,
}: {
  check: HealthCheck;
  isTriggering: boolean;
  onRecover: () => void;
  t: (key: string) => string;
}) {
  const ComponentIcon = getComponentIcon(check.component);
  const canRecover = check.status !== 'healthy' && check.consecutiveFailures > 0;
  const style = getStatusStyle(check.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`backdrop-blur-xl bg-slate-900/60 border ${style.border} rounded-xl p-5 shadow-lg space-y-4 hover:border-white/20 transition-all duration-300 group`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-emerald-400">
            <ComponentIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">{check.component}</h4>
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xxs font-bold uppercase tracking-wider border mt-1 ${style.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
              {check.status}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono">
        <div className="flex justify-between text-white/60">
          <span>Last Poll</span>
          <span className="text-white">{new Date(check.lastCheck).toLocaleTimeString()}</span>
        </div>

        {check.lastSuccess && (
          <div className="flex justify-between text-white/60">
            <span>Last Ack</span>
            <span className="text-emerald-400">{new Date(check.lastSuccess).toLocaleTimeString()}</span>
          </div>
        )}

        <div className="flex justify-between text-white/60">
          <span>Failures</span>
          <span className={check.consecutiveFailures > 0 ? 'text-rose-400 font-bold' : 'text-white'}>
            {check.consecutiveFailures}
          </span>
        </div>

        {check.error && (
          <div className="mt-2 p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-300 text-xxs">
            <p className="font-bold">Error:</p>
            <p className="mt-0.5 opacity-90">{check.error}</p>
          </div>
        )}

        {canRecover && (
          <button
            onClick={onRecover}
            disabled={isTriggering}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
            {t('system_health_trigger_recovery') || 'Execute Self-Healing'}
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
  t,
}: {
  actions: RecoveryAction[];
  t: (key: string) => string;
}) {
  return (
    <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          {t('system_health_recovery_log') || 'Automated SRE Recovery Audit Log'}
        </h3>
        <span className="text-xs text-white/40 font-mono">Real-time Stream</span>
      </div>

      <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar pr-1">
        {actions.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-xs font-mono">
            No recovery interventions recorded. Cluster operating autonomously.
          </div>
        ) : (
          actions.slice(0, 20).map((action, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all text-xs"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.success ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                  {action.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-white">
                    {action.component}: <span className="font-normal text-white/70">{action.action}</span>
                  </p>
                  {action.details && (
                    <p className="text-xxs font-mono text-white/40 mt-0.5">{action.details}</p>
                  )}
                </div>
              </div>
              <div className="text-right font-mono text-xxs text-white/40">
                <span className={`inline-block px-2 py-0.5 rounded-full uppercase font-bold text-xxs mb-1 ${action.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {action.success ? 'Success' : 'Failed'}
                </span>
                <div>{new Date(action.triggeredAt).toLocaleTimeString()}</div>
              </div>
            </motion.div>
          ))
        )}
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
          message: `Self-healing recovery triggered for ${component}`,
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
      addNotification({
        type: 'success',
        message: 'Diagnostics scan completed successfully.',
      });
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
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* ── Top Bento Banner: SRE & Telemetry Health Hub ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">SRE & Self-Healing Telemetry</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Cluster Online
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Real-time node latency, database connections, and autonomous self-healing monitors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            <button
              onClick={handleRunDiagnostics}
              disabled={isRunningDiagnostics}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
              <span>{isRunningDiagnostics ? 'Running Scan...' : 'Deep Diagnostic'}</span>
            </button>
            <button
              onClick={() => reload(true)}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/10 text-xs font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── Subsystem Metric Tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-white/5">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
            <span className="text-xxs font-bold text-white/40 uppercase block">Healthy Services</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <strong className="text-lg font-mono font-bold text-emerald-400">{overallHealth.healthy}</strong>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
            <span className="text-xxs font-bold text-white/40 uppercase block">Degraded Nodes</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <strong className="text-lg font-mono font-bold text-amber-400">{overallHealth.degraded}</strong>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
            <span className="text-xxs font-bold text-white/40 uppercase block">Unhealthy</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <strong className="text-lg font-mono font-bold text-rose-400">{overallHealth.unhealthy}</strong>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
            <span className="text-xxs font-bold text-white/40 uppercase block">Offline</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <strong className="text-lg font-mono font-bold text-slate-400">{overallHealth.offline}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Component Health Radar Grid ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            Core Infrastructure Nodes ({healthChecks.length})
          </h3>
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Active Mesh
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthChecks.map(check => (
            <ComponentHealthCard
              key={check.component}
              check={check}
              isTriggering={triggeringRecovery === check.component}
              onRecover={() => handleTriggerRecovery(check.component)}
              t={t}
            />
          ))}
        </div>
      </div>

      {/* ── Deep Diagnostics Output ── */}
      {diagnostics && <DiagnosticsPanel diagnostics={diagnostics} />}

      {/* ── Offline write queue (client-side) ── */}
      <SyncQueuePanel />

      {/* ── Recovery Audit Log ── */}
      <RecoveryLogList actions={recoveryLog} t={t} />
    </div>
  );
}

export default SystemHealth;

