import { assertConversationAccess, MessageAccessError } from '../services/messageAccessService';

jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { query } from '../services/databaseService';
const mockQuery = query as jest.Mock;

const CONVERSATION = '44444444-4444-4444-8444-444444444444';
const officerAiChatAboutFarmer = { farmer_id: 'farm-1', officer_id: 'off-1', region: 'Central', is_demo: false, kind: 'officer_ai' };
const farmerThread = { ...officerAiChatAboutFarmer, kind: 'farmer_thread' };

/** First query: the conversation row; second (farmers only): the farmer's own record. */
function conversationIs(row: Record<string, unknown>) {
    mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('FROM chat_conversations cv')) return Promise.resolve({ rows: [row], rowCount: 1 });
        if (sql.includes('FROM farmers')) return Promise.resolve({ rows: [{ id: 'farm-1' }], rowCount: 1 });
        return Promise.resolve({ rows: [], rowCount: 0 });
    });
}

describe('conversation access by kind', () => {
    beforeEach(() => mockQuery.mockReset());

    it("never lets a farmer open an officer's private AI chat about them", async () => {
        conversationIs(officerAiChatAboutFarmer);
        await expect(assertConversationAccess({ userId: 'farmer-user-1', role: 'farmer' }, CONVERSATION))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    it('lets the farmer open their own thread and reports its kind', async () => {
        conversationIs(farmerThread);
        await expect(assertConversationAccess({ userId: 'farmer-user-1', role: 'farmer' }, CONVERSATION))
            .resolves.toEqual({ kind: 'farmer_thread' });
    });

    it('opens a private AI chat for its owner and for admins only', async () => {
        conversationIs(officerAiChatAboutFarmer);
        await expect(assertConversationAccess({ userId: 'off-1', role: 'extension_officer' }, CONVERSATION))
            .resolves.toEqual({ kind: 'officer_ai' });
        await expect(assertConversationAccess({ userId: 'admin-1', role: 'admin' }, CONVERSATION))
            .resolves.toEqual({ kind: 'officer_ai' });
        await expect(assertConversationAccess({ userId: 'off-2', role: 'extension_officer' }, CONVERSATION))
            .rejects.toBeInstanceOf(MessageAccessError);
        await expect(assertConversationAccess({ userId: 'mgr-1', role: 'regional_manager', region: 'Central' }, CONVERSATION))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    it('treats rows from before the kind column as farmer threads', async () => {
        conversationIs({ farmer_id: 'farm-1', officer_id: 'off-1', region: 'Central', is_demo: false });
        await expect(assertConversationAccess({ userId: 'off-1', role: 'extension_officer' }, CONVERSATION))
            .resolves.toEqual({ kind: 'farmer_thread' });
    });
});
