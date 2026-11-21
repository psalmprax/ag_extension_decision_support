jest.mock('@/services/databaseService', () => ({ query: jest.fn(async () => ({ rows: [{ id: 'sched-1' }], rowCount: 1 })) }));
jest.mock('@/queues/scheduledSmsQueue', () => ({ addScheduledSmsJob: jest.fn(async () => undefined) }));

describe('messages over the SMS provider’s per-minute limit', () => {
    it('are queued for the next minute instead of dropped', async () => {
        process.env.SMS_PROVIDER_RATE_PER_MINUTE = '1';
        process.env.AFRICASTALKING_API_KEY = 'test-key';
        await jest.isolateModulesAsync(async () => {
            const { smsService } = await import('@/services/smsService');
            const { addScheduledSmsJob } = await import('@/queues/scheduledSmsQueue');
            const service = smsService as unknown as { sendViaAfricaTalking: () => Promise<boolean> };
            jest.spyOn(service, 'sendViaAfricaTalking').mockResolvedValue(true);

            expect(await smsService.deliver({ to: '+254712345678', message: 'first' })).toBe('sent');
            expect(await smsService.deliver({ to: '+254712345679', message: 'second' })).toBe('deferred');
            const [job, delay] = (addScheduledSmsJob as jest.Mock).mock.calls[0];
            expect(job).toMatchObject({ to: '+254712345679', message: 'second' });
            expect(delay).toBeGreaterThan(0);
            expect(delay).toBeLessThanOrEqual(65_000);
        });
        delete process.env.SMS_PROVIDER_RATE_PER_MINUTE;
        delete process.env.AFRICASTALKING_API_KEY;
    });
});
