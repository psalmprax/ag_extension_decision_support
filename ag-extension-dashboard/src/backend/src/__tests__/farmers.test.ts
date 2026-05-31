import request from 'supertest';
import app from '../app';
import jwt from 'jsonwebtoken';
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
    query: jest.fn().mockResolvedValue({ 
        rows: [{ count: 0 }],
        rowCount: 1 
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

// Mock Prisma
jest.mock('../services/prismaService', () => ({
    getPrisma: jest.fn(() => ({
        farmer: {
            findMany: jest.fn(() => Promise.resolve([
                { 
                    id: '1', 
                    firstName: 'John', 
                    lastName: 'Doe',
                    phone: '123456789',
                    region: 'Central',
                    village: 'Village A',
                    crops: ['maize'],
                    farmSizeHectares: 2.5,
                    languagePreference: 'en',
                    assignedOfficerId: 'off-1',
                    userId: 'farm-1'
                }
            ])),
            findUnique: jest.fn(() => Promise.resolve(
                { 
                    id: '1', 
                    firstName: 'John', 
                    lastName: 'Doe',
                    phone: '123456789',
                    region: 'Central',
                    village: 'Village A',
                    crops: ['maize'],
                    farmSizeHectares: 2.5,
                    languagePreference: 'en',
                    assignedOfficerId: 'off-1',
                    userId: 'farm-1',
                    createdAt: new Date()
                }
            ))
        }
    }))
}));

describe('Farmers API Integration Tests', () => {
    let officerToken: string;
    let farmerToken: string;

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
    });

    it('should allow extension officer to list farmers', async () => {
        const response = await request(app)
            .get('/api/v1/farmers')
            .set('Authorization', `Bearer ${officerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.farmers)).toBe(true);
    });

    it('should allow farmer to get their own profile', async () => {
        const response = await request(app)
            .get('/api/v1/farmers/1')
            .set('Authorization', `Bearer ${farmerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.firstName).toBe('John');
    });

    it('should return 401 for unauthenticated request', async () => {
        const response = await request(app).get('/api/v1/farmers');
        expect(response.status).toBe(401);
    });
});
