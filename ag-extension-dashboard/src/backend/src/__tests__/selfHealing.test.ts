import { SelfHealingService } from '../services/selfHealing';

describe('SelfHealingService recovery requests', () => {
    it('rejects components outside the recovery allowlist', async () => {
        const service = new SelfHealingService();

        await expect(service.requestRecovery('shell')).resolves.toEqual({
            success: false,
            status: 'rejected',
            component: 'shell',
            details: 'Component is not eligible for manual recovery',
        });
    });

    it('does not claim recovery for an unregistered component', async () => {
        const service = new SelfHealingService();

        await expect(service.requestRecovery('database')).resolves.toEqual({
            success: false,
            status: 'not_found',
            component: 'database',
            details: 'Component is not registered with the self-healing service',
        });
    });
});
