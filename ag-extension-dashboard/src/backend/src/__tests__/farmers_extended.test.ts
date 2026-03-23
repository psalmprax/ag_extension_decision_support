import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getPrisma } from '../services/prismaService';

// We won't mock Prisma here to test the actual data flow if possible, 
// but since the original test mocked it, I'll follow that pattern for consistency 
// but with the NEW fields.

jest.mock('../services/databaseService', () => ({
    initializeDatabase: jest.fn(),
    getPool: jest.fn(() => ({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    })),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
}));

jest.mock('../services/cacheService', () => ({
    initializeCache: jest.fn(),
    getCache: jest.fn(() => ({
        isOpen: true,
        get: jest.fn(),
        set: jest.fn()
    }))
}));

jest.mock('../services/prismaService', () => ({
    getPrisma: jest.fn(() => ({
        farmer: {
            create: jest.fn((params) => Promise.resolve({
                id: 'new-id',
                ...params.data,
                createdAt: new Date(),
                updatedAt: new Date()
            })),
            findMany: jest.fn(() => Promise.resolve([
                { 
                    id: '1', 
                    firstName: 'John', 
                    lastName: 'Doe',
                    vitalScore: 85,
                    yieldHistory: [{ month: 'Jan', yield: 40 }],
                    locationLat: -1.2833,
                    locationLng: 36.8167
                }
            ])),
            findUnique: jest.fn(() => Promise.resolve({
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                vitalScore: 85,
                yieldHistory: [{ month: 'Jan', yield: 40 }],
                locationLat: -1.2833,
                locationLng: 36.8167,
                region: 'Central',
                village: 'Village A',
                farmSizeHectares: 2.5,
                crops: ['maize'],
                createdAt: new Date()
            }))
        }
    }))
}));

describe('Extended Farmers API Tests', () => {
    let officerToken: string;

    beforeAll(() => {
        officerToken = jwt.sign(
            { userId: 'off-1', role: 'extension_officer', email: 'officer@example.com' },
            config.jwt.secret,
            { expiresIn: '1h' }
        );
    });

    it('should create a farmer with vitalScore and yieldHistory', async () => {
        const farmerData = {
            firstName: 'Jane',
            lastName: 'Smith',
            region: 'North',
            village: 'Village B',
            farmSize: 3.5,
            crops: ['beans'],
            vitalScore: 92,
            yieldHistory: [{ month: 'Feb', yield: 50 }],
            locationLat: -1.3,
            locationLng: 36.9
        };

        const response = await request(app)
            .post('/api/v1/farmers')
            .set('Authorization', `Bearer ${officerToken}`)
            .send(farmerData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.vitalScore).toBe(92);
        expect(response.body.data.locationLat).toBe(-1.3);
    });

    it('should return the new fields in farmer details', async () => {
        const response = await request(app)
            .get('/api/v1/farmers/1')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.vitalScore).toBe(85);
        expect(response.body.data.yieldHistory).toBeDefined();
        expect(response.body.data.location.lat).toBe(-1.2833);
    });
});
