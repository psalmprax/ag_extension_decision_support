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
    // Providers no longer publish an uncalibrated confidence score.
    expect(res.confidence).toBeUndefined();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        model: 'meta/llama-3.3-70b-instruct',
        max_tokens: 4096,
      }),
      expect.any(Object)
    );
  });

  it('asks once more with the full budget when a small one runs out before the answer', async () => {
    const reply = (content: string | null, finish: string) => ({
      data: { id: 'nv', model: 'nvidia/nemotron', choices: [{ message: { role: 'assistant', content }, finish_reason: finish }] },
    });
    mockedAxios.post.mockResolvedValueOnce(reply(null, 'length')).mockResolvedValueOnce(reply('pong', 'stop'));

    const result = await new NVIDIAProvider().generateText('Reply with exactly one word: pong', { maxTokens: 256 });

    expect(result.text).toBe('pong');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect((mockedAxios.post.mock.calls[0][1] as { max_tokens: number }).max_tokens).toBe(256);
    expect((mockedAxios.post.mock.calls[1][1] as { max_tokens: number }).max_tokens).toBe(4096);
  });

  it('does not retry an empty reply that ended normally', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { id: 'nv', model: 'nvidia/nemotron', choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }] },
    });
    const result = await new NVIDIAProvider().generateText('ping', { maxTokens: 256 });
    expect(result.text).toBe('');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});

