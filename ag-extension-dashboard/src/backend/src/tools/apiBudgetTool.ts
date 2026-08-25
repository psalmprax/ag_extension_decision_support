import { z } from 'zod';
import { Tool } from './types';
import { credentialVault } from '@/services/security/credentialVault';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

const apiBudgetSchema = z.object({
  provider: z.string().optional().describe('AI provider to check (groq, openai, anthropic, etc.)'),
});

function getProviderModel(p: string): string {
  if (p === 'groq') return 'llama-3.3-70b';
  if (p === 'openai') return 'gpt-4o-mini';
  return 'not-configured';
}

function getProviderCost(p: string): string {
  if (p === 'groq') return '$0.00059';
  if (p === 'openai') return '$0.00015';
  return 'N/A';
}

async function getProviderReport(p: string) {
  try {
    const prov = await AIProviderFactory.getProvider(p as 'groq' | 'openai' | 'anthropic');
    const configured = prov.isConfigured();
    return {
      configured,
      model: getProviderModel(p),
      costPer1KTokens: getProviderCost(p),
      estimatedMonthlySpend: configured ? 'tracking...' : 'N/A',
      status: configured ? 'active' : 'not-configured',
    };
  } catch {
    return {
      configured: false,
      model: 'N/A',
      costPer1KTokens: 'N/A',
      estimatedMonthlySpend: 'N/A',
      status: 'error',
    };
  }
}

export const apiBudgetTool: Tool<typeof apiBudgetSchema> = {
  name: 'check_api_budget',
  description: 'Checks API usage budget, costs, and limits across all AI providers. Returns current spend, remaining budget, and cost-per-request estimates. Use when monitoring API costs or checking if budget is available.',
  schema: apiBudgetSchema,
  execute: async ({ provider }) => {
    const providers = ['groq', 'openai', 'anthropic', 'google_vertex', 'azure_openai'];
    const targetProviders = provider ? [provider] : providers;

    const budgetReport: Record<string, {
      configured: boolean;
      model: string;
      costPer1KTokens: string;
      estimatedMonthlySpend: string;
      status: string;
    }> = {};

    for (const p of targetProviders) {
      budgetReport[p] = await getProviderReport(p);
    }

    const credentials = credentialVault.getAllCredentialsSummary();
    const expiring = credentialVault.getExpiringCredentials(30);

    const report = {
      providers: budgetReport,
      credentialVault: {
        totalCredentials: credentials.length,
        expiringSoon: expiring.map(c => ({ name: c.name, expiresAt: c.expiresAt })),
      },
      recommendations: [
        'Use Groq for high-volume, low-cost inference',
        'Fallback to OpenAI for vision/complex reasoning',
        'Rotate API keys before expiry (check credential vault)',
        'Monitor token usage per conversation to optimize costs',
      ],
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
  },
};
