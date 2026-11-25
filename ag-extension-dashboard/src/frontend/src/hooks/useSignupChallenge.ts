import { useEffect, useState } from 'react';
import { fetchSignupChallenge } from '@/api/authService';

/** The server accepts a token for an hour; fetch a fresh one well before that. */
const REFRESH_MS = 45 * 60 * 1000;

/**
 * Fetches the sign-up form token when the form opens, and again every 45 minutes
 * while it stays open. The token lets the server tell a person filling in the form
 * from a script posting it instantly. Fetching is best-effort: without a token the
 * sign-up still goes through unless the server requires one.
 */
export function useSignupChallenge(): string | undefined {
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let swap: number | undefined;
    const load = async (isRefresh: boolean) => {
      try {
        const challenge = await fetchSignupChallenge();
        if (cancelled) return;
        // A brand-new token is "too fast" for its first few seconds. On a refresh, keep
        // using the old one until the new one is old enough, so a submit at that moment
        // is not rejected.
        if (isRefresh) swap = window.setTimeout(() => setToken(challenge.token), challenge.minFillMs);
        else setToken(challenge.token);
      } catch (error) {
        console.warn('Sign-up form token could not be fetched; continuing without it:', error);
      }
    };
    void load(false);
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(swap);
    };
  }, []);

  return token;
}
