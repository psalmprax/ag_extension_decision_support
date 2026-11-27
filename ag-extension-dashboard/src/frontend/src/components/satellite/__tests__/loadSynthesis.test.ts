import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

const fetchSynthesis = vi.fn();
vi.mock('@/api/visitService', () => ({
  fetchSynthesis: (...args: unknown[]) => fetchSynthesis(...args),
  fetchVisitsByFarmer: vi.fn(),
  fetchPriorityScore: vi.fn(),
  fetchSatelliteTelemetry: vi.fn(),
}));
vi.mock('@/api/farmerService', () => ({ fetchFarmerById: vi.fn() }));

import { loadSynthesis } from '../useSatelliteData';

const httpError = (status: number) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status, statusText: '', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
  });

describe('farmer panel visit summary', () => {
  beforeEach(() => { fetchSynthesis.mockReset(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('says so when the summary was withheld by the safety review, instead of failing the panel', async () => {
    fetchSynthesis.mockRejectedValue(httpError(422));
    await expect(loadSynthesis('f1', [{ visit_type: 'routine', notes: 'Leaves yellowing on the lower stems' }]))
      .resolves.toMatch(/withheld/);
  });

  it('falls back to a plain message on any other failure', async () => {
    fetchSynthesis.mockRejectedValue(httpError(500));
    await expect(loadSynthesis('f1', [{ visit_type: 'routine', notes: 'Leaves yellowing on the lower stems' }]))
      .resolves.toBe('Visit synthesis is unavailable.');
  });

  it('does not ask for a summary of visits without notes', async () => {
    await expect(loadSynthesis('f1', [{ visit_type: 'routine', notes: '' }, { visit_type: 'follow_up' }]))
      .resolves.toBe('No visit notes to summarise yet.');
    expect(fetchSynthesis).not.toHaveBeenCalled();
  });

  it('returns the summary when there is one', async () => {
    fetchSynthesis.mockResolvedValue({ success: true, data: { summary: 'Maize looks healthy.' } });
    await expect(loadSynthesis('f1', [{ visit_type: 'routine', notes: 'Maize knee high, no pests seen' }]))
      .resolves.toBe('Maize looks healthy.');
  });
});
