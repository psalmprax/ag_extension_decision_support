import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSignupChallenge } from '@/hooks/useSignupChallenge';
import { SignupHoneypot } from '@/components/auth/SignupHoneypot';
import * as authService from '@/api/authService';

vi.mock('@/api/authService', () => ({ fetchSignupChallenge: vi.fn() }));
const mockedFetch = authService.fetchSignupChallenge as unknown as ReturnType<typeof vi.fn>;

function Probe() {
  const token = useSignupChallenge();
  return <span data-testid="token">{token ?? 'none'}</span>;
}

describe('useSignupChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the sign-up form token when the form opens', async () => {
    mockedFetch.mockResolvedValueOnce({ token: 'v1.123.abc', minFillMs: 2500 });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('v1.123.abc'));
  });

  it('leaves the form usable when the token cannot be fetched', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedFetch.mockRejectedValueOnce(new Error('offline'));
    render(<Probe />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByTestId('token')).toHaveTextContent('none');
    warn.mockRestore();
  });
});

describe('SignupHoneypot', () => {
  it('is out of the tab order and hidden from assistive technology', () => {
    const { container } = render(<SignupHoneypot />);
    const input = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(input.tabIndex).toBe(-1);
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.change(input, { target: { value: 'spam' } });
    expect(input.value).toBe('spam');
  });
});
