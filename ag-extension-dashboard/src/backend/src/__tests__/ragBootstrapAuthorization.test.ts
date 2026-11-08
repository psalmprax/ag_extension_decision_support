import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import router from '@/routes/knowledge/ingest';
import { config } from '@/config';
import { RAGV2Service } from '@/services/ragV2Service';

jest.mock('@/services/sessionService', () => ({ isSessionValid: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/ragV2Service', () => ({
    RAGV2Service: {
        initializeSchema: jest.fn().mockResolvedValue(undefined),
        chunkAllArticles: jest.fn().mockResolvedValue({ total: 0, chunks: 0 }),
        buildKnowledgeGraph: jest.fn().mockResolvedValue({ entities: 0, relationships: 0 }),
    },
}));

const app = express();
app.use(router);

function token(role: string) {
    return jwt.sign({ userId: 'user-1', email: 'user@example.test', role }, config.jwt.secret, { algorithm: 'HS256' });
}

describe('RAG bootstrap authorization', () => {
    beforeEach(() => jest.clearAllMocks());

    it('rejects farmers before starting the rebuild', async () => {
        const response = await request(app).post('/ragv2/bootstrap').set('Authorization', `Bearer ${token('farmer')}`);
        expect(response.status).toBe(403);
        expect(RAGV2Service.chunkAllArticles).not.toHaveBeenCalled();
    });

    it('allows an extension officer to rebuild', async () => {
        const response = await request(app).post('/ragv2/bootstrap').set('Authorization', `Bearer ${token('extension_officer')}`);
        expect(response.status).toBe(200);
        expect(RAGV2Service.chunkAllArticles).toHaveBeenCalledTimes(1);
        expect(RAGV2Service.buildKnowledgeGraph).toHaveBeenCalledTimes(1);
    });
});
