import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditIntegrityPanel } from '../AuditIntegrityPanel';
import { checkAuditChain, type AuditChainCheck } from '@/api/auditService';

vi.mock('@/api/auditService', () => ({ checkAuditChain: vi.fn() }));

const base: AuditChainCheck = {
  status: 'intact', checkedEntries: 1204, unchainedEntries: 2934, unverifiableEntries: 0, firstChainedAt: '2026-12-02T09:00:00Z',
  head: { seq: 1204, hash: 'ab'.repeat(32), at: '2026-12-03T10:00:00Z' }, problem: null,
};

function check(result: AuditChainCheck) {
  vi.mocked(checkAuditChain).mockResolvedValue(result);
  render(<QueryClientProvider client={new QueryClient()}><AuditIntegrityPanel /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Check the audit log' }));
}

describe('AuditIntegrityPanel', () => {
  it('only checks when asked', () => {
    vi.mocked(checkAuditChain).mockClear();
    render(<QueryClientProvider client={new QueryClient()}><AuditIntegrityPanel /></QueryClientProvider>);
    expect(checkAuditChain).not.toHaveBeenCalled();
  });

  it('reports an intact chain, the older unchecked entries and the newest hash to keep', async () => {
    check(base);
    expect(await screen.findByText(/Intact: all 1,204 entries since/)).toBeInTheDocument();
    expect(screen.getByText(/2,934 older entries were written before the chain began/)).toBeInTheDocument();
    expect(screen.getByText('ab'.repeat(32))).toBeInTheDocument();
  });

  it('counts entries whose deleted account left them uncheckable apart, without calling them changed', async () => {
    check({ ...base, unverifiableEntries: 163 });
    expect(await screen.findByText(/Intact: the 1,041 entries since .* that can be checked/)).toBeInTheDocument();
    expect(screen.getByText(/163 older entries cannot be checked: their account was deleted/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names the entry where an edit broke the chain', async () => {
    check({ ...base, status: 'broken', problem: { seq: 57, kind: 'changed', at: '2026-12-02T12:00:00Z' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Broken: entry 57 .*was changed after it was written/);
  });

  it('says when entries were removed', async () => {
    check({ ...base, status: 'broken', problem: { seq: 9, kind: 'missing', at: '2026-12-02T12:00:00Z' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/entries are missing just before entry 9/);
  });
});
