import axios from 'axios';
import { AIHubMixAccountService, AIHubMixProvider } from '../services/aiProvider/providers/aihubmix';
import { aihubmixAccountTool } from '../tools/aihubmixTool';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AIHubMix Integration (REST Account API, MCP Tool & Model Provider)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AIHUBMIX_ACCESS_KEY = 'test-access-key';
  });

  describe('AIHubMixAccountService', () => {
    it('fetches user profile and internal quota balance', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 1,
            username: 'agri-officer',
            email: 'officer@agriextension.org',
            quota: 5000000,
            used_quota: 120000,
            group: 'vip',
          },
        },
      });

      const service = new AIHubMixAccountService();
      const profile = await service.getUserSelf();

      expect(profile.username).toBe('agri-officer');
      expect(profile.quota).toBe(5000000);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://aihubmix.com/api/user/self',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-access-key' },
        })
      );
    });

    it('fetches available models list', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: ['google/gemini-2.0-flash-exp:free', 'openai/gpt-4o', 'anthropic/claude-3-5-sonnet'],
        },
      });

      const service = new AIHubMixAccountService();
      const models = await service.getAvailableModels();

      expect(models).toHaveLength(3);
      expect(models).toContain('google/gemini-2.0-flash-exp:free');
    });

    it('creates a new sk- API key with custom quota and model restrictions', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: 42,
            key: 'sk-aihubmix-test-token-12345',
            name: 'field-officer-key',
            remain_quota: 250000,
          },
        },
      });

      const service = new AIHubMixAccountService();
      const token = await service.createToken({
        name: 'field-officer-key',
        remain_quota: 250000,
        models: 'google/gemini-2.0-flash-exp:free',
      });

      expect(token.id).toBe(42);
      expect(token.key).toBe('sk-aihubmix-test-token-12345');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://aihubmix.com/api/token/',
        {
          name: 'field-officer-key',
          remain_quota: 250000,
          unlimited_quota: false,
          expired_time: -1,
          models: 'google/gemini-2.0-flash-exp:free',
        },
        expect.any(Object)
      );
    });
  });

  describe('AIHubMix MCP Tool', () => {
    it('executes get_profile action successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            username: 'officer-1',
            email: 'officer@example.com',
            quota: 100000,
            used_quota: 5000,
            group: 'standard',
          },
        },
      });

      const raw = await aihubmixAccountTool.execute({ action: 'get_profile' });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.profile.username).toBe('officer-1');
    });

    it('executes list_keys action successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: [
            { id: 1, name: 'primary-key', status: 1, remain_quota: 500000, unlimited_quota: false },
          ],
        },
      });

      const raw = await aihubmixAccountTool.execute({ action: 'list_keys' });
      const result = JSON.parse(raw);
      expect(result.success).toBe(true);
      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].name).toBe('primary-key');
    });
  });

  describe('AIHubMixProvider (Chat Completions)', () => {
    it('sends chat completions request with bearer token', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'chat-1',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Recommended fertilizer: NPK 17:17:17 at 50kg/acre.',
              },
            },
          ],
        },
      });

      const provider = new AIHubMixProvider('sk-test-key');
      const reply = await provider.chat({
        messages: [{ role: 'user', content: 'What fertilizer for maize?' }],
      });

      expect(reply).toBe('Recommended fertilizer: NPK 17:17:17 at 50kg/acre.');
    });
  });
});
