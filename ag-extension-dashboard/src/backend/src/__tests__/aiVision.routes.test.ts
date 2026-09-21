import request from 'supertest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import visionRouter from '@/routes/ai/vision';
import { AIRouter } from '@/services/aiProvider/aiProvider';

// Mock AIRouter
jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: {
        routeRequest: jest.fn(),
    },
}));

// Mock usageService
jest.mock('@/services/usageService', () => ({
    usageService: {
        incrementUsage: jest.fn(async () => undefined),
    },
}));

// Mock authorize middleware to inject user
jest.mock('@/middleware/authorize', () => ({
    authorize: () => (req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = { userId: 'test-user-id', role: 'extension_officer' };
        next();
    },
    optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).user = { userId: 'test-user-id', role: 'extension_officer' };
        next();
    },
}));

// Mock usageMiddleware
jest.mock('@/middleware/usageMiddleware', () => ({
    checkUsageLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const mockRouteRequest = AIRouter.routeRequest as jest.MockedFunction<typeof AIRouter.routeRequest>;

const app = express();
app.use(express.json({ limit: '100mb' }));
// Simulate app-level optionalAuth middleware that runs before routes
app.use((req: Request, _res: Response, next: NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = { userId: 'test-user-id', role: 'extension_officer' };
    next();
});
app.use('/api/ai', visionRouter);

describe('AI Vision Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/ai/analyze-image', () => {
        it('passes image to AIRouter even when not provided', async () => {
            const mockResult = { analysis: 'No image provided' };
            mockRouteRequest.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/api/ai/analyze-image')
                .send({ prompt: 'test' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(AIRouter.routeRequest).toHaveBeenCalledWith('vision', {
                imageData: undefined,
                prompt: 'test',
                options: { temperature: 0.3 },
            });
        });

        it('calls AIRouter.routeRequest with correct params and returns result', async () => {
            const mockResult = { analysis: 'Healthy plant', model: 'gemini-2.5-flash' };
            mockRouteRequest.mockResolvedValue(mockResult);

            const res = await request(app)
                .post('/api/ai/analyze-image')
                .send({ image: 'base64imagedata', prompt: 'Analyze this' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockResult);
            expect(AIRouter.routeRequest).toHaveBeenCalledWith('vision', {
                imageData: 'base64imagedata',
                prompt: 'Analyze this',
                options: { temperature: 0.3 },
            });
        });

        it('returns 500 when AIRouter throws', async () => {
            mockRouteRequest.mockRejectedValue(new Error('Provider failed'));

            const res = await request(app)
                .post('/api/ai/analyze-image')
                .send({ image: 'base64imagedata' })
                .expect(500);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Failed to analyze image');
        });
    });

    describe('POST /api/ai/analyze-video', () => {
        it('returns 400 when video is missing', async () => {
            const res = await request(app)
                .post('/api/ai/analyze-video')
                .send({ prompt: 'test' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Video data is required as a base64 string.');
        });

        it('returns 400 when video is invalid base64', async () => {
            const res = await request(app)
                .post('/api/ai/analyze-video')
                .send({ video: 'not-base64!!', prompt: 'test' })
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid video payload.');
        });

        it('returns 413 when video exceeds size limit', async () => {
            // Create a base64 string that's too long (> 50MB decoded)
            const largeBase64 = 'A'.repeat(70000000); // ~52MB base64
            const res = await request(app)
                .post('/api/ai/analyze-video')
                .send({ video: largeBase64, prompt: 'test' })
                .expect(413);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('exceeds the 50 MB size limit');
        });

        it('calls AIRouter.routeRequest with correct params for valid video', async () => {
            const mockResult = { analysis: 'Video analysis result', framesAnalyzed: 5 };
            mockRouteRequest.mockResolvedValue(mockResult);

            // Small valid base64 video
            const videoBase64 = Buffer.from('fake video data').toString('base64');
            const res = await request(app)
                .post('/api/ai/analyze-video')
                .send({ video: videoBase64, prompt: 'Analyze', frameInterval: 1, maxFrames: 10 })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockResult);
            expect(AIRouter.routeRequest).toHaveBeenCalledWith('video', {
                videoData: Buffer.from('fake video data'),
                prompt: 'Analyze',
                options: { temperature: 0.3, frameInterval: 1, maxFrames: 10 },
            });
        });

        it('uses default frameInterval and maxFrames when not provided', async () => {
            const mockResult = { analysis: 'Video analysis' };
            mockRouteRequest.mockResolvedValue(mockResult);

            const videoBase64 = Buffer.from('fake video data').toString('base64');
            await request(app)
                .post('/api/ai/analyze-video')
                .send({ video: videoBase64 })
                .expect(200);

            expect(AIRouter.routeRequest).toHaveBeenCalledWith('video', {
                videoData: Buffer.from('fake video data'),
                prompt: undefined,
                options: { temperature: 0.3, frameInterval: undefined, maxFrames: undefined },
            });
        });
    });
});