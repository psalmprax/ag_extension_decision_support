import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOpenFarmerChat } from '@/hooks/useOpenFarmerChat';
import { useAppStore } from '@/store/useAppStore';
import type { Farmer } from '@/types/dashboard';

vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: false }) }));

const farmer = { id: 'f1', firstName: 'Wanjiku', lastName: 'Kamau' } as Farmer;

function setup(role: string, started = true) {
  const handleStartConversation = vi.fn().mockResolvedValue(started);
  const handleOpenFarmerDetail = vi.fn();
  const { result } = renderHook(() => useOpenFarmerChat({ role, handleStartConversation, handleOpenFarmerDetail }));
  return { open: result.current, handleStartConversation, handleOpenFarmerDetail };
}

const lastNotification = () => useAppStore.getState().notifications.at(0);

describe('useOpenFarmerChat — every "chat" click visibly does something', () => {
  beforeEach(() => useAppStore.setState({ activeTab: 'dashboard', notifications: [] }));

  it('starts the conversation and switches to the farmer chat tab', async () => {
    const { open, handleStartConversation } = setup('extension_officer');
    await act(() => open(farmer));
    expect(handleStartConversation).toHaveBeenCalledWith(farmer, 'farmer');
    expect(useAppStore.getState().activeTab).toBe('farmerchat');
  });

  it('explains when the farmer cannot be found instead of doing nothing', async () => {
    const { open, handleStartConversation } = setup('extension_officer');
    await act(() => open(undefined));
    expect(handleStartConversation).not.toHaveBeenCalled();
    expect(lastNotification()).toMatchObject({ type: 'warning', message: 'Farmer record not found.' });
    expect(useAppStore.getState().activeTab).toBe('dashboard');
  });

  it('reports a failed start and stays on the dashboard', async () => {
    const { open } = setup('admin', false);
    await act(() => open(farmer));
    expect(lastNotification()).toMatchObject({ type: 'error' });
    expect(useAppStore.getState().activeTab).toBe('dashboard');
  });

  it('opens the farmer detail view for roles that may not chat', async () => {
    const { open, handleStartConversation, handleOpenFarmerDetail } = setup('farmer');
    await act(() => open(farmer));
    expect(handleOpenFarmerDetail).toHaveBeenCalledWith(farmer);
    expect(handleStartConversation).not.toHaveBeenCalled();
  });
});
