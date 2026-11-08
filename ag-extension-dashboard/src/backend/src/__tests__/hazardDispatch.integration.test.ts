import { Client } from 'pg';
import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { runProactiveHazardScan } from '@/services/weatherHazardDaemonService';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notificationService', () => ({ notificationService: { send: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const databaseUrl = process.env.HAZARD_DISPATCH_TEST_DATABASE_URL;
const farmerOne = 'd3c86c40-8ad1-4146-87d1-a7e6a76c3757';
const farmerTwo = '8a69e4a4-767e-48b4-9a7a-f933cc937a3a';
const userOne = '0b285429-2dae-4de5-8e33-b0bd6108df09';
const userTwo = '1c6ad7d0-567b-48ce-8ef2-432c74ee00aa';

(databaseUrl ? describe : describe.skip)('Hazard recipient lookup with PostgreSQL', () => {
    let client: Client;
    beforeAll(async () => {
        client = new Client({ connectionString: databaseUrl });
        await client.connect();
        await client.query('CREATE TEMP TABLE farmers (id uuid PRIMARY KEY, user_id uuid, district text, region text)');
        await client.query(
            'INSERT INTO farmers (id, user_id, district) VALUES ($1, $2, $3), ($4, $5, $3)',
            [farmerOne, userOne, 'Nakuru', farmerTwo, userTwo]
        );
        jest.mocked(query).mockImplementation(async (sql, params) => {
            const result = await client.query(sql, params);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        });
    });
    afterAll(async () => { await client.end(); });
    beforeEach(() => jest.mocked(notificationService.send).mockClear());

    it('sends to selected farmers’ user IDs, and sends to nobody for an empty selection', async () => {
        const forecast = [{
            date: '2026-11-08', minTempC: 1, maxTempC: 15,
            precipitationMm: 0, relativeHumidityPct: 60, windSpeedKmh: 5,
        }];
        const selected = await runProactiveHazardScan({ county: 'Nakuru', forecast, farmerIds: [farmerOne] });
        expect(selected.dispatchedNotificationCount).toBe(1);
        expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ userId: userOne }));
        jest.mocked(notificationService.send).mockClear();
        const empty = await runProactiveHazardScan({ county: 'Nakuru', forecast, farmerIds: [] });
        expect(empty.dispatchedNotificationCount).toBe(0);
        expect(notificationService.send).not.toHaveBeenCalled();
    });
});
