import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import router from '@/routes/pillars/mechanization';
import { config } from '@/config';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { findAvailableEquipment, registerEquipment } from '@/services/mechanizationFleetService';

jest.mock('@/services/sessionService', () => ({ isSessionValid: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/dataGovernanceService', () => ({ getPrincipalTenantId: jest.fn() }));
jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('@/services/mechanizationFleetService', () => ({
    MECHANIZATION_ASSET_TYPES: ['tractor_75hp'],
    MECHANIZATION_RATE_UNITS: ['per_day'],
    findAvailableEquipment: jest.fn(),
    registerEquipment: jest.fn(),
    planDroneSprayMission: jest.fn(),
}));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const app = express();
app.use(express.json());
// The parent pillar router normally authenticates all requests.
import { authorize } from '@/middleware/authorize';
app.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));
app.use(router);

function token(role: string) {
    return jwt.sign({ userId: 'user-1', email: 'user@example.test', role }, config.jwt.secret, { algorithm: 'HS256' });
}

describe('mechanization tenant boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getPrincipalTenantId).mockResolvedValue('tenant-a');
        jest.mocked(findAvailableEquipment).mockResolvedValue({
            equipment: [], provenance: { kind: 'tenant_registry', note: '', assumptions: [], demoData: false },
        });
        jest.mocked(registerEquipment).mockResolvedValue({
            id: 'asset', assetType: 'tractor_75hp', modelName: 'Tractor', ownerName: 'Owner',
            ownerPhone: '+254700000000', county: 'Nakuru', subCounty: 'Njoro',
            ratePerUnitKes: 500, rateUnit: 'per_day', isAvailable: true, isVerified: false,
        });
    });

    it('uses the authenticated tenant and ignores a client-supplied tenant id', async () => {
        const response = await request(app).post('/mechanization/search')
            .set('Authorization', `Bearer ${token('farmer')}`)
            .send({ county: 'Nakuru', tenantId: 'tenant-b' });
        expect(response.status).toBe(200);
        expect(getPrincipalTenantId).toHaveBeenCalledWith('user-1');
        expect(findAvailableEquipment).toHaveBeenCalledWith('tenant-a', { county: 'Nakuru' });
    });

    it('denies users without a tenant and never queries the registry', async () => {
        jest.mocked(getPrincipalTenantId).mockResolvedValueOnce(null);
        const response = await request(app).post('/mechanization/search')
            .set('Authorization', `Bearer ${token('farmer')}`).send({ county: 'Nakuru' });
        expect(response.status).toBe(403);
        expect(findAvailableEquipment).not.toHaveBeenCalled();
    });

    it('surfaces tenant lookup failure instead of using unscoped access', async () => {
        jest.mocked(getPrincipalTenantId).mockRejectedValueOnce(new Error('database unavailable'));
        const response = await request(app).post('/mechanization/search')
            .set('Authorization', `Bearer ${token('farmer')}`).send({ county: 'Nakuru' });
        expect(response.status).toBe(500);
        expect(findAvailableEquipment).not.toHaveBeenCalled();
    });

    it('limits registration to an admin and derives the tenant server-side', async () => {
        const body = {
            assetType: 'tractor_75hp', modelName: 'Tractor', ownerName: 'Owner', ownerPhone: '+254700000000',
            county: 'Nakuru', subCounty: 'Njoro', ratePerUnitKes: 500, rateUnit: 'per_day', tenantId: 'tenant-b',
        };
        expect((await request(app).post('/mechanization/assets').set('Authorization', `Bearer ${token('farmer')}`).send(body)).status).toBe(403);
        expect(registerEquipment).not.toHaveBeenCalled();
        expect((await request(app).post('/mechanization/assets').set('Authorization', `Bearer ${token('admin')}`).send(body)).status).toBe(201);
        expect(registerEquipment).toHaveBeenCalledWith('tenant-a', expect.not.objectContaining({ tenantId: 'tenant-b' }));
    });
});
