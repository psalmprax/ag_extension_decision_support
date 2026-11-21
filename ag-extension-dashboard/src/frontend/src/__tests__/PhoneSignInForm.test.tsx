import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/api/authService', () => ({
  requestPhoneCode: vi.fn().mockResolvedValue({ success: true, data: { message: 'If this number is registered, a code is on its way.' } }),
  verifyPhoneCode: vi.fn(),
}));

import { PhoneSignInForm } from '@/components/auth/PhoneSignInForm';
import { requestPhoneCode, verifyPhoneCode } from '@/api/authService';

describe('PhoneSignInForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a code, then signs in with it', async () => {
    const onSignedIn = vi.fn();
    vi.mocked(verifyPhoneCode).mockResolvedValue({ success: true, data: { token: 't', user: { id: 'u1' } } } as never);
    render(<PhoneSignInForm onSignedIn={onSignedIn} onUseEmail={() => {}} />);

    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+254711000302' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('If this number is registered, a code is on its way.');
    expect(requestPhoneCode).toHaveBeenCalledWith('+254711000302', expect.any(String));
    expect(screen.getByRole('button', { name: /New code in 30s/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Code from the SMS'), { target: { value: '12 34 56' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(verifyPhoneCode).toHaveBeenCalledWith('+254711000302', '123456', expect.any(String));
  });

  it('reads a local number in the country the person picks', async () => {
    vi.mocked(requestPhoneCode).mockResolvedValue({ success: true, data: { message: 'Sent' } });
    render(<PhoneSignInForm onSignedIn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Nigeria' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0803 123 4567' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));
    await waitFor(() => expect(requestPhoneCode).toHaveBeenCalledWith('0803 123 4567', 'Nigeria'));
  });

  it('sends two-step accounts back to email sign-in', async () => {
    vi.mocked(verifyPhoneCode).mockResolvedValue({ success: true, data: { mfaRequired: true } } as never);
    const onSignedIn = vi.fn();
    render(<PhoneSignInForm onSignedIn={onSignedIn} onUseEmail={() => {}} />);
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+254711000201' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Code from the SMS'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('two-step sign-in');
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
