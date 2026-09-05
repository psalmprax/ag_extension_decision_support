import { HuggingFaceProvider } from '../services/aiProvider/providers/huggingface';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HuggingFaceProvider (Reasoning & Tool-Calling)', () => {
  const originalEnv = process.env.HUGGINGFACE_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HUGGINGFACE_API_KEY = 'hf_test_token';
  });

  afterAll(() => {
    process.env.HUGGINGFACE_API_KEY = originalEnv;
  });

  it('reports configured when key is present', () => {
    const provider = new HuggingFaceProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.capabilities).toContain('tool-use');
    expect(provider.capabilities).toContain('reasoning');
  });

  it('executes analyzeWithReasoning and parses output', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'hf-1',
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Apply DAP at 50kg/acre at planting. <visuals>{"kpis":[{"label":"DAP","value":"50kg","status":"good"}]}</visuals>',
            },
            finish_reason: 'stop',
          },
        ],
      },
    });

    const provider = new HuggingFaceProvider();
    const res = await provider.analyzeWithReasoning('Context on maize fertilization', 'How much DAP?');

    expect(res.answer).toBe('Apply DAP at 50kg/acre at planting.');
    expect(res.visuals?.kpis?.[0].value).toBe('50kg');
    expect(res.confidence).toBe(0.95);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://router.huggingface.co/v1/chat/completions',
      expect.objectContaining({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        max_tokens: 4096,
      }),
      expect.any(Object)
    );
  });
});
