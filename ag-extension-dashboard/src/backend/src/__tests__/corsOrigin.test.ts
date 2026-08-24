import { isOriginAllowed } from '../utils/corsOrigin';

const PROD = { nodeEnv: 'production', allowedOrigins: ['https://app.gpexts.com'] };
const DEV = { nodeEnv: 'development', allowedOrigins: [] };

describe('corsOrigin policy', () => {
    it('allows same-origin/no-origin requests (curl, server-to-server)', () => {
        expect(isOriginAllowed(undefined, PROD)).toBe(true);
    });

    it('allows configured origins in production', () => {
        expect(isOriginAllowed('https://app.gpexts.com', PROD)).toBe(true);
    });

    it('allows any gpexts.com subdomain in production', () => {
        expect(isOriginAllowed('https://staging.dashboard.gpexts.com', PROD)).toBe(true);
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
