import { Client } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {
    REAL_WORLD_PASSWORD,
    REAL_WORLD_EMAIL_DOMAIN,
    REAL_WORLD_REGIONS,
    REAL_WORLD_TENANT_ID,
    REAL_WORLD_TENANT_NAME,
    allRealWorldAccounts,
    realWorldPlanFor,
    type RealWorldPlan,
} from '../src/seed/realWorldSeed';
import { hasLegacyFixtureIds, resetRealWorldFixtures } from '../src/seed/realWorldReset';

dotenv.config();

/**
 * Seeds real-world (non-demo) accounts: 2 regional managers, 1 extension officer
 * each, and 6 farmers per officer.
 *
 * Every account is created `email_verified = true`, `is_active = true`,
 * `is_demo = false` and shares `REAL_WORLD_PASSWORD`, so login works immediately
 * with no verification mail. The hash is derived here at seed time rather than
 * copy-pasted, so the credentials below are guaranteed to verify.
 *
 * Usage:
 *   npm run seed:realworld            # upsert the fixtures
 *   npm run seed:realworld -- --reset # delete these fixtures (and everything
 *                                     # recorded against them) first
 *
 * Managers, officers and the first three farmers per region are put on Pro,
 * the other farmers on Free (see realWorldPlanFor).
 *
 * Only rows on the reserved `@real.agriext.test` domain are ever touched;
 * demo seeds are left alone.
 */
