import { HuggingFaceProvider } from '../services/aiProvider/providers/huggingface';
import { NVIDIAProvider } from '../services/aiProvider/providers/nvidia';
import { OmniRouteService } from '../services/omniRouteService';

const originalHfKey = process.env.HUGGINGFACE_API_KEY;
const originalNvidiaKey = process.env.NVIDIA_API_KEY;

describe('OmniRoute Hugging Face + NVIDIA providers', () => {
  afterEach(() => {
    process.env.HUGGINGFACE_API_KEY = originalHfKey;
    process.env.NVIDIA_API_KEY = originalNvidiaKey;
  });

  it('huggingface reports not configured without a key', () => {
    process.env.HUGGINGFACE_API_KEY = '';
    expect(new HuggingFaceProvider().isConfigured()).toBe(false);
  });

  it('huggingface reports configured with a key', () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    expect(new HuggingFaceProvider().isConfigured()).toBe(true);
  });

  it('nvidia reports notConfigured without a key', () => {
    process.env.NVIDIA_API_KEY = '';
    expect(new NVIDIAProvider().isConfigured()).toBe(false);
  });

  it('nvidia reports configured with a key', () => {
    process.env.NVIDIA_API_KEY = 'nvapi-test-key';
    expect(new NVIDIAProvider().isConfigured()).toBe(true);
  });

  it('OmniRoute catalog contains huggingface and nvidia candidates', () => {
    const providers = OmniRouteService.FREE_LLM_CATALOG.map((c) => c.providerName);
    expect(providers).toContain('huggingface');
    expect(providers).toContain('nvidia');
  });

  it('samples huggingface and nvidia are scored below the top aihubmix tier', () => {
    const top = OmniRouteService.FREE_LLM_CATALOG[0];
    expect(top.providerName).toBe('aihubmix');
    const hfModels = OmniRouteService.FREE_LLM_CATALOG.filter((c) => c.providerName === 'huggingface');
    const nvidiaModels = OmniRouteService.FREE_LLM_CATALOG.filter((c) => c.providerName === 'nvidia');
    expect(hfModels.length).toBeGreaterThan(0);
    expect(nvidiaModels.length).toBeGreaterThan(0);
    for (const c of [...hfModels, ...nvidiaModels]) {
      expect(c.score).toBeLessThan(top.score);
    }
  });

  it('chat throws a clear error when the huggingface key is missing', async () => {
    process.env.HUGGINGFACE_API_KEY = '';
    await expect(
      new HuggingFaceProvider().chat({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('HUGGINGFACE_API_KEY missing');
  });

  it('chat throws a clear error when the nvidia key is missing', async () => {
    process.env.NVIDIA_API_KEY = '';
    await expect(
      new NVIDIAProvider().chat({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('NVIDIA_API_KEY missing');
  });

  it('AIRouter.routeRequest reason normalizes OmniRoute fallback to ReasoningResult', async () => {
    const { AIRouter, AIProviderFactory } = await import('../services/aiProvider/aiProvider');
    const spy = jest.spyOn(AIProviderFactory, 'getWithFallback').mockResolvedValueOnce({
      text: 'Maize requires 500mm water.<visuals>{"kpis":[{"label":"Water","value":"500mm","status":"good"}]}</visuals>',
      providerUsed: 'openrouter',
      modelUsed: 'meta-llama/llama-3.3-70b-instruct:free',
      isFreeModel: true,
    });

    const result = await AIRouter.routeRequest('reason', {
      context: 'Maize context',
      query: 'What is water requirement?',
    });

    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('answer');
    expect(result.answer).toContain('Maize requires 500mm water.');
    expect(result.visuals?.kpis).toHaveLength(1);
    expect(result.providerUsed).toBe('openrouter');
    expect(result.modelUsed).toBe('meta-llama/llama-3.3-70b-instruct:free');
    expect(result.isFreeModel).toBe(true);

    spy.mockRestore();
  });
});