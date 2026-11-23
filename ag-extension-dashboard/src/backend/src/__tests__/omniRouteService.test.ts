import { OmniRouteService } from '../services/omniRouteService';
import { OllamaProvider } from '../services/aiProvider/providers/ollama';
import type { AICapability } from '../services/aiProvider/types';

jest.mock('../services/aiProvider/providers/ollama', () => ({
  OllamaProvider: jest.fn().mockImplementation(() => ({
    isConfigured: () => true,
    generateText: jest.fn().mockRejectedValue(new Error('Ollama unavailable in test')),
  })),
}));

describe('OmniRouteService (Ported from money_time_revenue)', () => {
  it('should reject when no candidate model can serve the request', async () => {
    const messages = [{ role: 'user', content: 'What treatment is recommended for maize leaf blight?' }];

    await expect(OmniRouteService.executeWithFailover(messages, [
      { providerName: 'ollama', model: 'local-test-model', score: 1, isFree: true },
    ])).rejects.toThrow(/exhausted/i);
  });

  it('must never return a fabricated offline diagnosis when all candidates fail', async () => {
    const messages = [{ role: 'user', content: 'Diagnose this leaf photo' }];

    try {
      await OmniRouteService.executeWithFailover(messages, [
        { providerName: 'openrouter', model: 'unavailable-model', score: 1, isFree: true },
      ]);
      throw new Error('expected executeWithFailover to reject');
    } catch (err) {
      expect((err as Error).message).not.toMatch(/fungal leaf spot|fallback diagnostic/i);
    }
  });

  it('tries another candidate after receiving an empty response', async () => {
    const candidates = [
      { providerName: 'ollama' as const, model: 'empty-model', score: 2, isFree: true },
      { providerName: 'ollama' as const, model: 'answer-model', score: 1, isFree: true },
    ];
    const generateText = jest.fn<
      ReturnType<AICapability['generateText']>,
      Parameters<AICapability['generateText']>
    >().mockImplementation(async (_messages, options) => ({
        text: options?.model === 'answer-model' ? 'A useful answer.' : '  ',
        model: options?.model ?? 'test-model',
        finishReason: 'stop',
      }));
    jest.mocked(OllamaProvider).mockImplementation(() => ({
      isConfigured: () => true,
      generateText,
    } as unknown as OllamaProvider));
    OmniRouteService.initializeDynamicSwitching(candidates);

    try {
      const result = await OmniRouteService.executeWithFailover(
        [{ role: 'user', content: 'Question' }],
        candidates,
      );

      expect(result).toMatchObject({ text: 'A useful answer.', modelUsed: 'answer-model' });
      expect(generateText).toHaveBeenCalledTimes(3);
    } finally {
      generateText.mockReset();
    }
  });
});
