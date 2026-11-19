jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/onboardingEngine', () => ({ onboardingEngine: { findFarmerByIdentifier: jest.fn() } }));
jest.mock('@/services/chat/channelThread', () => {
    const actual = jest.requireActual('@/services/chat/channelThread');
    return {
        parseAskAiCommand: actual.parseAskAiCommand,
        recordChannelMessage: jest.fn().mockResolvedValue('conv-1'),
        farmerThreadFor: jest.fn().mockResolvedValue('conv-1'),
        noticeOnChannel: jest.fn().mockResolvedValue(undefined),
    };
});
jest.mock('@/services/chat/threadAutoReply', () => ({
    loadThreadForReply: jest.fn(),
    answerFarmerInThread: jest.fn().mockResolvedValue('answered'),
    respondIfUrgent: jest.fn().mockResolvedValue(undefined),
    aiAnswersAvailable: jest.fn().mockResolvedValue(true),
}));

import { query } from '@/services/databaseService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { farmerThreadFor, noticeOnChannel, recordChannelMessage } from '@/services/chat/channelThread';
import { aiAnswersAvailable, answerFarmerInThread, loadThreadForReply, respondIfUrgent } from '@/services/chat/threadAutoReply';
import { DEFAULT_TURN_TAKING } from '@/services/chat/turnTaking';
import {
    AI_NOT_ON_PLAN,
    ALREADY_ANSWERED,
    ASK_AI_USAGE,
    SMS_LIMIT_REACHED,
    handleRegisteredFarmerChannelMessage,
    takeRegisteredFarmerMessage,
} from '@/services/chat/channelInbound';

const mockQuery = query as jest.Mock;

const thread = (overrides: Record<string, unknown> = {}) => ({
    conversationId: 'conv-1', farmerId: 'farmer-1', settings: DEFAULT_TURN_TAKING,
    question: { content: 'Yellow leaves', language: null, at: new Date() },
    state: { lastFarmerMessageAt: new Date(), lastOfficerMessageAt: null, answeredSinceFarmer: false },
    aiAnsweredSinceFarmer: false,
    ...overrides,
});

/** The farmer's previous message was `hoursAgo` hours ago (null: this is their first). */
function previousMessage(hoursAgo: number | null) {
    mockQuery.mockResolvedValue({ rows: hoursAgo === null ? [] : [{ created_at: new Date(Date.now() - hoursAgo * 3_600_000) }] });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(aiAnswersAvailable).mockResolvedValue(true);
});

describe("a registered farmer's ordinary message", () => {
    it('goes into their thread, is checked for urgency and acknowledged with the Ask AI option', async () => {
        previousMessage(null);
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'telegram', text: 'Yellow leaves' });

        expect(recordChannelMessage).toHaveBeenCalledWith({ farmerId: 'farmer-1', channel: 'telegram', content: 'Yellow leaves', language: undefined });
        expect(respondIfUrgent).toHaveBeenCalledWith('conv-1');
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'telegram', expect.stringContaining('tap Ask AI'), { askAiButton: true });
        expect(answerFarmerInThread).not.toHaveBeenCalled();
    });

    it('is acknowledged by SMS only at the start of a conversation (SMS costs money)', async () => {
        previousMessage(3);
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'sms', text: 'More detail' });
        expect(noticeOnChannel).not.toHaveBeenCalled();

        previousMessage(13);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'sms', text: 'New problem' });
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'sms', expect.stringContaining('send ASK AI'), { askAiButton: true });
    });

    it("does not offer Ask AI when the officer's plan has no AI answers", async () => {
        previousMessage(null);
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        jest.mocked(aiAnswersAvailable).mockResolvedValue(false);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'whatsapp', text: 'Yellow leaves' });

        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'whatsapp', 'Thanks, your officer will reply.', { askAiButton: false });
    });

    it('gets no second notice after an urgent safety reply', async () => {
        previousMessage(null);
        jest.mocked(loadThreadForReply).mockResolvedValue(thread({ state: { answeredSinceFarmer: true } }) as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'sms', text: 'My child drank pesticide' });
        expect(noticeOnChannel).not.toHaveBeenCalled();
    });
});

describe('ASK AI from a channel', () => {
    it('records the question and has the AI answer it', async () => {
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'sms', text: 'ASK AI maize leaves yellow' });

        expect(recordChannelMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'maize leaves yellow', channel: 'sms' }));
        expect(answerFarmerInThread).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-1' }), 'farmer_request');
    });

    it('answers the latest question when only the button or code was sent', async () => {
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'telegram', text: 'ASK AI' });

        expect(recordChannelMessage).not.toHaveBeenCalled();
        expect(farmerThreadFor).toHaveBeenCalledWith('farmer-1');
        expect(answerFarmerInThread).toHaveBeenCalled();
    });

    it.each([
        ['no question yet', thread({ question: null }), ASK_AI_USAGE],
        ['already answered by the AI', thread({ aiAnsweredSinceFarmer: true }), ALREADY_ANSWERED],
    ])('explains when there is %s', async (_case, state, notice) => {
        jest.mocked(loadThreadForReply).mockResolvedValue(state as never);
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'whatsapp', text: 'ASK AI' });
        expect(answerFarmerInThread).not.toHaveBeenCalled();
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'whatsapp', notice);
    });

    it("tells the farmer when today's SMS answers are used up", async () => {
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        jest.mocked(answerFarmerInThread).mockResolvedValueOnce('sms_limit');
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'sms', text: 'ASK AI more help' });
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'sms', SMS_LIMIT_REACHED);
    });

    it("tells the farmer when the officer's plan has no AI answers", async () => {
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        jest.mocked(answerFarmerInThread).mockResolvedValueOnce('not_on_plan');
        await handleRegisteredFarmerChannelMessage({ farmerId: 'farmer-1', channel: 'telegram', text: 'ASK AI yellow leaves' });
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'telegram', AI_NOT_ON_PLAN);
    });
});

describe('taking a webhook message', () => {
    it('leaves people who are not registered to onboarding', async () => {
        jest.mocked(onboardingEngine.findFarmerByIdentifier).mockResolvedValueOnce(null);
        await expect(takeRegisteredFarmerMessage({ channel: 'sms', identifier: '+254700000001', text: 'hi' })).resolves.toBe(false);
    });

    it('handles a registered farmer in the background, once per provider event', async () => {
        jest.mocked(onboardingEngine.findFarmerByIdentifier).mockResolvedValue({ id: 'farmer-1' });
        jest.mocked(loadThreadForReply).mockResolvedValue(thread() as never);
        mockQuery.mockResolvedValueOnce({ rows: [{ event_id: 'evt-1' }] }).mockResolvedValue({ rows: [] });

        await expect(takeRegisteredFarmerMessage({ channel: 'sms', identifier: '+254712000111', text: 'Hello', eventId: 'evt-1' })).resolves.toBe(true);
        await new Promise(resolve => setImmediate(resolve));
        expect(recordChannelMessage).toHaveBeenCalledTimes(1);

        // The provider retries the same event: already claimed, nothing recorded again.
        mockQuery.mockResolvedValueOnce({ rows: [] });
        await expect(takeRegisteredFarmerMessage({ channel: 'sms', identifier: '+254712000111', text: 'Hello', eventId: 'evt-1' })).resolves.toBe(true);
        await new Promise(resolve => setImmediate(resolve));
        expect(recordChannelMessage).toHaveBeenCalledTimes(1);
    });
});
