jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import axios from 'axios';
import { failureCooldownMs } from '@/services/aiProvider/aiProvider';
import { OpenRouterProvider, OPENROUTER_FREE_ROUTER } from '@/services/aiProvider/providers/openRouter';

jest.mock('axios');

describe('how long a failed provider is skipped', () => {
    it('skips an account out of credit or quota, or a rejected key, for 15 minutes', () => {
        const fifteen = 15 * 60_000;
        expect(failureCooldownMs(Object.assign(new Error('Request failed with status code 403'), {
            response: { status: 403, data: { error: 'Your account balance is insufficient. Please recharge your account' } },
        }))).toBe(fifteen);
        expect(failureCooldownMs(new Error('AIHUBMIX_QUOTA_EXCEEDED: Quota limit reached for gemini-3.1-flash-lite'))).toBe(fifteen);
        expect(failureCooldownMs(Object.assign(new Error('Payment required'), { response: { status: 402 } }))).toBe(fifteen);
        expect(failureCooldownMs(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))).toBe(fifteen);
    });

    it('skips a rate-limited provider for 2 minutes', () => {
        expect(failureCooldownMs(Object.assign(new Error('Too many requests'), { response: { status: 429 } }))).toBe(2 * 60_000);
    });

    it('retries anything else after 45 seconds', () => {
        expect(failureCooldownMs(new Error('socket hang up'))).toBe(45_000);
        expect(failureCooldownMs(Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } }))).toBe(45_000);
        // A refusal for some other reason is not taken for an empty account.
        expect(failureCooldownMs(Object.assign(new Error('Forbidden'), { response: { status: 403, data: { error: 'content policy' } } }))).toBe(45_000);
    });
});

describe('OpenRouter photo analysis', () => {
    beforeEach(() => {
        process.env.OPENROUTER_API_KEY = 'test-key';
        delete process.env.OPENROUTER_VISION_MODEL;
    });

    it('sends the photo through the free router and reports the model it chose', async () => {
        (axios.post as jest.Mock).mockResolvedValue({
            data: { id: 'x', model: 'nvidia/nemotron-3.5-super-vl:free', choices: [{ message: { role: 'assistant', content: '{"overallHealth":"stressed"}' }, finish_reason: 'stop' }] },
        });
        const provider = new OpenRouterProvider();
        expect(provider.capabilities).toContain('vision');
        const result = await provider.analyzeImage('data:image/jpeg;base64,AAAA', 'Describe the leaf');
        const [, body, config] = (axios.post as jest.Mock).mock.calls[0];
        expect(body.model).toBe(OPENROUTER_FREE_ROUTER);
        expect(body.messages[0].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });
        expect(config.timeout).toBe(45000);
        expect(result).toMatchObject({ analysis: '{"overallHealth":"stressed"}', model: 'nvidia/nemotron-3.5-super-vl:free', provider: 'OpenRouter' });
    });
});
