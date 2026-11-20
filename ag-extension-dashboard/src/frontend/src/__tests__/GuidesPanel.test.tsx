import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api/client', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { GuidesPanel } from '../components/KnowledgeBase/guides/GuidesPanel';

const asRole = (role: string) => useAppStore.setState({ user: { id: 'u1', role, country: 'Malawi' } as never });

describe('Local guides panel', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('is hidden from farmers', () => {
    asRole('farmer');
    const { container } = render(<GuidesPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lets an officer add a guide but not review', () => {
    asRole('extension_officer');
    render(<GuidesPanel />);
    expect(screen.getByRole('form', { name: 'Add a guide' })).toBeInTheDocument();
    expect(screen.queryByText('Waiting for review')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('lets a manager approve a guide waiting for review', async () => {
    asRole('regional_manager');
    api.get.mockResolvedValue({ data: { data: [{ id: 'g1', title: 'Maize spacing in Mzimba', source: 'Dynamic Ingestion', sourceUrl: null, updatedAt: '2026-11-20T10:00:00Z' }] } });
    api.post.mockResolvedValue({ data: { success: true } });
    render(<GuidesPanel />);
    expect(await screen.findByText('Maize spacing in Mzimba')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/knowledge/quarantine/g1/clear', { verdict: 'approve' }));
    await waitFor(() => expect(screen.queryByText('Maize spacing in Mzimba')).not.toBeInTheDocument());
  });
});
