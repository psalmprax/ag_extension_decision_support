jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import bcrypt from 'bcryptjs';
import { verifyPassword } from '@/utils/password';
import { passwordProblems } from '@/utils/passwordPolicy';
import {
    REAL_WORLD_EMAIL_DOMAIN,
    REAL_WORLD_PASSWORD,
    REAL_WORLD_REGIONS,
    REAL_WORLD_TENANT_ID,
    allRealWorldAccounts,
    realWorldPlanFor,
} from '@/seed/realWorldSeed';

// RFC 9562 shape (version 1-8, variant 10xx): the API validates ids with zod's
// strict uuid(), so a fixture id like e4000000-0000-0000-0000-… was rejected by
// every route that takes a farmer or officer id (visits, outcomes, assignment).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('real-world seed accounts can log in', () => {
    const accounts = allRealWorldAccounts();

    it('uses a password the live policy accepts', () => {
        expect(passwordProblems(REAL_WORLD_PASSWORD)).toEqual([]);
    });

    it('verifies through the same path the login route uses', async () => {
        // Exactly what seed-realworld.ts writes, checked the way login.ts checks it.
        const hash = await bcrypt.hash(REAL_WORLD_PASSWORD, 10);

        await expect(verifyPassword(REAL_WORLD_PASSWORD, hash)).resolves.toBe(true);
        await expect(verifyPassword('wrong-password-1', hash)).resolves.toBe(false);
    });

    it('gives every account an email on the reserved domain, so no real inbox is hit', () => {
        expect(accounts.length).toBe(16);
        for (const account of accounts) {
            expect(account.email.endsWith(REAL_WORLD_EMAIL_DOMAIN)).toBe(true);
            expect(account.email).not.toContain('@agridemo.com');
        }
    });

    it('keeps emails and ids unique across all roles', () => {
        expect(new Set(accounts.map(a => a.email)).size).toBe(accounts.length);
        expect(new Set(accounts.map(a => a.id)).size).toBe(accounts.length);
        for (const account of accounts) {
            expect(account.id).toMatch(UUID_PATTERN);
        }
    });

    it('has one valid UUID per farmer record too', () => {
        for (const region of REAL_WORLD_REGIONS) {
            for (const farmer of region.farmers) {
                expect(farmer.id).toMatch(UUID_PATTERN);
                expect(farmer.userId).toMatch(UUID_PATTERN);
                expect(farmer.id).not.toBe(farmer.userId);
            }
        }
    });

    it('seeds exactly two regional managers, an officer each, and five to seven farmers each', () => {
        expect(accounts.filter(a => a.role === 'regional_manager')).toHaveLength(2);
        expect(accounts.filter(a => a.role === 'extension_officer')).toHaveLength(2);
        expect(accounts.filter(a => a.role === 'farmer')).toHaveLength(12);

        for (const region of REAL_WORLD_REGIONS) {
            expect(region.farmers.length).toBeGreaterThanOrEqual(5);
            expect(region.farmers.length).toBeLessThanOrEqual(7);
        }
    });

    it("keeps every farmer in the manager's own region and country", () => {
        for (const region of REAL_WORLD_REGIONS) {
            for (const farmer of region.farmers) {
                expect(farmer.region).toBe(region.manager.region);
                expect(farmer.country).toBe(region.manager.country);
            }
            expect(region.officer.region).toBe(region.manager.region);
            expect(region.officer.country).toBe(region.manager.country);
        }
    });

    it('uses the exact region strings from the signup country list', () => {
        // These must match src/frontend/src/lib/countries.ts so the resolver's
        // exact match (not its normalisation fallback) is what links the officer.
        const regions = REAL_WORLD_REGIONS.map(region => region.manager.region);
        expect(regions).toEqual(['Rift Valley', 'Northern Region (Mzuzu)']);
    });
});

describe('real-world seed plans and ids', () => {
    it('uses an RFC-valid tenant id', () => {
        expect(REAL_WORLD_TENANT_ID).toMatch(UUID_PATTERN);
    });

    it('puts staff and the first three farmers of each region on Pro, the rest on Free', () => {
        for (const region of REAL_WORLD_REGIONS) {
            expect(realWorldPlanFor(region.manager.email)).toBe('Pro');
            expect(realWorldPlanFor(region.officer.email)).toBe('Pro');
            expect(region.farmers.map(f => realWorldPlanFor(f.email)))
                .toEqual(['Pro', 'Pro', 'Pro', 'Free', 'Free', 'Free']);
        }
    });
});
