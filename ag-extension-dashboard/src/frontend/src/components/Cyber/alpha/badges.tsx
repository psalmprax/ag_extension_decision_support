import React from 'react';

/**
 * API health badge. Derived from GET /health; shows the real reported status and
 * never claims a specific upstream (e.g. NASA POWER) is synchronized.
 */
export const NasaPowerBadge: React.FC<{ data: { status?: string; uptime?: number; services?: { external_apis?: string } } | undefined }> = ({ data }) => {
  const status = data?.status ?? 'unknown';
  const healthy = status.startsWith('healthy');
  const degraded = status.startsWith('degraded') || status.includes('warmup');
  const dot = !data ? 'bg-slate-500' : healthy ? 'bg-emerald-400 animate-pulse' : degraded ? 'bg-amber-400' : 'bg-rose-400';
  const text = !data ? 'text-slate-400' : healthy ? 'text-emerald-300' : degraded ? 'text-amber-300' : 'text-rose-300';
  const label = !data ? 'UNREACHABLE' : status.toUpperCase();
  const ext = data?.services?.external_apis;
  return (
    <div
      className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono"
      title={data ? `API status: ${status}${ext ? ` · external APIs ${ext}` : ''}` : 'Health check failed or pending'}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-white/70">API:</span>
      <span className={`${text} font-bold`}>{label}</span>
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
  const ok = typeof total === 'number' && typeof embedded === 'number' && total > 0 && embedded === total;
  const partial = typeof total === 'number' && typeof embedded === 'number' && embedded < total;
  return (
    <div
      className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono"
      title={stats ? `${embedded ?? '?'} of ${total ?? '?'} articles embedded · ${stats.totalQueries ?? 0} queries recorded` : 'Knowledge stats unavailable'}
    >
      <span className={`w-2 h-2 rounded-full ${!stats ? 'bg-slate-500' : ok ? 'bg-emerald-400' : partial ? 'bg-amber-400' : 'bg-cyan-400'}`} />
      <span className="text-white/70">KNOWLEDGE:</span>
      <span className={`${!stats ? 'text-slate-400' : ok ? 'text-emerald-300' : partial ? 'text-amber-300' : 'text-cyan-300'} font-bold`}>
        {typeof total === 'number' ? `${total} ARTICLES` : '—'}
      </span>
      {partial && <span className="text-white/40">· {embedded}/{total} INDEXED</span>}
    </div>
  );
};
