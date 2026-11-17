jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/notificationService', () => ({ notificationService: { send: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/services/chat/advisoryAnswer', () => ({
    generateAdvisoryAnswer: jest.fn().mockResolvedValue({ text: 'answer', storedMessageId: 'msg-ai' }),
    persistTurnMessage: jest.fn().mockResolvedValue({ id: 'msg-safety' }),
}));
jest.mock('@/services/leaderElection', () => ({ runIfLeader: jest.fn() }));
jest.mock('@/services/chat/channelThread', () => ({
    replyChannelFor: jest.fn().mockResolvedValue(null),
    deliverToFarmerChannel: jest.fn().mockResolvedValue(null),
    smsAiAnswersToday: jest.fn().mockResolvedValue(0),
}));

import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { generateAdvisoryAnswer, persistTurnMessage } from '@/services/chat/advisoryAnswer';
import { deliverToFarmerChannel, replyChannelFor, smsAiAnswersToday } from '@/services/chat/channelThread';
import { answerFarmerInThread, toThreadForReply } from '@/services/chat/threadAutoReply';
import { runTurnTakingTick } from '@/workers/turnTakingWorker';

const mockQuery = query as jest.Mock;
const send = notificationService.send as jest.Mock;

// Tuesday 10:00 in Nairobi.
const NOW = new Date('2026-11-17T07:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: 'conv-1', farmer_id: 'farmer-1', officer_id: 'officer-1', farmer_user_id: 'farmer-user-1',
        first_name: 'Amina', last_name: 'Wanjiru', capabilities: null,
        question: 'My maize leaves are yellow', question_language: 'en', question_at: ago(45),
        last_officer_at: null, answered_since_farmer: false, ai_answered_since_farmer: false,
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('answering a farmer in their thread', () => {
    it('answers with the AI, says so, and tells the officer when they were unavailable', async () => {
        await answerFarmerInThread(toThreadForReply(row()), 'officer_unavailable');

        expect(generateAdvisoryAnswer).toHaveBeenCalledWith(expect.objectContaining({
            message: 'My maize leaves are yellow',
            storeIn: 'conv-1',
            contextConversationId: 'conv-1',
            trustedHistory: true,
            footer: expect.stringContaining('has been notified'),
        }));
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'officer-1', title: 'The AI answered Amina Wanjiru' }));
    });

    it("does not notify the officer when the farmer pressed Ask AI", async () => {
        await answerFarmerInThread(toThreadForReply(row()), 'farmer_request');
        expect(generateAdvisoryAnswer).toHaveBeenCalledWith(expect.objectContaining({ footer: expect.stringContaining('Your extension officer can see it') }));
        expect(send).not.toHaveBeenCalled();
    });

    it('sends fixed safety steps, never a generated answer, for an urgent message', async () => {
        await answerFarmerInThread(toThreadForReply(row({ question: 'My child drank pesticide' })), 'farmer_request');

        expect(generateAdvisoryAnswer).not.toHaveBeenCalled();
        expect(persistTurnMessage).toHaveBeenCalledWith('conv-1', 'assistant', expect.stringContaining('nearest health facility'), 'en');
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'officer-1', type: 'error', title: expect.stringMatching(/^Urgent/) }));
    });
});

describe('answers on SMS, WhatsApp and Telegram', () => {
    it('sends the answer back on the channel the farmer wrote from, kept short for SMS', async () => {
        jest.mocked(replyChannelFor).mockResolvedValueOnce('sms');
        await expect(answerFarmerInThread(toThreadForReply(row()), 'farmer_request')).resolves.toBe('answered');

        expect(generateAdvisoryAnswer).toHaveBeenCalledWith(expect.objectContaining({ brevity: 'sms', footer: '(AI answer; your officer will see it.)' }));
        expect(deliverToFarmerChannel).toHaveBeenCalledWith('conv-1', 'msg-ai', 'answer');
    });

    it("stops at the organisation's SMS limit and sends nothing", async () => {
        jest.mocked(replyChannelFor).mockResolvedValueOnce('sms');
        jest.mocked(smsAiAnswersToday).mockResolvedValueOnce(10);
        await expect(answerFarmerInThread(toThreadForReply(row()), 'officer_unavailable')).resolves.toBe('sms_limit');

        expect(generateAdvisoryAnswer).not.toHaveBeenCalled();
        expect(deliverToFarmerChannel).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it('has no SMS limit on WhatsApp or Telegram', async () => {
        jest.mocked(replyChannelFor).mockResolvedValueOnce('telegram');
        jest.mocked(smsAiAnswersToday).mockResolvedValueOnce(99);
        await expect(answerFarmerInThread(toThreadForReply(row()), 'farmer_request')).resolves.toBe('answered');
        expect(generateAdvisoryAnswer).toHaveBeenCalledWith(expect.objectContaining({ brevity: undefined }));
    });

    it('delivers the urgent safety message on the channel too', async () => {
        await answerFarmerInThread(toThreadForReply(row({ question: 'My child drank pesticide' })), 'farmer_request');
        expect(deliverToFarmerChannel).toHaveBeenCalledWith('conv-1', 'msg-safety', expect.stringContaining('nearest health facility'));
    });
});

describe('turn-taking job', () => {
    it('answers only the threads whose wait is over', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [
            row({ id: 'waited', question_at: ago(45) }),
            row({ id: 'just-asked', question_at: ago(5) }),
            row({ id: 'officer-active', question_at: ago(40), last_officer_at: ago(50) }),
        ] });

        await expect(runTurnTakingTick(NOW)).resolves.toBe(1);
        expect(generateAdvisoryAnswer).toHaveBeenCalledTimes(1);
        expect(generateAdvisoryAnswer).toHaveBeenCalledWith(expect.objectContaining({ storeIn: 'waited' }));
    });

    it('sends safety steps for an urgent message at once, without waiting', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [row({ id: 'urgent', question: 'He collapsed after spraying', question_at: ago(1) })] });
        await expect(runTurnTakingTick(NOW)).resolves.toBe(1);
        expect(persistTurnMessage).toHaveBeenCalledWith('urgent', 'assistant', expect.any(String), 'en');
    });

    it('keeps going when one thread fails', async () => {
        (generateAdvisoryAnswer as jest.Mock).mockRejectedValueOnce(new Error('provider down'));
        mockQuery.mockResolvedValueOnce({ rows: [row({ id: 'fails' }), row({ id: 'works' })] });

        await expect(runTurnTakingTick(NOW)).resolves.toBe(1);
        expect(generateAdvisoryAnswer).toHaveBeenCalledTimes(2);
    });

    it('answers at most 10 threads per run', async () => {
        mockQuery.mockResolvedValueOnce({ rows: Array.from({ length: 15 }, (_, i) => row({ id: `conv-${i}` })) });
        await expect(runTurnTakingTick(NOW)).resolves.toBe(10);
    });
});
