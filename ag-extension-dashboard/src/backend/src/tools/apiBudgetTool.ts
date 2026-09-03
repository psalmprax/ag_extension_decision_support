import { z } from 'zod';
import { Tool } from './types';
import { credentialVault } from '@/services/security/credentialVault';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { agentTelemetry } from '@/services/agentTelemetry';

const apiBudgetSchema = z.object({
  provider: z.string().optional().describe('AI provider to check (groq, openai, anthropic, etc.)'),
  hours: z.number().int().min(1).max(24 * 90).optional().describe('Look-back window in hours (default 720 = 30 days)'),
});

type ProviderKey = 'groq' | 'openai' | 'anthropic' | 'google_vertex' | 'azure_openai' | 'aihubmix' | 'openrouter' | 'ollama';

async function getProviderStatus(p: string): Promise<{ configured: boolean; healthy: boolean | null; status: string; lastHealthError?: string }> {
  try {
    const prov = await AIProviderFactory.getProvider(p as ProviderKey);
    const configured = prov.isConfigured();
    if (!configured) return { configured, healthy: null, status: 'not-configured' };
    const healthy = await prov.healthCheck();
    return {
      configured,
      healthy,
      status: healthy ? 'healthy' : 'unhealthy',
      lastHealthError: healthy ? undefined : prov.getLastHealthError?.(),
    };
  } catch (err) {
    return { configured: false, healthy: null, status: 'error', lastHealthError: (err as Error).message };
  }
}

/**
 * Reports what the platform actually knows about AI spend: provider configuration
 * and health, plus token/cost totals recorded in agent_telemetry. It does NOT
 * query provider billing APIs and does not know external budgets/limits — those
 * fields are reported as unavailable rather than guessed.
 */
export const apiBudgetTool: Tool<typeof apiBudgetSchema> = {
  name: 'check_api_budget',
  description: 'Reports AI provider configuration/health and the token & cost totals recorded by internal telemetry over a look-back window. It cannot see provider-side billing or hard budget limits; say so if asked about remaining budget.',
  schema: apiBudgetSchema,
  execute: async ({ provider, hours }) => {
    const providers: ProviderKey[] = ['groq', 'openai', 'anthropic', 'aihubmix', 'openrouter', 'google_vertex', 'azure_openai', 'ollama'];
    const targetProviders = provider ? [provider] : providers;
    const windowHours = hours ?? 720;

    const providerStatus: Record<string, Awaited<ReturnType<typeof getProviderStatus>>> = {};
    for (const p of targetProviders) {
      providerStatus[p] = await getProviderStatus(p);
    }

    let telemetry: { totalRequests: number; totalErrors: number; totalTokensUsed: number; totalCostUsd: number; agentUsage?: Record<string, number>; toolUsage?: Record<string, number> } | null = null;
    let telemetryNote: string | undefined;
    try {
      const summary = await agentTelemetry.getSummary(windowHours);
      telemetry = {
        totalRequests: summary.totalRequests,
        totalErrors: summary.totalErrors,
        totalTokensUsed: summary.totalTokensUsed,
        totalCostUsd: summary.totalCostUsd,
        agentUsage: summary.agentUsage,
        toolUsage: summary.toolUsage,
      };
      if (summary.totalTokensUsed === 0 && summary.totalRequests > 0) {
        telemetryNote = 'Requests were recorded without token counts; most providers in this deployment do not report usage, so cost totals are a lower bound.';
      }
    } catch (err) {
      telemetryNote = `Telemetry unavailable: ${(err as Error).message}`;
    }

    const credentials = credentialVault.getAllCredentialsSummary();
    const expiring = credentialVault.getExpiringCredentials(30);

    const report = {
      windowHours,
      providers: providerStatus,
      recordedUsage: telemetry,
      recordedUsageNote: telemetryNote,
      providerBilling: {
        available: false,
        note: 'Provider-side spend, remaining credit and hard limits are not queried. Check each provider console for authoritative figures.',
      },
      credentialVault: {
        totalCredentials: credentials.length,
        expiringSoon: expiring.map(c => ({ name: c.name, expiresAt: c.expiresAt })),
      },
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
  },
};
