import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/lib/LanguageContext';
import { Register } from '../pages/Register';
import * as authService from '@/api/authService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/api/client', () => ({
  default: { post: vi.fn() },
}));

vi.mock('@/api/authService', () => ({
  register: vi.fn(),
}));

vi.mock('@/components/canvas-ui/AgroEcosystemCanvasScrubber', () => ({
  AgroEcosystemCanvasScrubber: () => <div data-testid="agro-scrubber" />,
}));

const mockedRegister = authService.register as unknown as ReturnType<typeof vi.fn>;

// The provider renders once the (mocked) locale file has loaded.
const renderRegister = async () => {
  render(
    <MemoryRouter>
      <LanguageProvider>
        <Register />
      </LanguageProvider>
    </MemoryRouter>
  );
  await waitFor(() => expect(document.querySelector('form')).not.toBeNull());
};

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const select = (name: string) => document.querySelector(`select[name="${name}"]`) as HTMLSelectElement;

const fillRequiredFields = () => {
  fireEvent.change(field('firstName'), { target: { value: 'Amina' } });
  fireEvent.change(field('lastName'), { target: { value: 'Otieno' } });
  fireEvent.change(field('email'), { target: { value: 'amina@example.com' } });
  fireEvent.change(field('password'), { target: { value: 'Harvest2026' } });
  fireEvent.change(field('confirmPassword'), { target: { value: 'Harvest2026' } });
};

describe('Register form — signup fields and manager assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('offers only the self-registration roles', async () => {
    await renderRegister();

    const roles = Array.from(select('role').options).map(option => option.value);
    expect(roles).toEqual(['extension_officer', 'farmer']);
  });

  it('sends phone, country and region — and never the old phoneNumber key', async () => {
    mockedRegister.mockResolvedValueOnce({
      data: { token: 'jwt', user: { id: 'usr-1', email: 'amina@example.com' }, managerAssigned: true },
    });

    await renderRegister();
    fillRequiredFields();
    fireEvent.change(field('phone'), { target: { value: '+265991234567' } });
    fireEvent.change(select('country'), { target: { value: 'Malawi' } });
    fireEvent.change(select('region'), { target: { value: 'Central Region (Lilongwe)' } });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockedRegister).toHaveBeenCalledTimes(1));

    const payload = mockedRegister.mock.calls[0][0];
    expect(payload).toMatchObject({
      phone: '+265991234567',
      country: 'Malawi',
      region: 'Central Region (Lilongwe)',
      role: 'extension_officer',
    });
    expect(payload).not.toHaveProperty('phoneNumber');
    expect(payload).not.toHaveProperty('confirmPassword');
  });

  it('requires a region for extension officers but not for farmers', async () => {
    await renderRegister();

    expect((field('region') as unknown as HTMLSelectElement).required).toBe(true);

    fireEvent.change(select('role'), { target: { value: 'farmer' } });

    expect((field('region') as unknown as HTMLSelectElement).required).toBe(false);
  });

  it('clears the region when the country changes', async () => {
    await renderRegister();

    fireEvent.change(select('country'), { target: { value: 'Malawi' } });
    fireEvent.change(select('region'), { target: { value: 'Central Region (Lilongwe)' } });
    expect(select('region').value).toBe('Central Region (Lilongwe)');

    fireEvent.change(select('country'), { target: { value: 'Kenya' } });

    expect(select('region').value).toBe('');
  });

  it('explains the unassigned case instead of navigating into a managerless dashboard', async () => {
    mockedRegister.mockResolvedValueOnce({
      data: { token: 'jwt', user: { id: 'usr-1', email: 'amina@example.com' }, managerAssigned: false },
    });

    await renderRegister();
    fillRequiredFields();
    fireEvent.change(select('country'), { target: { value: 'Malawi' } });
    fireEvent.change(select('region'), { target: { value: 'Central Region (Lilongwe)' } });
    fireEvent.submit(document.querySelector('form')!);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('No regional manager covers Central Region (Lilongwe)');
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Continue to dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates straight to the dashboard once a manager is assigned', async () => {
    mockedRegister.mockResolvedValueOnce({
      data: { token: 'jwt', user: { id: 'usr-1', email: 'amina@example.com' }, managerAssigned: true },
    });

    await renderRegister();
    fillRequiredFields();
    fireEvent.change(select('country'), { target: { value: 'Malawi' } });
    fireEvent.change(select('region'), { target: { value: 'Central Region (Lilongwe)' } });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
