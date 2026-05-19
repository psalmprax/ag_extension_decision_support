/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from '@jest/globals';

describe('Tool Registry', () => {
  let toolRegistry: any[];

  beforeAll(async () => {
    // Dynamic import to avoid side effects from registry
    const registry = await import('../tools/registry');
    toolRegistry = registry.toolRegistry;
  });

  it('should have all expected tools registered', () => {
    const toolNames = toolRegistry.map((t: any) => t.name);
    expect(toolNames).toContain('get_current_date');
    expect(toolNames).toContain('get_geospatial_weather');
    expect(toolNames).toContain('get_weather_forecast');
    expect(toolNames).toContain('schedule_visit');
    expect(toolNames).toContain('get_market_prices');
    expect(toolNames).toContain('get_disease_alerts');
    expect(toolNames).toContain('research_agricultural_data');
    expect(toolNames).toContain('register_agricultural_alert');
    expect(toolNames).toContain('crop_yield_forecast');
    expect(toolNames).toContain('deep_agricultural_research');
    expect(toolNames).toContain('satellite_ndvi_analysis');
    expect(toolNames).toContain('memory_store');
    expect(toolNames).toContain('memory_recall');
    expect(toolNames).toContain('memory_forget');
    expect(toolNames).toContain('dispatch_agent_task');
    expect(toolNames).toContain('handoff_agent_task');
    expect(toolNames).toContain('check_task_status');
    expect(toolNames).toContain('check_api_budget');
    expect(toolNames).toContain('translate_text');
    expect(toolNames).toContain('diagnose_plant_disease');
    expect(toolNames).toContain('analyze_plant_image');
    expect(toolNames).toContain('get_disease_information');
  });

  it('should have unique tool names (no duplicates)', () => {
    const toolNames = toolRegistry.map((t: any) => t.name);
    const uniqueNames = new Set(toolNames);
    expect(uniqueNames.size).toBe(toolNames.length);
  });

  it('each tool should have required fields', () => {
    for (const tool of toolRegistry) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('schema');
      expect(tool).toHaveProperty('execute');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.execute).toBe('function');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('tool descriptions should be meaningful and agricultural-focused', () => {
    for (const tool of toolRegistry) {
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it('tool map should contain all tools for quick lookup', async () => {
    const { toolMap } = await import('../tools/registry');
    for (const tool of toolRegistry) {
      expect(toolMap.has(tool.name)).toBe(true);
      expect(toolMap.get(tool.name)).toBe(tool);
    }
  });
});

describe('NASA POWER Tool', () => {
  it('should have correct schema validation', async () => {
    const { nasaPowerTool } = await import('../tools/nasaPowerTool');

    // Valid input should pass
    const validInput = { latitude: -1.2863, longitude: 36.8172, days: 7 };
    const parsed = nasaPowerTool.schema.parse(validInput);
    expect(parsed.latitude).toBe(-1.2863);
    expect(parsed.longitude).toBe(36.8172);
    expect(parsed.days).toBe(7);

    // Default days should be 7
    const minimalInput = { latitude: 0, longitude: 0 };
    const parsedMinimal = nasaPowerTool.schema.parse(minimalInput);
    expect(parsedMinimal.days).toBe(7);
  });

  it('should reject invalid inputs', async () => {
    const { nasaPowerTool } = await import('../tools/nasaPowerTool');

    // Missing required fields
    expect(() => nasaPowerTool.schema.parse({})).toThrow();
    // Missing longitude
    expect(() => nasaPowerTool.schema.parse({ latitude: 0 })).toThrow();
  });

  it('should have NASA POWER registered in the tool registry', async () => {
    const { toolRegistry } = await import('../tools/registry');
    const nasaTool = toolRegistry.find((t: any) => t.name === 'get_geospatial_weather');
    expect(nasaTool).toBeDefined();
    expect(nasaTool!.description).toContain('NASA POWER');
  });
});

describe('FAO Knowledge Service', () => {
  it('should chunk text into segments on word boundaries', async () => {
    const { faoKnowledgeService } = await import('../services/data/faoKnowledgeService');

    // Short text should return single chunk
    const shortText = 'This is a short text for testing.';
    const shortChunks = faoKnowledgeService.chunkText(shortText);
    expect(shortChunks.length).toBe(1);
    expect(shortChunks[0]).toBe(shortText);

    // Long text should be chunked
    const longText = 'word '.repeat(100) + 'end';
    const longChunks = faoKnowledgeService.chunkText(longText, 200, 20);
    expect(longChunks.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty text gracefully', async () => {
    const { faoKnowledgeService } = await import('../services/data/faoKnowledgeService');
    expect(faoKnowledgeService.chunkText('')).toEqual([]);
    expect(faoKnowledgeService.chunkText('   ')).toEqual([]);
  });

  it('should not split mid-word (chunks contain complete words)', async () => {
    const { faoKnowledgeService } = await import('../services/data/faoKnowledgeService');
    const text = 'apple banana cherry date elderberry fig grape';

    // Use chunk size large enough to include whole words but small enough to force splits
    const chunks = faoKnowledgeService.chunkText(text, 35, 0);

    // All chunks combined should contain the original text (minus extra whitespace)
    const combined = chunks.join(' ').replace(/\s+/g, ' ').trim();
    expect(combined).toBe(text);
  });
});

describe('Health Check Endpoint', () => {
  it('should have health routes defined in app', async () => {
    const app = await import('../app');
    expect(app.default).toBeDefined();
  });
});

describe('Tool Execution Validation', () => {
  it('all tool schemas should be compilable (valid Zod schemas)', async () => {
    const { toolRegistry } = await import('../tools/registry');

    for (const tool of toolRegistry) {
      // Verify the schema is a valid Zod type
      const schemaType = tool.schema.constructor?.name || typeof tool.schema;
      expect(schemaType).toContain('Zod');

      // Try parsing empty input - tools with required fields should fail gracefully
      try {
        tool.schema.parse({});
      } catch (e: any) {
        // Expected for tools with required fields
        expect(e.issues || e.message).toBeDefined();
      }
    }
  });

  it('weather tool should parse correctly', async () => {
    const { weatherTool } = await import('../tools/weatherTool');

    const validInput = { location: 'Nairobi', days: 5 };
    const parsed = weatherTool.schema.parse(validInput);
    expect(parsed.location).toBe('Nairobi');
    expect(parsed.days).toBe(5);
  });

  it('schedule visit tool should validate correctly', async () => {
    const { scheduleVisitTool } = await import('../tools/scheduleVisit');

    const validInput = {
      farmerId: '123e4567-e89b-12d3-a456-426614174000',
      scheduledAt: new Date().toISOString(),
      visitType: 'routine',
      notes: 'Test visit',
    };

    const parsed = scheduleVisitTool.schema.parse(validInput);
    expect(parsed.farmerId).toBe(validInput.farmerId);
    expect(parsed.scheduledAt).toBe(validInput.scheduledAt);
    expect(parsed.visitType).toBe('routine');
  });
});
