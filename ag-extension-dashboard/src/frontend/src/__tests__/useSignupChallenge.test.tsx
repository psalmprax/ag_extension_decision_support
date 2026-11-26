import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSignupChallenge } from '@/hooks/useSignupChallenge';
import { SignupHoneypot } from '@/components/auth/SignupHoneypot';
import * as authService from '@/api/authService';

vi.mock('@/api/authService', () => ({ fetchSignupChallenge: vi.fn() }));
const mockedFetch = authService.fetchSignupChallenge as unknown as ReturnType<typeof vi.fn>;

/** Submitting the probe asks the hook for a token and shows what came back, and when. */
function Probe({ onToken }: { onToken: (token: string | undefined, at: number) => void }) {
  const getFormToken = useSignupChallenge();
  return <button onClick={() => void getFormToken().then((t) => onToken(t, Date.now()))}>submit</button>;
}

describe('useSignupChallenge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hands the submit the token fetched when the form opened', async () => {
    mockedFetch.mockResolvedValueOnce({ token: 'v1.123.abc', minFillMs: 0 });
    const onToken = vi.fn();
    render(<Probe onToken={onToken} />);
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(onToken).toHaveBeenCalledWith('v1.123.abc', expect.any(Number)));
  });

  it('waits out the minimum fill time instead of letting the server reject a fast person', async () => {
    mockedFetch.mockResolvedValueOnce({ token: 'v1.1.abc', minFillMs: 300 });
    const onToken = vi.fn();
    render(<Probe onToken={onToken} />);
    const start = Date.now();
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(onToken).toHaveBeenCalled());
    expect(onToken.mock.calls[0][1] - start).toBeGreaterThanOrEqual(250);
  });

  it('lets the sign-up go ahead without a token when fetching it fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedFetch.mockRejectedValueOnce(new Error('offline'));
    const onToken = vi.fn();
    render(<Probe onToken={onToken} />);
    fireEvent.click(screen.getByText('submit'));
    await waitFor(() => expect(onToken).toHaveBeenCalledWith(undefined, expect.any(Number)));
    expect(warn).toHaveBeenCalled();
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
