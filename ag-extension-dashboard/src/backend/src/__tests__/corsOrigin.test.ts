import { isOriginAllowed } from '../utils/corsOrigin';

const PROD = { nodeEnv: 'production', allowedOrigins: ['https://app.gpexts.com'] };
// Opt-in wildcard suffix form: `*.gpexts.com` grants credentialed CORS to
// subdomains deliberately; an exact origin list no longer implies it.
const PROD_WILDCARD = { nodeEnv: 'production', allowedOrigins: ['https://app.gpexts.com', '*.gpexts.com'] };
const DEV = { nodeEnv: 'development', allowedOrigins: [] };

describe('corsOrigin policy', () => {
    it('allows same-origin/no-origin requests (curl, server-to-server)', () => {
        expect(isOriginAllowed(undefined, PROD)).toBe(true);
    });

    it('allows configured origins in production', () => {
        expect(isOriginAllowed('https://app.gpexts.com', PROD)).toBe(true);
    });

    it('blocks unlisted subdomains when no wildcard suffix is configured', () => {
        // The previous blanket *.gpexts.com trust meant a subdomain takeover or
        // a compromised sibling granted credentialed API access. Subdomain
        // trust is now opt-in via an explicit `*.gpexts.com` entry.
        expect(isOriginAllowed('https://staging.dashboard.gpexts.com', PROD)).toBe(false);
    });

    it('allows subdomains when the *.suffix wildcard is explicitly configured', () => {
        expect(isOriginAllowed('https://staging.dashboard.gpexts.com', PROD_WILDCARD)).toBe(true);
    });

    it('wildcard suffix requires https', () => {
        expect(isOriginAllowed('http://staging.gpexts.com', PROD_WILDCARD)).toBe(false);
    });

    it('wildcard suffix does not match lookalike domains', () => {
        expect(isOriginAllowed('https://evilsite.com?q=gpexts.com', PROD_WILDCARD)).toBe(false);
        expect(isOriginAllowed('https://gpexts.com.evil.io', PROD_WILDCARD)).toBe(false);
        // The apex itself is not a subdomain of itself.
        expect(isOriginAllowed('https://gpexts.com', PROD_WILDCARD)).toBe(false);
    });

    it('blocks localhost origins in production', () => {
        expect(isOriginAllowed('http://localhost:5173', PROD)).toBe(false);
        expect(isOriginAllowed('http://127.0.0.1:3000', PROD)).toBe(false);
    });

    it('blocks unknown origins in production', () => {
        expect(isOriginAllowed('https://evil.example.com', PROD)).toBe(false);
    });

    it('allows all origins outside production (dev/staging convenience)', () => {
        expect(isOriginAllowed('http://localhost:5173', DEV)).toBe(true);
        expect(isOriginAllowed('https://evil.example.com', DEV)).toBe(true);
    });
});
