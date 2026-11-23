import apiClient from './client';

/** The result of checking the audit log's hash chain (GET /audit-logs/integrity). */
export interface AuditChainCheck {
  status: 'intact' | 'broken' | 'empty';
  checkedEntries: number;
  unchainedEntries: number;
  firstChainedAt: string | null;
  head: { seq: number; hash: string; at: string } | null;
  problem: { seq: number; kind: 'changed' | 'missing'; at: string } | null;
}

export async function checkAuditChain(): Promise<AuditChainCheck> {
  const { data } = await apiClient.get('/v1/audit-logs/integrity');
  return data.data;
}