async function main(): Promise<void> {
    const reset = process.argv.includes('--reset');
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set. Run this from the backend package so its .env is loaded.');
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
        // Real accounts belong to a tenant: the scoping routes resolve it before
        // filtering, so fixtures without one cannot list anything.
        await client.query(
            `INSERT INTO tenants (id, name, region, default_currency, default_language, capabilities, created_at, updated_at)
             VALUES ($1, $2, NULL, 'USD', 'en', '{}'::jsonb, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
            [REAL_WORLD_TENANT_ID, REAL_WORLD_TENANT_NAME]
        );

        const legacy = !reset && await hasLegacyFixtureIds(client);
        if (reset || legacy) {
            await resetRealWorldFixtures(client);
            console.log(legacy
                ? 'Replaced fixtures created with non-RFC ids (the API rejected them), and everything recorded against them.'
                : 'Removed the existing real-world fixtures and everything recorded against them.');
        }

        const passwordHash = await bcrypt.hash(REAL_WORLD_PASSWORD, 10);
        if (!bcrypt.compareSync(REAL_WORLD_PASSWORD, passwordHash)) {
            throw new Error('Generated password hash does not verify — refusing to seed unusable accounts.');
        }

        const upsertUser = async (
            account: { id: string; email: string; firstName: string; lastName: string; phone: string; region: string; country: string },
            role: 'regional_manager' | 'extension_officer' | 'farmer',
            managerId: string | null
        ): Promise<string> => {
            const result = await client.query<{ id: string }>(
                `INSERT INTO users (
                    id, email, password_hash, first_name, last_name, role, region, country,
                    phone, is_demo, manager_id, email_verified, is_active, tenant_id, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, true, true, $11, NOW(), NOW())
                 ON CONFLICT (email) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    role = EXCLUDED.role,
                    region = EXCLUDED.region,
                    country = EXCLUDED.country,
                    phone = EXCLUDED.phone,
                    is_demo = false,
                    manager_id = EXCLUDED.manager_id,
                    email_verified = true,
                    is_active = true,
                    tenant_id = EXCLUDED.tenant_id,
                    updated_at = NOW()
                 RETURNING id`,
                [
                    account.id, account.email, passwordHash, account.firstName, account.lastName,
                    role, account.region, account.country, account.phone, managerId,
                    REAL_WORLD_TENANT_ID,
                ]
            );
            const id = result.rows[0]?.id;
            if (!id) throw new Error(`User upsert returned no id for ${account.email}`);
            return id;
        };

        const ensurePlan = async (userId: string, email: string): Promise<void> => {
            // The login handler reads the plan from `subscriptions`; a missing row
            // is not fatal, so an absent plan is reported rather than invented.
            const planName: RealWorldPlan = realWorldPlanFor(email);
            const plan = await client.query<{ id: string }>(
                `SELECT id FROM subscription_plans WHERE LOWER(name) = LOWER($1) ORDER BY price ASC LIMIT 1`,
                [planName]
            );
            const planId = plan.rows[0]?.id;
            if (!planId) {
                console.warn(`  no ${planName} plan found; ${email} will log in without a plan row`);
                return;
            }
            // Fixtures are reset to their plan on every run, so a test that
            // changed a plan cannot leak into the next run.
            await client.query(
                `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
                 VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
                 ON CONFLICT (user_id) DO UPDATE SET
                    plan_id = EXCLUDED.plan_id,
                    status = 'active',
                    current_period_end = GREATEST(subscriptions.current_period_end, EXCLUDED.current_period_end),
                    updated_at = NOW()`,
                [userId, planId]
            );
        };

        for (const region of REAL_WORLD_REGIONS) {
            const managerId = await upsertUser(region.manager, 'regional_manager', null);
            await ensurePlan(managerId, region.manager.email);

            const officerId = await upsertUser(region.officer, 'extension_officer', managerId);
            await ensurePlan(officerId, region.officer.email);

            for (const seed of region.farmers) {
                const farmerUserId = await upsertUser(
                    {
                        id: seed.userId,
                        email: seed.email,
                        firstName: seed.firstName,
                        lastName: seed.lastName,
                        phone: seed.phone,
                        region: seed.region,
                        country: seed.country,
                    },
                    'farmer',
                    managerId
                );
                await ensurePlan(farmerUserId, seed.email);

                await client.query(
                    `INSERT INTO farmers (
                        id, user_id, assigned_officer_id, first_name, last_name, phone, village, district,
                        region, country, farm_size_hectares, crops, vital_score, soil_moisture, temperature,
                        ph_level, ai_confidence, language_preference, location_lat, location_lng, tenant_id,
                        is_demo, is_active, created_at
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, false, true, NOW())
                     ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        assigned_officer_id = EXCLUDED.assigned_officer_id,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        phone = EXCLUDED.phone,
                        village = EXCLUDED.village,
                        district = EXCLUDED.district,
                        region = EXCLUDED.region,
                        country = EXCLUDED.country,
                        farm_size_hectares = EXCLUDED.farm_size_hectares,
                        crops = EXCLUDED.crops,
                        vital_score = EXCLUDED.vital_score,
                        soil_moisture = EXCLUDED.soil_moisture,
                        temperature = EXCLUDED.temperature,
                        ph_level = EXCLUDED.ph_level,
                        ai_confidence = EXCLUDED.ai_confidence,
                        language_preference = EXCLUDED.language_preference,
                        location_lat = EXCLUDED.location_lat,
                        location_lng = EXCLUDED.location_lng,
                        tenant_id = EXCLUDED.tenant_id,
                        is_demo = false,
                        is_active = true`,
                    [
                        seed.id, farmerUserId, officerId, seed.firstName, seed.lastName, seed.phone,
                        seed.village, seed.district, seed.region, seed.country, seed.farmSizeHectares,
                        seed.crops, seed.vitalScore, seed.soilMoisture, seed.temperature, seed.phLevel,
                        seed.aiConfidence, seed.languagePreference, seed.locationLat, seed.locationLng,
                        REAL_WORLD_TENANT_ID,
                    ]
                );
            }

            const count = await client.query<{ total: string }>(
                `SELECT COUNT(*)::text AS total FROM farmers WHERE assigned_officer_id = $1`,
                [officerId]
            );
            console.log(`  ${region.manager.firstName} ${region.manager.lastName} (${region.manager.region}): ${count.rows[0]?.total ?? '0'} farmers`);
        }

        // Prove the credentials are usable before declaring success.
        const accounts = allRealWorldAccounts();
        const verification = await client.query<{ email: string; role: string; email_verified: boolean; is_active: boolean | null; is_demo: boolean }>(
            `SELECT email, role, email_verified, is_active, is_demo
               FROM users
              WHERE email LIKE $1
              ORDER BY role, email`,
            [`%${REAL_WORLD_EMAIL_DOMAIN}`]
        );
        const byEmail = new Map(verification.rows.map(row => [row.email, row]));
        for (const account of accounts) {
            const row = byEmail.get(account.email);
            if (!row) throw new Error(`Seeded account missing after upsert: ${account.email}`);
            if (row.role !== account.role || !row.email_verified || row.is_active === false || row.is_demo) {
                throw new Error(`Seeded account is not login-ready: ${account.email} (${row.role}, verified=${row.email_verified}, active=${row.is_active}, demo=${row.is_demo})`);
            }
        }

        console.log('\nReal-world seed complete. Log in with these credentials:\n');
        console.log('  password for every account: ' + REAL_WORLD_PASSWORD + '\n');
        for (const account of accounts) {
            console.log(`  ${account.role.padEnd(17)} ${account.email.padEnd(46)} ${realWorldPlanFor(account.email).padEnd(5)} ${account.firstName} ${account.lastName}`);
        }
        console.log(`\n  ${accounts.length} accounts, ${verification.rows.length} rows verify as active and email-verified.`);
    } finally {
        await client.end();
    }
}

main().catch((error: unknown) => {
    console.error('Real-world seed failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
