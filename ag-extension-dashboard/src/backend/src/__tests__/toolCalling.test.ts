import { z } from 'zod';
import { normalizeToolDefinitions } from '../services/aiProvider/toolCalling';

describe('normalizeToolDefinitions', () => {
  it.each([undefined, [], [null, false, {}, { name: 1 }]])('omits empty or unsupported tools (%j)', tools => {
    expect(normalizeToolDefinitions(tools)).toBeUndefined();
  });

  it('preserves OpenAI definitions and supplies absent parameters', () => {
    const parameters = { type: 'object', properties: { crop: { type: 'string' } } };
    expect(normalizeToolDefinitions([
      { type: 'function', function: { name: 'lookup', description: 'Find a crop', parameters } },
      { type: 'function', function: { name: 42, description: 0 } },
    ])).toEqual([
      { type: 'function', function: { name: 'lookup', description: 'Find a crop', parameters } },
      { type: 'function', function: { name: '42', description: undefined, parameters: { type: 'object', properties: {} } } },
    ]);
  });

  it('prefers explicit JSON schema over Zod and inputSchema', () => {
    const jsonSchema = { type: 'object', properties: { location: { type: 'string' } } };
    const result = normalizeToolDefinitions([{
      name: 'weather', description: 123, jsonSchema,
      schema: z.object({ ignored: z.string() }), inputSchema: { type: 'string' },
    }]);
    expect(result?.[0].function).toEqual({ name: 'weather', description: '123', parameters: jsonSchema });
  });

  it('converts Zod parameters without retaining the document-level schema URL', () => {
    const result = normalizeToolDefinitions([{ name: 'weather', schema: z.object({ location: z.string() }) }]);
    expect(result?.[0].function.parameters).toMatchObject({
      type: 'object', properties: { location: { type: 'string' } }, required: ['location'],
    });
    expect(result?.[0].function.parameters).not.toHaveProperty('$schema');
  });

  it('uses inputSchema when no JSON or Zod schema is supplied', () => {
    const inputSchema = { type: 'object', properties: { days: { type: 'number' } } };
    const result = normalizeToolDefinitions([{ name: 'forecast', inputSchema }]);
    expect(result?.[0].function.parameters).toBe(inputSchema);
  });

  it('keeps the empty-object fallback for a broken Zod schema', () => {
    const result = normalizeToolDefinitions([{
      name: 'broken', schema: { safeParse: () => undefined }, inputSchema: { type: 'string' },
    }]);
    expect(result?.[0].function.parameters).toEqual({ type: 'object', properties: {} });
  });
});
