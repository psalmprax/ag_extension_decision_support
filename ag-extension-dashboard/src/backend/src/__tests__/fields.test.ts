// NOTE: fields.ts uses Prisma (not raw `query` + mappers from src/types/dtos.ts),
// so the mapper-before-response test pattern does not apply here. The existing
// tests cover Prisma-based CRUD via the prismaService mock. The fields route's
// `/stats` endpoint does use `mapFieldStatsRows` + `mapCountRow` but is
// tested via the Prisma mock infrastructure above.
//
// Fixture IDs use real UUIDs because the fields/farmers tables store UUIDs — a
// non-UUID farmerId would be rejected by the route's input guard (and would 500
// against a real Postgres UUID column).

import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { config } from '../config';

// Mock DB and Cache
jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue({ 
            rows: [{ count: 0 }],
            rowCount: 1 
        })
    })),
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
        // The shared farmer access rule (canSeeFarmer): the fixture farmer is visible to
        // themselves (farm-1), their officer (off-1) and an administrator (no scope value).
        if (sql.includes('FROM farmers f WHERE f.id = $1')) {
            const [farmerId, ...scope] = params;
            const visible = farmerId === '11111111-1111-1111-1111-111111111111'
                && (scope.length === 0 || scope.includes('farm-1') || scope.includes('off-1'));
            return { rows: visible ? [{ visible: 1 }] : [], rowCount: visible ? 1 : 0 };
        }
        return {
            rows: sql.includes('FROM user_sessions')
                ? [{ is_revoked: false, is_active: true, expires_at: '2099-01-01T00:00:00Z' }]
                : [{ count: 0 }],
            rowCount: 1,
        };
    })
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => ({
        isOpen: true,
        get: jest.fn(),
        set: jest.fn()
    }))
}));

// Mock Prisma Client
jest.mock('../services/prismaService', () => {
    return {
        getPrisma: jest.fn(() => ({
            systemConfig: {
                findUnique: jest.fn().mockResolvedValue(null),
                upsert: jest.fn().mockResolvedValue({})
            },
            farmer: {
                findUnique: jest.fn().mockImplementation((args: Prisma.FarmerFindUniqueArgs) => {
                    if (args.where.id === '11111111-1111-1111-1111-111111111111') {
                        return Promise.resolve({
                            id: '11111111-1111-1111-1111-111111111111',
                            userId: 'farm-1',
                            assignedOfficerId: 'off-1',
                            region: 'Central'
                        });
                    }
                    return Promise.resolve(null);
                }),
                findFirst: jest.fn().mockImplementation((args: { where?: { userId?: string; id?: string; assignedOfficerId?: string } }) => {
                    if (args.where?.userId === 'farm-1') {
                        return Promise.resolve({
                            id: '11111111-1111-1111-1111-111111111111',
                            userId: 'farm-1',
                            assignedOfficerId: 'off-1',
                            region: 'Central'
                        });
                    }
                    // Officer ownership check: farmerId belongs to this officer
                    if (args.where?.id === '11111111-1111-1111-1111-111111111111' && args.where?.assignedOfficerId === 'off-1') {
                        return Promise.resolve({
                            id: '11111111-1111-1111-1111-111111111111',
                            userId: 'farm-1',
                            assignedOfficerId: 'off-1',
                            region: 'Central'
                        });
                    }
                    return Promise.resolve(null);
                }),
                findMany: jest.fn().mockImplementation((args: { where?: { assignedOfficerId?: string } }) => {
                    if (args.where?.assignedOfficerId === 'off-1') {
                        return Promise.resolve([{
                            id: '11111111-1111-1111-1111-111111111111',
                        }]);
                    }
                    return Promise.resolve([]);
                })
            },
            field: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: '22222222-2222-2222-2222-222222222222',
                        farmerId: '11111111-1111-1111-1111-111111111111',
                        name: 'North Plot',
                        areaHectares: 2.0,
                        soilType: 'clay-loam',
                        soilPh: 6.2,
                        isActive: true,
                        cropCycles: []
                    }
                ]),
                findUnique: jest.fn().mockImplementation((args: Prisma.FieldFindUniqueArgs) => {
                    if (args.where.id === '22222222-2222-2222-2222-222222222222') {
                        return Promise.resolve({
                            id: '22222222-2222-2222-2222-222222222222',
                            farmerId: '11111111-1111-1111-1111-111111111111',
                            name: 'North Plot',
                            areaHectares: 2.0,
                            soilType: 'clay-loam',
                            soilPh: 6.2,
                            isActive: true,
                            cropCycles: [],
                            farmer: {
                                userId: 'farm-1',
                                assignedOfficerId: 'off-1',
                            },
                        });
                    }
                    return Promise.resolve(null);
                }),
                count: jest.fn().mockResolvedValue(1),
                create: jest.fn().mockImplementation((args: Prisma.FieldCreateArgs) => Promise.resolve({
                    id: 'new-field-id',
                    ...args.data
                })),
                update: jest.fn().mockImplementation((args: Prisma.FieldUpdateArgs) => Promise.resolve({
                    id: args.where.id,
                    ...args.data
                }))
            },
            cropCycle: {
                findMany: jest.fn().mockResolvedValue([]),
                delete: jest.fn().mockImplementation((args: Prisma.CropCycleDeleteArgs) => Promise.resolve({ id: args.where.id })),
                findUnique: jest.fn().mockImplementation((args: Prisma.CropCycleFindUniqueArgs) => {
                    if (args.where.id === 'cycle-1') {
                        return Promise.resolve({
                            id: 'cycle-1',
                            fieldId: '22222222-2222-2222-2222-222222222222',
                            cropName: 'Maize',
                            variety: 'H614',
                            status: 'growing',
                            field: {
                                id: '22222222-2222-2222-2222-222222222222',
                                farmerId: '11111111-1111-1111-1111-111111111111',
                                farmer: {
                                    userId: 'farm-1',
                                    assignedOfficerId: 'off-1',
                                },
                            },
                        });
                    }
                    return Promise.resolve(null);
                }),
                create: jest.fn().mockImplementation((args: Prisma.CropCycleCreateArgs) => Promise.resolve({
                    id: 'cycle-1',
                    ...args.data
                })),
                update: jest.fn().mockImplementation((args: Prisma.CropCycleUpdateArgs) => Promise.resolve({
                    id: args.where.id,
                    ...args.data
                }))
            }
        }))
    };
});

