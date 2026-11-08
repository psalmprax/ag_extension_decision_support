import { onboardingEngine } from '../services/onboardingEngine';
import { withTransaction } from '../services/databaseService';
import type { PoolClient } from 'pg';

jest.mock('../services/databaseService', () => ({
    query: jest.fn(),
    withTransaction: jest.fn(),
}));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn() } }));

describe('onboarding webhook event idempotency', () => {
    const client = { query: jest.fn() };
    const session = {
        id: 'session-id',
        tenant_id: null,
        channel: 'telegram',
        external_identifier: '123',
        step: 'awaiting_crop',
        collected_data: { name: 'Amina' },
        created_farmer_id: null,
        created_at: null,
        updated_at: null,
    };
    let response: { response_message: string; farmer_id: string | null } | null;
    let sessionUpdates: number;

    const queryHandlers: Array<{
        matches: (sql: string) => boolean;
        respond: (params: unknown[]) => { rows: unknown[] };
    }> = [
        {
            matches: sql => sql.includes('INSERT INTO messaging_inbound_events'),
            respond: params => ({ rows: response ? [] : [{ event_id: params[2] }] }),
        },
        {
            matches: sql => sql.includes('SELECT response_message, farmer_id FROM messaging_inbound_events'),
            respond: () => ({ rows: response ? [response] : [] }),
        },
        {
            matches: sql => sql.includes('SELECT * FROM farmers'),
            respond: () => ({ rows: [] }),
        },
        {
            matches: sql => sql.includes('SELECT * FROM farmer_onboarding_sessions'),
            respond: () => ({ rows: [session] }),
        },
        {
            matches: sql => sql.includes('UPDATE farmer_onboarding_sessions'),
            respond: () => {
                sessionUpdates += 1;
                return { rows: [] };
            },
        },
        {
            matches: sql => sql.includes('UPDATE messaging_inbound_events'),
            respond: params => {
                response = { response_message: String(params[0]), farmer_id: null };
                return { rows: [] };
            },
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        response = null;
        sessionUpdates = 0;
        (withTransaction as jest.Mock).mockImplementation(callback => callback(client as unknown as PoolClient));
        client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            const handler = queryHandlers.find(candidate => candidate.matches(sql));
            return handler?.respond(params) ?? { rows: [] };
        });
    });

    it('replays the original reply without advancing onboarding again', async () => {
        const event = {
            channel: 'telegram' as const,
            identifier: '123',
            message: 'maize',
            eventId: 'update-1',
        };

        const first = await onboardingEngine.processIncomingMessage(event);
        const duplicate = await onboardingEngine.processIncomingMessage(event);

        expect(first.responseMessage).toBe('Noted: *maize* 🌱\n\n👉 In which *Region or County* is your farm located? (e.g. Nakuru, Uasin Gishu, Kiambu, Machakos, Meru)');
        expect(duplicate.responseMessage).toBe(first.responseMessage);
        expect(sessionUpdates).toBe(1);
        expect(client.query).toHaveBeenCalledTimes(8);
    });
});
