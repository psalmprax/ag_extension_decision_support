jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/smsService', () => ({ smsService: { sendSMS: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/services/whatsappService', () => ({
    whatsappService: { sendMessage: jest.fn().mockResolvedValue({ success: true }), sendTemplateMessage: jest.fn() },
}));
jest.mock('@/services/telegramService', () => ({ telegramService: { sendMessage: jest.fn().mockResolvedValue({ success: true }) } }));
jest.mock('@/services/realtimeHub', () => ({ getRealtimeServer: () => null }));
jest.mock('@/services/chat/voiceReply', () => ({ synthesizeVoiceReply: jest.fn().mockResolvedValue('data:audio/ogg;base64,AAAA') }));

import { query } from '@/services/databaseService';
import { smsService } from '@/services/smsService';
import { whatsappService } from '@/services/whatsappService';
import { telegramService } from '@/services/telegramService';
import {
    deliverToFarmerChannel,
    noticeOnChannel,
    parseAskAiCommand,
    recordChannelMessage,
    TELEGRAM_ASK_AI_KEYBOARD,
} from '@/services/chat/channelThread';
import { fitSms, toPlainText, SMS_MAX_CHARS } from '@/services/chat/plainText';

const mockQuery = query as jest.Mock;
const farmer = { farmer_id: 'farmer-1', phone: '+254712000111', notes: 'Auto-enrolled via Telegram [tg:987654]', tenant_id: null };

/** The farmer's latest message came from `channel` (as a voice note when `voiceNote`). */
function thread(channel: string | null, voiceNote = false) {
    mockQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT channel, is_voice, language FROM chat_messages')) {
            return Promise.resolve({ rows: [{ channel, is_voice: voiceNote, language: voiceNote ? 'sw' : null }] });
        }
        if (sql.includes('f.phone, f.notes')) return Promise.resolve({ rows: [farmer] });
        return Promise.resolve({ rows: [] });
    });
}

beforeEach(() => jest.clearAllMocks());

describe('the ASK AI code', () => {
    it.each([
        ['ASK AI maize leaves are yellow', 'maize leaves are yellow'],
        ['ask ai: what fertiliser', 'what fertiliser'],
        ['ask aircraft spraying rules', 'aircraft spraying rules'],
        ['ASKAI blight on tomatoes', 'blight on tomatoes'],
        ['ASK beans wilting', 'beans wilting'],
        ['/ask how to store maize', 'how to store maize'],
        ['ULIZA AI mahindi yana madoa', 'mahindi yana madoa'],
        ['ASK AI', ''],
    ])('reads "%s"', (text, question) => {
        expect(parseAskAiCommand(text)).toBe(question);
    });

    it.each(['Asking about prices', 'My maize is yellow', 'task done'])('ignores "%s"', text => {
        expect(parseAskAiCommand(text)).toBeNull();
    });
});

describe('plain text for channels', () => {
    it('drops markdown but keeps link addresses', () => {
        expect(toPlainText('## Steps\n- **Remove** infected leaves\n- See [the guide](https://example.org/g)'))
            .toBe('Steps\n- Remove infected leaves\n- See the guide (https://example.org/g)');
    });

    it('fits a long answer into three SMS parts, cut at a word', () => {
        const long = 'word '.repeat(200);
        const sms = fitSms(long);
        expect(sms.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
        expect(sms.endsWith('(more in the app or from your officer)')).toBe(true);
        expect(fitSms('Short answer.')).toBe('Short answer.');
    });
});

describe('replies go out on the channel the farmer used', () => {
    it('sends by SMS, short and plain, and marks the message', async () => {
        thread('sms');
        await expect(deliverToFarmerChannel('conv-1', 'msg-1', '**Apply** mulch')).resolves.toBe('sms');

        expect(smsService.sendSMS).toHaveBeenCalledWith({ to: '+254712000111', message: 'Apply mulch', farmerId: 'farmer-1' });
        expect(mockQuery).toHaveBeenCalledWith('UPDATE chat_messages SET channel = $2 WHERE id = $1', ['msg-1', 'sms']);
    });

    it('sends to Telegram with the Ask AI button when asked', async () => {
        thread('telegram');
        await deliverToFarmerChannel('conv-1', 'msg-1', 'Officer reply', { askAiButton: true });

        expect(telegramService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            chatId: '987654', text: 'Officer reply', parseMode: null, replyMarkup: TELEGRAM_ASK_AI_KEYBOARD,
        }));
    });

    it('sends nothing for a farmer who uses the app', async () => {
        thread(null);
        await expect(deliverToFarmerChannel('conv-1', 'msg-1', 'Officer reply')).resolves.toBeNull();
        expect(smsService.sendSMS).not.toHaveBeenCalled();
        expect(telegramService.sendMessage).not.toHaveBeenCalled();
        expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });

    it('does not mark the message when sending failed', async () => {
        thread('sms');
        (smsService.sendSMS as jest.Mock).mockResolvedValueOnce(false);
        await expect(deliverToFarmerChannel('conv-1', 'msg-1', 'Reply')).resolves.toBeNull();
        expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE chat_messages'), expect.anything());
    });

    it('speaks the reply on WhatsApp when the farmer sent a voice note', async () => {
        thread('whatsapp', true);
        await deliverToFarmerChannel('conv-1', 'msg-1', 'Remove the infected plants');

        expect(whatsappService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
            to: '+254712000111', message: 'Remove the infected plants', mediaUrl: 'data:audio/ogg;base64,AAAA', isVoiceNote: true,
        }));
    });

    it('uses the WhatsApp button template when it is set up, plain text otherwise', async () => {
        thread('whatsapp');
        (whatsappService.sendTemplateMessage as jest.Mock).mockResolvedValueOnce({ success: false });
        await noticeOnChannel('conv-1', 'whatsapp', 'Your officer will reply.', { askAiButton: true });

        expect(whatsappService.sendTemplateMessage).toHaveBeenCalledWith(expect.objectContaining({ templateName: 'ask_ai_prompt' }));
        expect(whatsappService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ message: 'Your officer will reply.' }));
    });
});

describe('recording a channel message', () => {
    it("stores it in the farmer's thread, marked with its channel", async () => {
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes("cv.kind = 'farmer_thread'")) return Promise.resolve({ rows: [{ id: 'conv-1' }] });
            if (sql.includes('INSERT INTO chat_messages')) return Promise.resolve({ rows: [{ id: 'm1' }] });
            return Promise.resolve({ rows: [] });
        });
        await expect(recordChannelMessage({ farmerId: 'farmer-1', channel: 'sms', content: 'Yellow leaves' })).resolves.toBe('conv-1');

        const insert = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO chat_messages'))!;
        expect(insert[1]).toEqual(['conv-1', 'user', 'Yellow leaves', null, 'sms', false]);
    });

    it('starts a thread with the assigned officer on first contact', async () => {
        mockQuery.mockImplementation((sql: string) => {
            if (sql.includes('INSERT INTO chat_conversations')) return Promise.resolve({ rows: [{ id: 'new-conv' }] });
            if (sql.includes('INSERT INTO chat_messages')) return Promise.resolve({ rows: [{ id: 'm1' }] });
            return Promise.resolve({ rows: [] });
        });
        await expect(recordChannelMessage({ farmerId: 'farmer-1', channel: 'telegram', content: 'Hello' })).resolves.toBe('new-conv');
        const create = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO chat_conversations'))!;
        expect(String(create[0])).toContain("f.assigned_officer_id");
        expect(String(create[0])).toContain("'farmer_thread'");
    });
});