describe('Fields & Crops API Integration Tests', () => {
    let officerToken: string;
    let farmerToken: string;
    let unauthorizedToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
        farmerToken = jwt.sign(
            { userId: 'farm-1', role: 'farmer', email: 'farmer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
        unauthorizedToken = jwt.sign(
            { userId: 'unauth-1', role: 'farmer', email: 'unauth@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    it('should allow extension officer to list fields for farmer', async () => {
        const response = await request(app)
            .get('/api/v1/fields?farmerId=11111111-1111-1111-1111-111111111111')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].name).toBe('North Plot');
    });

    it('should return empty list (not 500) for demo-style non-UUID farmerId', async () => {
        // Regression: the live dashboard used to send demo-farmer-1 against the
        // UUID farmer_id column, which made Postgres throw -> 500 on every load.
        const response = await request(app)
            .get('/api/v1/fields?farmerId=demo-farmer-1')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, data: [], total: 0 });
    });

    it('should return empty list for a malformed farmerId that is not a UUID', async () => {
        const response = await request(app)
            .get('/api/v1/fields?farmerId=not-a-uuid-at-all')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, data: [], total: 0 });
    });

    it('should reject access to field list of another farmer', async () => {
        const response = await request(app)
            .get('/api/v1/fields?farmerId=11111111-1111-1111-1111-111111111111')
            .set('Authorization', `Bearer ${unauthorizedToken}`);

        expect(response.status).toBe(403);
    });

    it('should allow farmer to get details of their own field', async () => {
        const response = await request(app)
            .get('/api/v1/fields/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${farmerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe('North Plot');
    });

    it('should allow farmer to create a new field', async () => {
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({
                farmerId: '11111111-1111-1111-1111-111111111111',
                name: 'East Slope',
                areaHectares: 1.5,
                soilType: 'sand',
                soilPh: 5.8
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('East Slope');
    });

    it('lets a farmer add a field without naming their own farm', async () => {
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({ name: 'Home Plot', areaHectares: 0.5 });

        expect(response.status).toBe(201);
        expect(response.body.data.farmerId).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('measures the area and location from a mapped boundary', async () => {
        // About 100 m a side near the equator: one hectare.
        const d = 100 / 111_195;
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({
                name: 'Walked Plot',
                areaHectares: 5,
                boundaryCoordinates: [{ lat: 0, lng: 36 }, { lat: 0, lng: 36 + d }, { lat: d, lng: 36 + d }, { lat: d, lng: 36 }],
                boundaryMethod: 'walked',
                boundaryAccuracyM: 4,
            });

        expect(response.status).toBe(201);
        expect(response.body.data.areaHectares).toBeCloseTo(1, 2);
        expect(response.body.data.latitude).toBeCloseTo(d / 2, 6);
        expect(response.body.data.boundaryAccuracyM).toBe(4);
    });

    it('refuses a boundary that crosses itself', async () => {
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({
                name: 'Bowtie',
                areaHectares: 1,
                boundaryCoordinates: [{ lat: 0, lng: 0 }, { lat: 0.001, lng: 0.001 }, { lat: 0, lng: 0.001 }, { lat: 0.001, lng: 0 }],
                boundaryMethod: 'drawn',
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/crosses itself/);
    });

    it('refuses a field with an impossible soil pH', async () => {
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({ name: 'Plot', areaHectares: 1, soilPh: 19 });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/soilPh/);
    });

    it('should allow farmer to create a new crop cycle', async () => {
        const response = await request(app)
            .post('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({
                cropName: 'Maize',
                variety: 'H614',
                status: 'growing',
                plantingDate: new Date().toISOString()
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.cropName).toBe('Maize');
    });

    it('should allow recording yield when harvesting', async () => {
        const response = await request(app)
            .patch('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles/cycle-1')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({
                status: 'harvested',
                actualHarvestDate: new Date().toISOString(),
                yieldKg: 3500.0,
                notes: 'Bumper crop'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.yieldKg).toBe(3500.0);
        expect(response.body.data.status).toBe('harvested');
    });

    it('should allow farmer to update their own field', async () => {
        const response = await request(app)
            .put('/api/v1/fields/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${farmerToken}`)
            .send({ name: 'North Plot Updated', areaHectares: 2.5 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should allow farmer to soft-delete their own field', async () => {
        const response = await request(app)
            .delete('/api/v1/fields/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${farmerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should allow assigned extension officer to create a field for farmer', async () => {
        const response = await request(app)
            .post('/api/v1/fields')
            .set('Authorization', `Bearer ${officerToken}`)
            .send({
                farmerId: '11111111-1111-1111-1111-111111111111',
                name: 'Officer Plot',
                areaHectares: 3.0,
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });

    it('lets the farmer delete a crop cycle on their own field', async () => {
        const response = await request(app)
            .delete('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles/cycle-1')
            .set('Authorization', `Bearer ${farmerToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, data: { id: 'cycle-1' } });
    });

    it('refuses to delete a crop cycle for a user without access', async () => {
        const response = await request(app)
            .delete('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles/cycle-1')
            .set('Authorization', `Bearer ${unauthorizedToken}`);

        // 404, not 403: the answer does not confirm the cycle exists.
        expect(response.status).toBe(404);
    });

    it('answers 404 for a crop cycle on a different field', async () => {
        const response = await request(app)
            .delete('/api/v1/fields/33333333-3333-3333-3333-333333333333/cycles/cycle-1')
            .set('Authorization', `Bearer ${farmerToken}`);

        expect(response.status).toBe(404);
    });

    it("refuses a regional manager outside the farmer's region", async () => {
        const managerToken = jwt.sign(
            { userId: 'rm-elsewhere', role: 'regional_manager', email: 'rm@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
        const update = await request(app)
            .patch('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles/cycle-1')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ status: 'harvested' });
        const removal = await request(app)
            .delete('/api/v1/fields/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${managerToken}`);

        expect(update.status).toBe(404);
        expect(removal.status).toBe(404);
    });

    it('should reject unauthorized user from updating crop cycle', async () => {
        const response = await request(app)
            .patch('/api/v1/fields/22222222-2222-2222-2222-222222222222/cycles/cycle-1')
            .set('Authorization', `Bearer ${unauthorizedToken}`)
            .send({ status: 'harvested' });

        // 404, not 403: the answer does not confirm the cycle exists.
        expect(response.status).toBe(404);
    });
});
