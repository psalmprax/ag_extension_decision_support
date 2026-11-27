jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../services/embeddingCache', () => ({ getEmbedding: jest.fn() }));

import { retryEmbeddingTimeouts, SEED_EMBED_ATTEMPTS } from '../services/vectorService';

describe('seed article embedding retries', () => {
    it('tries again when the provider only timed out', async () => {
        const embed = jest.fn()
            .mockRejectedValueOnce(new Error('Embedding generation timed out after 3500ms'))
            .mockResolvedValueOnce(undefined);
        await retryEmbeddingTimeouts('Precision Irrigation Calculations', embed);
        expect(embed).toHaveBeenCalledTimes(2);
    });

    it('gives up after a few timeouts in a row', async () => {
        const embed = jest.fn().mockRejectedValue(new Error('Embedding generation timed out after 3500ms'));
        await expect(retryEmbeddingTimeouts('Slow article', embed)).rejects.toThrow('timed out');
        expect(embed).toHaveBeenCalledTimes(SEED_EMBED_ATTEMPTS);
    });

    it('does not retry errors that retrying cannot fix', async () => {
        const embed = jest.fn().mockRejectedValue(new Error('Invalid API key'));
        await expect(retryEmbeddingTimeouts('Any article', embed)).rejects.toThrow('Invalid API key');
        expect(embed).toHaveBeenCalledTimes(1);
    });

    it('fails at once on a rejection that is not an error object', async () => {
        const embed = jest.fn().mockRejectedValue(null);
        await expect(retryEmbeddingTimeouts('Any article', embed)).rejects.toBeNull();
        expect(embed).toHaveBeenCalledTimes(1);
    });
});
