import { z } from 'zod';
import { AIHubMixAccountService } from '../services/aiProvider/providers/aihubmix';
import { Tool } from './types';

const AIHubMixAccountSchema = z.object({
  action: z
    .enum(['get_profile', 'get_available_models', 'list_keys', 'search_keys', 'create_key'])
    .describe('The account management action to perform.'),
  keyword: z.string().optional().describe('Optional keyword for searching API keys (used with search_keys).'),
  keyName: z.string().optional().describe('Optional name when creating a new API key (used with create_key).'),
  quota: z.number().optional().describe('Optional internal quota units for new key (defaults to 500,000).'),
  models: z.string().optional().describe('Optional comma-separated model filter for the new API key.'),
});

export const aihubmixAccountTool: Tool<typeof AIHubMixAccountSchema> = {
  name: 'aihubmix_account',
  description:
    'Query AIHubMix account details, check remaining quota/balance, list available models, or search/manage API keys.',
  schema: AIHubMixAccountSchema,
  execute: async ({ action, keyword, keyName, quota, models }) => {
    const service = new AIHubMixAccountService();

    switch (action) {
      case 'get_profile': {
        const profile = await service.getUserSelf();
        return {
          success: true,
          profile: {
            username: profile.username,
            email: profile.email,
            quotaBalance: profile.quota,
            usedQuota: profile.used_quota,
            group: profile.group,
          },
        };
      }

      case 'get_available_models': {
        const availableModels = await service.getAvailableModels();
        return {
          success: true,
          count: availableModels.length,
          models: availableModels,
        };
      }

      case 'list_keys': {
        const tokens = await service.listTokens(0, 20);
        return {
          success: true,
          count: tokens.length,
          keys: tokens.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status === 1 ? 'active' : 'disabled',
            remainQuota: t.remain_quota,
            unlimitedQuota: t.unlimited_quota,
            models: t.models || 'all',
          })),
        };
      }

      case 'search_keys': {
        const tokens = await service.searchTokens(keyword || '');
        return {
          success: true,
          count: tokens.length,
          keys: tokens.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status === 1 ? 'active' : 'disabled',
            remainQuota: t.remain_quota,
          })),
        };
      }

      case 'create_key': {
        const token = await service.createToken({
          name: keyName || `key-${Date.now()}`,
          remain_quota: quota ?? 500000,
          unlimited_quota: !quota,
          models: models,
        });
        return {
          success: true,
          message: 'API Key issued successfully',
          key: token.key,
          id: token.id,
          name: token.name,
        };
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  },
};
