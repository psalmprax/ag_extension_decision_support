import { NVIDIAProvider } from '../services/aiProvider/providers/nvidia';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NVIDIAProvider (Reasoning & Tool-Calling)', () => {
  const originalEnv = process.env.NVIDIA_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NVIDIA_API_KEY = 'nvapi-test-key';
  });

  afterAll(() => {
    process.env.NVIDIA_API_KEY = originalEnv;
  });

  it('reports configured when key is present', () => {
    const provider = new NVIDIAProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.capabilities).toContain('tool-use');
    expect(provider.capabilities).toContain('reasoning');
  });

  it('executes analyzeWithReasoning and parses output', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        id: 'nv-1',
        model: 'meta/llama-3.3-70b-instruct',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Recommended lime: 3.2 tons/ha. <visuals>{"kpis":[{"label":"Lime","value":"3.2t","status":"good"}]}</visuals>',
            },
            finish_reason: 'stop',
          },
        ],
      },
    });

    const provider = new NVIDIAProvider();
    const res = await provider.analyzeWithReasoning('Context on acid soils', 'How much lime?');

    expect(res.answer).toBe('Recommended lime: 3.2 tons/ha.');
    expect(res.visuals?.kpis?.[0].value).toBe('3.2t');
    expect(res.confidence).toBe(0.95);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        model: 'meta/llama-3.3-70b-instruct',
        max_tokens: 4096,
      }),
      expect.any(Object)
    );
  });
});
