jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/smsService', () => ({ smsService: { sendSMS: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/services/chat/channelThread', () => ({ noticeOnChannel: jest.fn(), replyChannelFor: jest.fn() }));

import { query } from '@/services/databaseService';
import { smsService } from '@/services/smsService';
import { noticeOnChannel, replyChannelFor } from '@/services/chat/channelThread';
import { notifyVisitChange, sendFarmerNotice, visitDateText } from '@/services/notify/farmerNotices';
import { noticeText } from '@/services/notify/noticeCopy';
import { optCommand } from '@/services/notify/optOut';

const mockQuery = query as jest.Mock;
const farmer = (overrides: Record<string, unknown> = {}) => ({
    id: 'f1', phone: '+265991234567', language_preference: 'en', sms_opt_out: false, country: 'Malawi', thread_id: null, ...overrides,
});

beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
});

describe('notices to farmers', () => {
    it('are sent by SMS to the number on record', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [farmer()] });
        await expect(sendFarmerNotice('f1', 'registered', { officer: 'Daniel' })).resolves.toBe('sent');
        expect(smsService.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
            to: '+265991234567', farmerId: 'f1', message: expect.stringContaining('You are registered with Daniel'),
        }));
    });

    it('go on WhatsApp when that is where the farmer last wrote from', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [farmer({ thread_id: 'conv-1' })] });
        (replyChannelFor as jest.Mock).mockResolvedValueOnce('whatsapp');
        await sendFarmerNotice('f1', 'visit_planned', { officer: 'Daniel', date: 'Tue 25 Nov' });
        expect(noticeOnChannel).toHaveBeenCalledWith('conv-1', 'whatsapp', expect.stringContaining('Tue 25 Nov'));
        expect(smsService.sendSMS).not.toHaveBeenCalled();
    });

    it('are not sent to a farmer who sent STOP, except the STOP confirmation itself', async () => {
        mockQuery.mockResolvedValue({ rows: [farmer({ sms_opt_out: true })] });
        await expect(sendFarmerNotice('f1', 'visit_planned', {})).resolves.toBe('opted_out');
        expect(smsService.sendSMS).not.toHaveBeenCalled();
        await expect(sendFarmerNotice('f1', 'stopped', {}, { always: true })).resolves.toBe('sent');
    });

    it('are written in the farmer’s language', () => {
        expect(noticeText('started', 'sw')).toBe('Taarifa zimewashwa tena. Tuma STOP kuzisitisha.');
        expect(noticeText('started', 'fr-FR')).toMatch(/^Les avis/);
    });

    it('give the visit day in the farmer’s time zone', () => {
        // 23:30 UTC on 24 Nov is already 25 Nov in Malawi (UTC+2).
        expect(visitDateText(new Date('2026-11-24T23:30:00Z'), 'en', 'Malawi')).toBe('Wed, 25 Nov');
    });

    it('say nothing about a visit that is already past', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ farmer_id: 'f1', scheduled_at: new Date('2020-01-01'), officer: 'Daniel', language_preference: 'en', country: 'Malawi' }] });
        await expect(notifyVisitChange('v1', 'planned')).resolves.toBe('no_contact');
        expect(smsService.sendSMS).not.toHaveBeenCalled();
    });
});

describe('STOP and START', () => {
    it('count only when they are the whole message', () => {
        expect(optCommand('stop')).toBe('stop');
        expect(optCommand(' ACHA. ')).toBe('stop');
        expect(optCommand('Start')).toBe('start');
        expect(optCommand('stop the spray today?')).toBeNull();
    });
});
