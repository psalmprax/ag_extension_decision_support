import React from 'react';

export const NasaPowerBadge: React.FC<{ data: { status?: string; uptime?: number } | undefined }> = ({ data }) => (
  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono" title={data ? `Health: ${data.status || 'ok'}` : 'Health check pending'}>
    <span className={`w-2 h-2 rounded-full ${data ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
    <span className="text-white/70">NASA POWER:</span>
    <span className={data ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>{data ? 'SYNCHRONIZED' : '[DEMO] SYNCHRONIZED'}</span>
  </div>
);

export const RagMeshBadge: React.FC<{ data: { data?: { totalQueries?: number } } | undefined }> = ({ data }) => (
  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 text-xxs font-mono" title={data?.data?.totalQueries != null ? `Total RAG queries: ${data.data.totalQueries}` : 'Real RAG count via /knowledge/stats'}>
    <span className={`w-2 h-2 rounded-full ${data?.data ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
    <span className="text-white/70">RAG MESH:</span>
    <span className={data?.data ? 'text-emerald-300 font-bold' : 'text-cyan-300 font-bold'}>{data?.data?.totalQueries != null ? `${data.data.totalQueries} QUERIES` : '[DEMO] 1,420 ARTICLES'}</span>
  </div>
);
