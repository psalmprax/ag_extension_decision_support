jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notificationService', () => ({ notificationService: { send: jest.fn().mockResolvedValue(true) } }));

import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { digestMessage, localClock, sendOfficerDigests } from '@/services/alerts/officerDigest';

const mockQuery = query as jest.Mock;
const officer = { id: 'o1', country: 'Malawi', time_zone: null, visits_ahead: '3', overdue: '1', follow_ups: '0', alerts: '2' };

beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
});

describe('the officer’s morning digest', () => {
    it('names only what needs the officer', () => {
        expect(digestMessage(officer)).toBe('3 visits in the next 24 hours, 1 overdue visit, 2 new alerts about your farmers.');
        expect(digestMessage({ visits_ahead: 0, overdue: 0, follow_ups: 0, alerts: 0 })).toBeNull();
    });

    it('reads the clock in the officer’s time zone', () => {
        expect(localClock(new Date('2026-11-28T22:30:00Z'), 'Africa/Blantyre')).toEqual({ date: '2026-11-29', hour: 0 });
    });

    it('goes out at 06:00 local time, once that day', async () => {
        const sixInMalawi = new Date('2026-11-28T04:10:00Z');
        mockQuery.mockResolvedValueOnce({ rows: [officer] }).mockResolvedValueOnce({ rows: [] });
        await expect(sendOfficerDigests(sixInMalawi)).resolves.toBe(1);
        expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'o1', channel: 'in_app', metadata: { kind: 'morning_digest', date: '2026-11-28' },
        }));

        mockQuery.mockReset().mockResolvedValueOnce({ rows: [officer] }).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
        await expect(sendOfficerDigests(sixInMalawi)).resolves.toBe(0);

        mockQuery.mockReset().mockResolvedValueOnce({ rows: [officer] });
        await expect(sendOfficerDigests(new Date('2026-11-28T09:00:00Z'))).resolves.toBe(0);
    });
});
