import { readFileSync } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { query } from '@/services/databaseService';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { findAvailableEquipment, registerEquipment } from '@/services/mechanizationFleetService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const databaseUrl = process.env.MECHANIZATION_TENANT_TEST_DATABASE_URL;
const tenantA = '7d1dc7ed-38da-4896-ae60-bb9b9945d317';
const tenantB = '57ac6dd3-31dd-4827-bfab-500e9684b8da';
const userA = '0b285429-2dae-4de5-8e33-b0bd6108df09';
const userB = '1c6ad7d0-567b-48ce-8ef2-432c74ee00aa';

(databaseUrl ? describe : describe.skip)('mechanization tenant isolation with PostgreSQL', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
        await client.query(`
            CREATE TEMP TABLE tenants (id uuid PRIMARY KEY);
            CREATE TEMP TABLE users (id uuid PRIMARY KEY, tenant_id uuid, is_active boolean);
        `);
        const baseMigration = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261029120000_add_mechanization_assets/migration.sql'), 'utf8');
        await client.query(baseMigration.replace('CREATE TABLE "mechanization_assets"', 'CREATE TEMP TABLE "mechanization_assets"'));
        const tenantMigration = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261108110000_scope_mechanization_assets/migration.sql'), 'utf8');
        await client.query(tenantMigration);
        await client.query('INSERT INTO tenants (id) VALUES ($1), ($2)', [tenantA, tenantB]);
        await client.query('INSERT INTO users (id, tenant_id, is_active) VALUES ($1, $2, true), ($3, $4, true)', [userA, tenantA, userB, tenantB]);
        jest.mocked(query).mockImplementation(async (sql, params) => {
            const result = await client.query(sql, params);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        });
    });

    afterAll(async () => {
        await client.end();
    });

    it('isolates assets, excludes unassigned legacy records, and denies missing tenants', async () => {
        const input = {
            assetType: 'tractor_75hp' as const, modelName: 'Tractor', ownerName: 'Owner A',
            ownerPhone: '+254700000000', county: 'Nakuru', subCounty: 'Njoro',
            ratePerUnitKes: 500, rateUnit: 'per_day' as const,
        };
        await registerEquipment((await getPrincipalTenantId(userA))!, input);
        await registerEquipment((await getPrincipalTenantId(userB))!, { ...input, ownerName: 'Owner B' });
        await client.query(`
            INSERT INTO mechanization_assets
                (asset_type, model_name, owner_name, owner_phone, county, sub_county, rate_per_unit_kes, rate_unit)
            VALUES ('tractor_75hp', 'Old tractor', 'Legacy owner', '0000000', 'Nakuru', 'Njoro', 500, 'per_day')
        `);

        const first = await findAvailableEquipment(tenantA, { county: 'NAKURU' });
        const second = await findAvailableEquipment(tenantB, { county: 'Nakuru' });
        expect(first.equipment.map(asset => asset.ownerName)).toEqual(['Owner A']);
        expect(second.equipment.map(asset => asset.ownerName)).toEqual(['Owner B']);
        expect((await findAvailableEquipment(tenantA, { county: 'Nakuru', assetType: 'combine_harvester' })).equipment).toEqual([]);
        await expect(findAvailableEquipment('', { county: 'Nakuru' })).rejects.toThrow('Tenant is required');
        await expect(registerEquipment('', input)).rejects.toThrow('Tenant is required');

        await client.query('UPDATE users SET is_active = false WHERE id = $1', [userA]);
        expect(await getPrincipalTenantId(userA)).toBeNull();
    });
});
