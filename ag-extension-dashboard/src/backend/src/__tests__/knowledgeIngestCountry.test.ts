import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { config } from '@/config';

const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
jest.mock('@/services/sessionService', () => ({ isSessionValid: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/prismaService', () => ({ getPrisma: () => ({ knowledgeArticle: { create } }) }));
jest.mock('@/services/vectorService', () => ({ VectorService: { upsertDocument: jest.fn() } }));
jest.mock('@/services/country/countryContext', () => ({ countryOfUser: jest.fn().mockResolvedValue('Malawi') }));

import router from '@/routes/knowledge/ingest';

const app = express();
app.use(router);

const token = (role: string) => jwt.sign({ userId: 'user-1', email: 'user@example.test', role }, config.jwt.secret, { algorithm: 'HS256' });
const upload = (role: string, fields: Record<string, string> = {}) => {
    let req = request(app).post('/ingest').set('Authorization', `Bearer ${token(role)}`)
        .attach('file', Buffer.from('Plant maize at the onset of the rains.'), 'maize-guide.txt');
    for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
    return req;
};

describe('adding a guide to the knowledge base', () => {
    beforeEach(() => create.mockClear());

    it('tags an officer’s guide with their country and holds it for review', async () => {
        const response = await upload('extension_officer');
        expect(response.status).toBe(201);
        const data = create.mock.calls[0][0].data;
        expect(data.regions).toContain('Malawi');
        expect(data.tags).toContain('pending_review');
        expect(response.body.data.pendingReview).toBe(true);
    });

    it('uses the country given on the form, and a manager’s guide needs no review', async () => {
        const response = await upload('regional_manager', { country: 'Ghana' });
        expect(response.status).toBe(201);
        const data = create.mock.calls[0][0].data;
        expect(data.regions).toEqual(['Ghana']);
        expect(data.tags).not.toContain('pending_review');
    });
});
