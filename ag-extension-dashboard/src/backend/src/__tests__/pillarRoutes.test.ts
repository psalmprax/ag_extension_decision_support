jest.mock('@/middleware/authorize', () => ({
    authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import router from '@/routes/pillars/index';
import { listRoutes } from '@/utils/routeInventory';

describe('pillar routes', () => {
    it('serves only the capabilities in real use, so no route answers "not implemented"', () => {
        expect(listRoutes(router, '').sort()).toEqual([
            'POST /hazard/evaluate',
            'POST /voice/synthesize',
            'POST /voice/transcribe',
            'POST /voice/transcribe-local',
        ]);
    });
});
