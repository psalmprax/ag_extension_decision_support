import { useCallback, useEffect, useRef } from 'react';
import { fetchSignupChallenge } from '@/api/authService';

/** The server accepts a token for an hour; fetch a fresh one well before that. */
const REFRESH_MS = 45 * 60 * 1000;
/** How long a submit waits for a token that is still being fetched before going without one. */
const FETCH_WAIT_MS = 3000;

interface ReadyToken {
  token: string;
  /** Local time after which the server counts the token as old enough (it measures from issue, earlier than this). */
  usableAt: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function loadToken(): Promise<ReadyToken | undefined> {
  // Started inside .then so even a synchronous throw ends in the catch, never in the page.
  return Promise.resolve()
    .then(() => fetchSignupChallenge())
    .then((challenge) => ({ token: challenge.token, usableAt: Date.now() + challenge.minFillMs }))
    .catch((error: unknown) => {
      console.warn('Sign-up form token could not be fetched; continuing without it:', error);
      return undefined;
    });
}

/**
 * Fetches the sign-up form token when the form opens (and every 45 minutes while it
 * stays open), and returns a function the submit calls to get it. The server rejects a
 * token used within a couple of seconds of being issued, so a person who fills the form
 * very fast (a password manager, autofill) is not turned away: the submit waits out the
 * remainder instead. Fetching is best-effort; without a token the sign-up still goes
 * through unless the server requires one.
 */
export function useSignupChallenge(): () => Promise<string | undefined> {
  const current = useRef<Promise<ReadyToken | undefined> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    current.current = loadToken();
    const timer = window.setInterval(() => {
      void loadToken().then((fresh) => {
        // Keep the old token until a new one has arrived.
        if (!cancelled && fresh) current.current = Promise.resolve(fresh);
      });
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return useCallback(async () => {
    const pending = current.current;
    if (!pending) return undefined;
    const ready = await Promise.race([pending, sleep(FETCH_WAIT_MS).then(() => undefined)]);
    if (!ready) return undefined;
    const wait = ready.usableAt - Date.now();
    if (wait > 0) await sleep(wait);
    return ready.token;
  }, []);
}
