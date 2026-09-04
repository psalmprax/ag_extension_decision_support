import React from 'react';

function getHealthStatus(data: { status?: string; services?: { external_apis?: string } } | undefined) {
  if (!data) return { status: 'unknown', healthy: false, degraded: false };
  const status = data.status ?? 'unknown';
  const healthy = status.startsWith('healthy');
  const degraded = status.startsWith('degraded') || status.includes('warmup');
  return { status, healthy, degraded };
}

function getStatusStyles(status: string): { dot: string; text: string } {
  if (status.startsWith('healthy')) return { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-300' };
  if (status.startsWith('degraded') || status.includes('warmup')) return { dot: 'bg-amber-400', text: 'text-amber-300' };
  return { dot: 'bg-rose-400', text: 'text-rose-300' };
}

/**
 * API health badge. Derived from GET /health; shows the real reported status and
 * never claims a specific upstream (e.g. NASA POWER) is synchronized.
 */
export const NasaPowerBadge: React.FC<{ data: { status?: string; uptime?: number; services?: { external_apis?: string } } | undefined }> = ({ data }) => {
  const { status } = getHealthStatus(data);
  const styles = getStatusStyles(status);
  const label = status.toUpperCase();
  const ext = data?.services?.external_apis;
  return (
    <div
      className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono"
      title={data ? `API status: ${data.status}${ext ? ` · external APIs ${ext}` : ''}` : 'Health check failed or pending'}
    >
      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      <span className="text-white/70">API:</span>
      <span className={`font-bold ${styles.text}`}>{label}</span>
      {ext && <span className="text-white/40">· EXT {ext}</span>}
    </div>
  );
};

/**
 * Knowledge-base badge. Uses /knowledge/stats: article count and how many carry an
 * embedding (i.e. are reachable by vector search). Shows "—" when unavailable.
 */
export const RagMeshBadge: React.FC<{ data: { data?: { totalQueries?: number; totalArticles?: number; embeddedArticles?: number } } | undefined }> = ({ data }) => {
  const stats = data?.data;
  const total = stats?.totalArticles;
  const embedded = stats?.embeddedArticles;
  const status = computeKnowledgeStatus(total, embedded);
  return (
    <div
      className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono"
      title={stats ? `${embedded ?? '?'} of ${total ?? '?'} articles embedded · ${stats.totalQueries ?? 0} queries recorded` : 'Knowledge stats unavailable'}
    >
      <span className={`w-2 h-2 rounded-full ${status.dot}`} />
      <span className="text-white/70">KNOWLEDGE:</span>
      <span className={`${status.text} font-bold`}>
        {typeof total === 'number' ? `${total} ARTICLES` : '—'}
      </span>
      {status.partial && <span className="text-white/40">· {embedded}/{total} INDEXED</span>}
    </div>
  );
};

function computeKnowledgeStatus(total: number | undefined, embedded: number | undefined): { dot: string; text: string; partial: boolean } {
  if (typeof total !== 'number' || typeof embedded !== 'number') {
    return { dot: 'bg-slate-500', text: 'text-slate-400', partial: false };
  }
  if (total > 0 && embedded === total) {
    return { dot: 'bg-emerald-400', text: 'text-emerald-300', partial: false };
  }
  if (embedded < total) {
    return { dot: 'bg-amber-400', text: 'text-amber-300', partial: true };
  }
  return { dot: 'bg-cyan-400', text: 'text-cyan-300', partial: false };
}
