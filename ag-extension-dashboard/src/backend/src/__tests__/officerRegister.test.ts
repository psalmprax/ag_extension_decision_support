jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notify/farmerNotices', () => ({
    noticeInBackground: (_label: string, work: () => Promise<unknown>) => { void work(); },
    sendFarmerNotice: jest.fn().mockResolvedValue('sent'),
}));
jest.mock('@/services/sms/officerSmsData', () => ({
    refsFor: jest.fn(async (_staffId: string, ids: string[]) => new Map(ids.map(id => [id, 7]))),
}));

import { query } from '@/services/databaseService';
import { parseReg, registerFarmerBySms, REG_USAGE } from '@/services/sms/officerRegister';
import type { SmsStaff } from '@/services/sms/officerSmsAccess';
import { sendFarmerNotice } from '@/services/notify/farmerNotices';

const mockQuery = query as jest.Mock;
const officer: SmsStaff = {
    id: 'officer-1', role: 'extension_officer', first_name: 'Daniel', region: 'Mzuzu', tenant_id: 't1', language: null,
    sms_pin_hash: 'hash', sms_pin_failed_attempts: 0, sms_pin_locked: false, sms_unlocked_until: new Date(Date.now() + 3_600_000),
    country: 'Malawi',
};

beforeEach(() => mockQuery.mockReset());

describe('REG reads the farmer from one SMS', () => {
    it('reads the number in the officer’s country, the name, crop and village', () => {
        expect(parseReg('0991234567 Chikondi Banda, Maize, Ekwendeni', 'Malawi')).toEqual({
            phone: '+265991234567', firstName: 'Chikondi', lastName: 'Banda', crop: 'maize', village: 'Ekwendeni',
        });
    });

    it('needs a valid number and a name', () => {
        expect(parseReg('Chikondi Banda', 'Malawi')).toBeNull();
        expect(parseReg('12 Chikondi', 'Malawi')).toBeNull();
    });
});

describe('registering a farmer by SMS', () => {
    it('creates the farmer for the officer and sends them a confirmation', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] }) // no farmer with this number
            .mockResolvedValueOnce({ rows: [{ id: 'farmer-9' }] }) // insert
            .mockResolvedValueOnce({ rows: [] }); // assignment history
        const reply = await registerFarmerBySms(officer, '0991234567 Chikondi Banda, maize, Ekwendeni');
        expect(reply).toMatch(/^Registered 7 Chikondi Banda\./);
        const insert = mockQuery.mock.calls[1];
        expect(insert[0]).toContain('INSERT INTO farmers');
        expect(insert[1]).toEqual(['Chikondi', 'Banda', '+265991234567', 'Mzuzu', 'Ekwendeni', ['maize'], 't1', 'officer-1', 'Malawi']);
        expect(sendFarmerNotice).toHaveBeenCalledWith('farmer-9', 'registered', { officer: 'Daniel' });
    });

    it('does not reveal or take over a farmer registered with another officer', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'f2', name: 'Someone Else', assigned_officer_id: 'officer-2', region: 'Mzuzu' }] });
        const reply = await registerFarmerBySms(officer, '0991234567 Chikondi Banda');
        expect(reply).toMatch(/already registered with another officer/);
        expect(reply).not.toContain('Someone Else');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('explains the format when the message cannot be read', async () => {
        await expect(registerFarmerBySms(officer, 'Chikondi')).resolves.toBe(REG_USAGE);
    });
});
