import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FarmerChatPage } from '../pages/FarmerChatPage';
import { getChatCompletion } from '@/api/aiService';
import { fetchFarmerSoilProfile } from '@/api/soilService';

vi.mock('@/lib/LanguageContext', () => ({ useLanguage: () => ({ t: () => '' }) }));
vi.mock('@/hooks/useThemeClasses', () => ({ useThemeClasses: () => ({ headingClass: '', btnClass: '' }) }));
vi.mock('@/hooks/useDeviceThermalMemoryBudget', () => ({ useDeviceThermalMemoryBudget: () => ({ isLowEndDevice: false }) }));
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: true }) }));
vi.mock('@/components/common/VirtualizedList', () => ({ VirtualizedList: () => null }));
vi.mock('@/components/audio/AudioReaderButton', () => ({ AudioReaderButton: () => null }));
vi.mock('@/components/audio/VoiceNoteTaker', () => ({ VoiceNoteTaker: () => null }));
vi.mock('@/api/aiService', () => ({ getChatCompletion: vi.fn() }));
vi.mock('@/api/weatherService', () => ({ fetchWeather: vi.fn() }));
vi.mock('@/api/soilService', () => ({ fetchFarmerSoilProfile: vi.fn() }));

describe('Farmer chat suggestion isolation', () => {
  it('discards late suggestions from the previous conversation', async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;
    vi.mocked(getChatCompletion)
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve as typeof resolveFirst; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve as typeof resolveSecond; }));
    const conversations = [
      { id: 'one', title: 'Farmer one', startedAt: '', updatedAt: '' },
      { id: 'two', title: 'Farmer two', startedAt: '', updatedAt: '' },
    ];
    const props = {
      farmerConversations: conversations, activeFarmerConvId: 'one', setActiveFarmerConvId: vi.fn(),
      loadFarmerMessages: vi.fn(), farmerChatMessages: [{ role: 'user' as const, content: 'First message' }],
      farmerChatInput: '', setFarmerChatInput: vi.fn(), handleFarmerChatSend: vi.fn(),
      loadFarmers: vi.fn(), setShowFarmerModal: vi.fn(),
    };
    const view = render(<FarmerChatPage {...props} />);
    await waitFor(() => expect(getChatCompletion).toHaveBeenCalledTimes(1));
    view.rerender(<FarmerChatPage {...props} activeFarmerConvId="two"
      farmerChatMessages={[{ role: 'user', content: 'Second message' }]} />);
    await waitFor(() => expect(getChatCompletion).toHaveBeenCalledTimes(2));
    await act(async () => resolveFirst({ data: { messages: [{ role: 'assistant', content: 'Old first question?\nOld second question?' }] } }));
    expect(screen.queryByText('Old first question?')).toBeNull();
    await act(async () => resolveSecond({ data: { messages: [{ role: 'assistant', content: 'New first question?\nNew second question?' }] } }));
    expect(screen.getByText('New first question?')).toBeTruthy();
  });

  it('does not display a prior farmer’s delayed soil profile after switching', async () => {
    const profile = (ph: number): Awaited<ReturnType<typeof fetchFarmerSoilProfile>> => ({
      success: true, data: {
        baseline: {
          ph, source: 'test', dataStatus: 'test', disclaimer: '', location: { lat: 0, lon: 0 },
          depth: '0-5cm', organicCarbonGPerKg: null, nitrogenCgPerKg: null, nitrogenMgPerKg: null,
          cecCmolPerKg: null, bulkDensityKgPerM3: null, sandPct: null, siltPct: null, clayPct: null,
        },
        moisture: null, location: null, labResults: [],
      },
    });
    let resolveFirst!: (value: Awaited<ReturnType<typeof fetchFarmerSoilProfile>>) => void;
    vi.mocked(fetchFarmerSoilProfile)
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(profile(7.3));
    const conversations = [
      { id: 'one', title: 'Farmer one', farmerId: 'farmer-one', startedAt: '', updatedAt: '' },
      { id: 'two', title: 'Farmer two', farmerId: 'farmer-two', startedAt: '', updatedAt: '' },
    ];
    const props = {
      farmerConversations: conversations, activeFarmerConvId: 'one', setActiveFarmerConvId: vi.fn(),
      loadFarmerMessages: vi.fn(), farmerChatMessages: [], farmerChatInput: '', setFarmerChatInput: vi.fn(),
      handleFarmerChatSend: vi.fn(), loadFarmers: vi.fn(), setShowFarmerModal: vi.fn(),
    };
    const view = render(<FarmerChatPage {...props} />);
    await waitFor(() => expect(fetchFarmerSoilProfile).toHaveBeenCalledWith('farmer-one'));
    view.rerender(<FarmerChatPage {...props} activeFarmerConvId="two" />);
    await waitFor(() => expect(fetchFarmerSoilProfile).toHaveBeenCalledWith('farmer-two'));
    await act(async () => resolveFirst(profile(4.1)));
    expect(screen.queryByText(/4\.1 pH/)).toBeNull();
    expect(screen.getByText(/7\.3 pH/)).toBeTruthy();
  });
});
