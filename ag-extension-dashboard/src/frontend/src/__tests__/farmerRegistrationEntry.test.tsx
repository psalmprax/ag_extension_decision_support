import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/api/client';
import { createFarmer } from '@/api/farmerService';
import { RegisterFarmerButton } from '@/components/portfolio/RegisterFarmerButton';
import { FarmerRegistrationForm } from '@/components/forms/FarmerRegistrationForm';
import { useAppStore, type User } from '@/store/useAppStore';

const demo = vi.hoisted(() => ({ isDemo: false }));
vi.mock('@/demo', () => ({ useDemoMode: () => ({ isDemo: demo.isDemo }) }));
vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/api/farmerService', () => ({ createFarmer: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const person = (role: User['role'], region?: string): User => ({
  id: `${role}-1`, firstName: 'Test', lastName: role, email: `${role}@example.test`, role, region,
});

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function fillRequiredFields(withCoordinates = false) {
  fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Grace' } });
  fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Chebet' } });
  fireEvent.change(screen.getByPlaceholderText('+ country code and number'), { target: { value: '+254712345678' } });
  fireEvent.change(screen.getByPlaceholderText('Village or ward'), { target: { value: 'Rongai' } });
  fireEvent.click(screen.getByRole('button', { name: /^Maize$/ }));
  fireEvent.change(screen.getByPlaceholderText('2.5'), { target: { value: '2.5' } });
  if (!withCoordinates) return;
  fireEvent.change(screen.getByPlaceholderText('-0.303099'), { target: { value: '-0.3' } });
  fireEvent.change(screen.getByPlaceholderText('36.080025'), { target: { value: '36.08' } });
}

describe('Register farmer entry point', () => {
  beforeEach(() => {
    demo.isDemo = false;
    useAppStore.setState({ activeTab: 'portfolio' });
  });

  it.each(['admin', 'regional_manager', 'extension_officer'] as const)(
    'opens farmer registration for %s',
    role => {
      useAppStore.setState({ user: person(role) });
      render(<RegisterFarmerButton />);
      fireEvent.click(screen.getByRole('button', { name: 'Register farmer' }));
      expect(useAppStore.getState().activeTab).toBe('register_farmer');
    }
  );

  it('is not offered to farmers or in the demo session', () => {
    useAppStore.setState({ user: person('farmer') });
    const { unmount } = render(<RegisterFarmerButton />);
    expect(screen.queryByRole('button', { name: 'Register farmer' })).not.toBeInTheDocument();
    unmount();

    demo.isDemo = true;
    useAppStore.setState({ user: person('extension_officer') });
    render(<RegisterFarmerButton />);
    expect(screen.queryByRole('button', { name: 'Register farmer' })).not.toBeInTheDocument();
  });
});

describe('FarmerRegistrationForm officer assignment', () => {
  beforeEach(() => {
    demo.isDemo = false;
    vi.mocked(createFarmer).mockReset();
    vi.mocked(createFarmer).mockResolvedValue({
      success: true,
      data: { id: 'f-1', firstName: 'Grace', lastName: 'Chebet', crops: ['Maize'], farmSize: 2.5 },
    } as Awaited<ReturnType<typeof createFarmer>>);
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [{ id: 'off-9', firstName: 'Peter', lastName: 'Mwangi', region: 'Rift Valley' }] },
    });
  });

  it('lets a regional manager pick an officer and registers the farmer in the manager\'s region', async () => {
    useAppStore.setState({ user: person('regional_manager', 'Rift Valley') });
    renderWithQuery(<FarmerRegistrationForm />);

    const select = await screen.findByLabelText('Assigned extension officer');
    await screen.findByRole('option', { name: /Peter Mwangi/ });
    expect(apiClient.get).toHaveBeenCalledWith('/users/role/extension_officer');
    fireEvent.change(select, { target: { value: 'off-9' } });
    fillRequiredFields(true);
    fireEvent.click(screen.getByRole('button', { name: /Save farmer/ }));

    await waitFor(() => expect(createFarmer).toHaveBeenCalledTimes(1));
    expect(createFarmer).toHaveBeenCalledWith(expect.objectContaining({
      region: 'Rift Valley', village: 'Rongai', assignedOfficerId: 'off-9', locationLat: -0.3, locationLng: 36.08,
    }));
  });

  it('registers without GPS coordinates and does not offer the officer picker to an officer', async () => {
    useAppStore.setState({ user: person('extension_officer', 'Rift Valley') });
    renderWithQuery(<FarmerRegistrationForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /Save farmer/ }));

    await waitFor(() => expect(createFarmer).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText('Assigned extension officer')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(vi.mocked(createFarmer).mock.calls[0][0]).not.toHaveProperty('vitalScore', expect.any(Number));
    expect(createFarmer).toHaveBeenCalledWith(expect.objectContaining({
      crops: ['Maize'],
      // An officer registers farmers in their own region; the typed location is the village.
      region: 'Rift Valley', village: 'Rongai', assignedOfficerId: undefined, locationLat: undefined, locationLng: undefined,
    }));
  });

  it('asks for a crop and the farm size instead of inventing them', async () => {
    useAppStore.setState({ user: person('extension_officer', 'Rift Valley') });
    renderWithQuery(<FarmerRegistrationForm />);
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Chebet' } });
    fireEvent.change(screen.getByPlaceholderText('+ country code and number'), { target: { value: '+254712345678' } });
    fireEvent.change(screen.getByPlaceholderText('Village or ward'), { target: { value: 'Rongai' } });
    fireEvent.click(screen.getByRole('button', { name: /Save farmer/ }));

    expect(await screen.findByText('Choose at least one crop')).toBeInTheDocument();
    expect(screen.getByText('Enter the farm size')).toBeInTheDocument();
    expect(createFarmer).not.toHaveBeenCalled();
  });
});
