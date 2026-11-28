import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

const fetchFarmers = vi.fn();
const fetchFarmerSoilProfile = vi.fn();
vi.mock('../api/farmerService', () => ({ fetchFarmers: () => fetchFarmers(), updateFarmer: vi.fn() }));
vi.mock('../api/soilService', () => ({ fetchFarmerSoilProfile: (id: string) => fetchFarmerSoilProfile(id) }));
vi.mock('../api/reportService', () => ({ downloadReportPdf: vi.fn() }));
vi.mock('../api/diseaseService', () => ({ analyzeSoilImage: vi.fn() }));

import { SoilDiagnosticsTab } from '../pages/diagnostics/SoilDiagnosticsTab';

function renderTab() {
  render(<SoilDiagnosticsTab cropType="" setCropType={() => undefined} radiusClass="" btnClass="" addNotification={() => undefined} />);
}

describe('soil tab for a farmer', () => {
  beforeEach(() => {
    fetchFarmers.mockReset();
    fetchFarmerSoilProfile.mockReset().mockReturnValue(new Promise(() => undefined));
  });

  it("loads the farmer's own soil without asking them to choose themselves", async () => {
    useAppStore.setState({ user: { id: 'u1', email: 'f@test.dev', role: 'farmer' } as never });
    fetchFarmers.mockResolvedValue({ success: true, data: { farmers: [{ id: 'farmer-1', firstName: 'Mary', lastName: 'Njeri' }] } });
    renderTab();
    const picker = await screen.findByRole('combobox', { name: /farmer/i });
    await waitFor(() => expect(picker).toHaveValue('farmer-1'));
    expect(fetchFarmerSoilProfile).toHaveBeenCalledWith('farmer-1');
  });

  it('leaves the choice to an officer, whose list holds many farmers', async () => {
    useAppStore.setState({ user: { id: 'u2', email: 'o@test.dev', role: 'extension_officer' } as never });
    fetchFarmers.mockResolvedValue({ success: true, data: { farmers: [{ id: 'farmer-1', firstName: 'Mary', lastName: 'Njeri' }] } });
    renderTab();
    const picker = await screen.findByRole('combobox', { name: /farmer/i });
    await screen.findByRole('option', { name: 'Mary Njeri' });
    expect(picker).toHaveValue('');
    expect(fetchFarmerSoilProfile).not.toHaveBeenCalled();
  });
});
