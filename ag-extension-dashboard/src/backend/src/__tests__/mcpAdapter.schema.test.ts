import { z } from 'zod';

jest.mock('@/tools/registry', () => ({
  toolRegistry: [],
  toolMap: new Map(),
}));
jest.mock('@/services/aiProvider/aiProvider', () => ({ AIProviderFactory: {} }));
jest.mock('@/services/security/aegisShield', () => ({ aegisShield: {} }));
jest.mock('@/utils/logger', () => ({ logger: { warn: jest.fn() } }));

import { toolRegistry } from '@/tools/registry';
import { mcpAdapter } from '@/services/mcpAdapter';

describe('MCP tool schema conversion', () => {
  afterEach(() => { toolRegistry.length = 0; });

  it('preserves Zod field types, descriptions, constraints, and input optionality', () => {
    toolRegistry.push({
      name: 'schema_test',
      description: 'Schema conversion test',
      schema: z.object({
        location: z.string().describe('Farm location'),
        days: z.number().min(1).max(7).default(3),
        detailed: z.boolean().optional(),
        crops: z.array(z.string()),
        units: z.enum(['metric', 'imperial']),
        options: z.object({ alerts: z.boolean() }).optional(),
      }),
      execute: async () => 'ok',
    });

    expect(mcpAdapter.convertToMCPTools()).toEqual([{
      name: 'schema_test',
      description: 'Schema conversion test',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Farm location' },
          days: { type: 'number', minimum: 1, maximum: 7, default: 3 },
          detailed: { type: 'boolean' },
          crops: { type: 'array', items: { type: 'string' } },
          units: { type: 'string', enum: ['metric', 'imperial'] },
          options: {
            type: 'object',
            properties: { alerts: { type: 'boolean' } },
            required: ['alerts'],
          },
        },
        required: ['location', 'crops', 'units'],
      },
    }]);
  });

  it('omits required when all input fields are optional', () => {
    toolRegistry.push({
      name: 'optional_test',
      description: 'Optional inputs',
      schema: z.object({ days: z.number().default(3) }),
      execute: async () => 'ok',
    });

    expect(mcpAdapter.convertToMCPTools()[0].inputSchema.required).toBeUndefined();
  });
});
