const mockQuery = jest.fn();
const mockPush = jest.fn().mockResolvedValue(undefined);
const mockCreate = jest.fn().mockResolvedValue({ id: 'n1' });

jest.mock('../services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('../services/pushNotificationService', () => ({ sendPushNotification: (...args: unknown[]) => mockPush(...args) }));
jest.mock('../queues/notificationQueue', () => ({ addNotificationJob: jest.fn() }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({ notification: { create: (...args: unknown[]) => mockCreate(...args) } })),
    Prisma: {},
}));

import { channelAllowed } from '../services/notificationPreferences';
import { notificationService } from '../services/notificationService';

const prefs = (p: object | null) => mockQuery.mockResolvedValueOnce({ rows: [{ notification_preferences: p }] });
const alert = (channel: 'in_app' | 'email' | 'sms') => ({ userId: 'u1', type: 'weather' as never, title: 'Frost tonight', message: 'Cover seedlings', channel });

describe('channelAllowed', () => {
    it('treats a missing preference as on', () => {
        expect(channelAllowed(null, 'email')).toBe(true);
        expect(channelAllowed({}, 'sms')).toBe(true);
        expect(channelAllowed({ emailAlerts: true }, 'email')).toBe(true);
    });
    it('honours a channel switched off', () => {
        expect(channelAllowed({ smsAlerts: false }, 'sms')).toBe(false);
        expect(channelAllowed({ smsAlerts: false }, 'email')).toBe(true);
    });
});

describe('notificationService.send respects Settings', () => {
    beforeEach(() => { mockQuery.mockReset(); mockPush.mockClear(); mockCreate.mockClear(); });

    it('keeps the in-app alert but sends no push when push is off', async () => {
        prefs({ pushNotifications: false });
        await expect(notificationService.send(alert('in_app'))).resolves.toBe(true);
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockPush).not.toHaveBeenCalled();
    });

    it('sends the push copy when push is on or unset', async () => {
        prefs(null);
        await notificationService.send(alert('in_app'));
        expect(mockPush).toHaveBeenCalledWith('u1', 'Frost tonight', 'Cover seedlings', '/');
    });

    it('skips email and SMS the user turned off, without reporting an error', async () => {
        prefs({ emailAlerts: false });
        await expect(notificationService.send(alert('email'))).resolves.toBe(true);
        prefs({ smsAlerts: false });
        await expect(notificationService.send(alert('sms'))).resolves.toBe(true);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('still delivers when preferences cannot be read', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db down'));
        await notificationService.send(alert('in_app'));
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockPush).toHaveBeenCalledTimes(1);
    });
});
