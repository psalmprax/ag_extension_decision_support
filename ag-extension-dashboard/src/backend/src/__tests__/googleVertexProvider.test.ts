/**
 * Google (Gemini / Vertex) provider: authentication resolution and embedding
 * dimensions. Regression guard for two bugs:
 *  - the GCP project ID was passed to the SDK as an API key, so Vertex auth
 *    could never work;
 *  - gemini-embedding-001 returns 3072-d vectors by default while the pgvector
 *    columns are vector(768), so every embedding write was rejected.
 */
const mockEmbedContent = jest.fn();
const mockCtor = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation((opts: unknown) => {
        mockCtor(opts);
        return { models: { embedContent: mockEmbedContent } };
    }),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const googleConfig = { projectId: '', location: 'europe-west4', apiKey: '' };
jest.mock('../config', () => ({ config: { googleVertex: googleConfig } }));
jest.mock('@/config', () => ({ config: { googleVertex: googleConfig } }));

import { GoogleVertexProvider, resolveGoogleAuth } from '../services/aiProvider/providers/googleVertex';
import { EMBEDDING_DIMENSIONS } from '../services/embeddingDimensions';

function setConfig(next: Partial<typeof googleConfig>) {
    Object.assign(googleConfig, { projectId: '', location: 'europe-west4', apiKey: '' }, next);
}

describe('resolveGoogleAuth', () => {
    it('is unconfigured with nothing set', () => {
        setConfig({});
        expect(resolveGoogleAuth()).toBeNull();
    });

    it('prefers an explicit API key', () => {
        setConfig({ apiKey: 'AIza-explicit', projectId: 'my-project' });
        expect(resolveGoogleAuth()).toEqual({ mode: 'apiKey', apiKey: 'AIza-explicit' });
    });

    it('still honours a legacy API key stored in the project-ID variable', () => {
        setConfig({ projectId: 'AIzaLegacyKey' });
        expect(resolveGoogleAuth()).toEqual({ mode: 'apiKey', apiKey: 'AIzaLegacyKey' });
    });

    it('uses Vertex AI (ADC) for a real project ID — never as an API key', () => {
        setConfig({ projectId: 'my-gcp-project' });
        expect(resolveGoogleAuth()).toEqual({ mode: 'vertex', project: 'my-gcp-project', location: 'europe-west4' });
    });

    it('treats the template placeholder as unconfigured', () => {
        setConfig({ projectId: 'your-project-id' });
        expect(resolveGoogleAuth()).toBeNull();
    });
});

describe('GoogleVertexProvider client + embeddings', () => {
    beforeEach(() => {
        mockCtor.mockClear();
        mockEmbedContent.mockReset();
    });

    it('constructs a Vertex client with project/location for a project ID', async () => {
        setConfig({ projectId: 'my-gcp-project' });
        mockEmbedContent.mockResolvedValue({ embeddings: [{ values: new Array(EMBEDDING_DIMENSIONS).fill(0.1) }] });
        await new GoogleVertexProvider().createEmbedding('maize streak virus');
        expect(mockCtor).toHaveBeenCalledWith({ vertexai: true, project: 'my-gcp-project', location: 'europe-west4', httpOptions: { timeout: 60_000 } });
    });

    it('pins outputDimensionality to the pgvector width (single)', async () => {
        setConfig({ apiKey: 'AIza-k' });
        mockEmbedContent.mockResolvedValue({ embeddings: [{ values: new Array(EMBEDDING_DIMENSIONS).fill(0.1) }] });
        const result = await new GoogleVertexProvider().createEmbedding('fall armyworm');
        expect(mockEmbedContent).toHaveBeenCalledWith(expect.objectContaining({
            model: 'gemini-embedding-001',
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        }));
        expect(result.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    });

    it('pins outputDimensionality to the pgvector width (batch)', async () => {
        setConfig({ apiKey: 'AIza-k' });
        mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1] }, { values: [2] }] });
        await new GoogleVertexProvider().createBatchEmbeddings(['a', 'b']);
        expect(mockEmbedContent).toHaveBeenCalledWith(expect.objectContaining({
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        }));
    });
});
