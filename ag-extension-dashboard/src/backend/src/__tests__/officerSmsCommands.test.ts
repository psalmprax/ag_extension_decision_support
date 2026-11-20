jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/services/chat/advisoryAnswer', () => ({ generateAdvisoryAnswer: jest.fn().mockResolvedValue({ text: 'Check the whorls.' }) }));
jest.mock('@/services/usageService', () => ({
    usageService: { checkLimit: jest.fn().mockResolvedValue({ allowed: true }), incrementUsage: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/services/chat/threadPost', () => ({ postOfficerReply: jest.fn().mockResolvedValue({ id: 'm1' }) }));
jest.mock('@/services/sms/officerSmsData', () => ({
    farmerForRef: jest.fn(),
    findFarmers: jest.fn(),
    recordSmsVisit: jest.fn().mockResolvedValue('visit-1'),
    threadForFarmer: jest.fn().mockResolvedValue('conv-1'),
    unansweredThreads: jest.fn(),
}));
jest.mock('@/services/sms/officerSmsAccess', () => ({
    ...jest.requireActual('@/services/sms/officerSmsAccess'),
    tryPin: jest.fn(),
    lockSmsCommands: jest.fn(),
}));

import { officerCommandReply } from '@/services/sms/officerSmsCommands';
import { farmerForRef, findFarmers, recordSmsVisit, unansweredThreads } from '@/services/sms/officerSmsData';
import { tryPin, type SmsStaff } from '@/services/sms/officerSmsAccess';
import { postOfficerReply } from '@/services/chat/threadPost';
import { usageService } from '@/services/usageService';

const staff = (overrides: Partial<SmsStaff> = {}): SmsStaff => ({
    id: 'officer-1', role: 'extension_officer', first_name: 'Daniel', region: 'Rift Valley', tenant_id: 't1', language: null,
    sms_pin_hash: 'hash', sms_pin_failed_attempts: 0, sms_pin_locked: false,
    sms_unlocked_until: new Date(Date.now() + 3_600_000), ...overrides,
});
const mary = { id: 'farmer-1', name: 'Mary Njeri', tenant_id: 't1' };

beforeEach(() => jest.clearAllMocks());

describe('officer SMS commands need the PIN', () => {
    it('asks for the PIN when commands are not unlocked', async () => {
        await expect(officerCommandReply(staff({ sms_unlocked_until: null }), 'INBOX')).resolves.toMatch(/Send PIN/);
        expect(unansweredThreads).not.toHaveBeenCalled();
    });

    it.each([
        ['unlocked', /Unlocked for 24 hours/],
        ['wrong', /Wrong PIN/],
        ['locked', /locked/],
        ['no_pin', /Set your SMS PIN first/],
    ])('answers a PIN that is %s', async (outcome, reply) => {
        jest.mocked(tryPin).mockResolvedValueOnce(outcome as never);
        await expect(officerCommandReply(staff({ sms_unlocked_until: null }), 'PIN 4821')).resolves.toMatch(reply);
    });

    it('refuses everything while locked, even when unlocked earlier', async () => {
        await expect(officerCommandReply(staff({ sms_pin_locked: true }), 'INBOX')).resolves.toMatch(/locked/);
    });

    it('shows HELP without a PIN', async () => {
        await expect(officerCommandReply(staff({ sms_unlocked_until: null }), 'help')).resolves.toMatch(/INBOX/);
    });
});

describe('officer SMS commands once unlocked', () => {
    it('lists waiting messages with their numbers', async () => {
        jest.mocked(unansweredThreads).mockResolvedValueOnce([
            { ref: 12, farmerId: 'farmer-1', name: 'Mary Njeri', conversationId: 'conv-1', text: 'Majani   ya mahindi', hoursAgo: 2 },
        ]);
        await expect(officerCommandReply(staff(), 'inbox')).resolves.toBe('12 Mary Njeri (2h): Majani ya mahindi\nReply: R <number> <message>');
    });

    it('replies into the farmer thread', async () => {
        jest.mocked(farmerForRef).mockResolvedValueOnce(mary);
        await expect(officerCommandReply(staff(), 'R 12 I will visit on Tuesday')).resolves.toBe('Sent to Mary Njeri.');
        expect(postOfficerReply).toHaveBeenCalledWith('conv-1', 'I will visit on Tuesday');
    });

    it('will not reply to a number outside the officer list', async () => {
        jest.mocked(farmerForRef).mockResolvedValueOnce(null);
        await expect(officerCommandReply(staff(), 'R 99 hello')).resolves.toMatch(/No farmer 99/);
        expect(postOfficerReply).not.toHaveBeenCalled();
    });

    it('records a completed visit with the notes', async () => {
        jest.mocked(farmerForRef).mockResolvedValueOnce(mary);
        await expect(officerCommandReply(staff(), 'VISIT 12 done armyworm on 20% of plants')).resolves.toMatch(/recorded for today with your notes/);
        expect(recordSmsVisit).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', notes: 'armyworm on 20% of plants' }));
    });

    it('plans a visit on a date', async () => {
        jest.mocked(farmerForRef).mockResolvedValueOnce(mary);
        await expect(officerCommandReply(staff(), 'PLAN 12 2026-12-25 soil sampling')).resolves.toBe('Visit to Mary Njeri planned for 2026-12-25.');
        expect(recordSmsVisit).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled', notes: 'soil sampling' }));
    });

    it('asks for a date it can read', async () => {
        jest.mocked(farmerForRef).mockResolvedValueOnce(mary);
        await expect(officerCommandReply(staff(), 'PLAN 12 sometime')).resolves.toMatch(/Add a date/);
        expect(recordSmsVisit).not.toHaveBeenCalled();
    });

    it('needs a farmer number for R, VISIT and PLAN', async () => {
        await expect(officerCommandReply(staff(), 'VISIT Mary')).resolves.toMatch(/Add the farmer's number/);
    });

    it('finds farmers by name', async () => {
        jest.mocked(findFarmers).mockResolvedValueOnce([{ ref: 3, farmerId: 'f3', name: 'Joseph Kimani' }]);
        await expect(officerCommandReply(staff(), 'FIND Kimani')).resolves.toBe('3 Joseph Kimani');
    });

    it('answers ASK AI within the plan quota, and counts it', async () => {
        await expect(officerCommandReply(staff(), 'ASK AI: fall armyworm signs')).resolves.toBe('Check the whorls.');
        expect(usageService.incrementUsage).toHaveBeenCalledWith('officer-1', 'ai_chat');
    });

    it('does not answer ASK AI past the quota', async () => {
        jest.mocked(usageService.checkLimit).mockResolvedValueOnce({ allowed: false, current: 10, limit: 10 });
        await expect(officerCommandReply(staff(), 'ASK AI anything')).resolves.toMatch(/no AI answers left/);
    });
});
