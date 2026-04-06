import { z } from 'zod';
import { Tool } from './types';
import { persistentMemory } from '@/services/persistentMemory';
import { getPool } from '@/services/databaseService';

const memoryStoreSchema = z.object({
  category: z.string().describe('Memory category (e.g., farmer_preferences, field_notes, weather_patterns)'),
  key: z.string().describe('Memory key identifier'),
  value: z.string().describe('Memory content to store'),
  importance: z.number().min(0).max(1).optional().default(0.5).describe('Importance score 0-1'),
});

const memoryRecallSchema = z.object({
  query: z.string().describe('Search query to find relevant memories'),
  category: z.string().optional().describe('Filter by memory category'),
  limit: z.number().optional().default(5).describe('Maximum number of results'),
});

const memoryForgetSchema = z.object({
  category: z.string().describe('Memory category'),
  key: z.string().describe('Memory key to delete'),
});

export const memoryStoreTool: Tool<typeof memoryStoreSchema> = {
  name: 'memory_store',
  description: 'Stores information in persistent memory for future reference across conversations. Use when learning farmer preferences, recording field observations, or saving important context that should persist between sessions.',
  schema: memoryStoreSchema,
  execute: async ({ category, key, value, importance }) => {
    const pool = getPool();
    if (!pool) return 'Memory storage unavailable — database not connected';

    const success = await persistentMemory.store({
      userId: 'system',
      category,
      key,
      value,
      importance,
    });

    return success
      ? `Memory stored successfully: ${category}:${key} (importance: ${importance})`
      : 'Failed to store memory';
  },
};

export const memoryRecallTool: Tool<typeof memoryRecallSchema> = {
  name: 'memory_recall',
  description: 'Recalls previously stored information from persistent memory. Use when you need to remember past interactions, farmer preferences, field history, or any previously saved context.',
  schema: memoryRecallSchema,
  execute: async ({ query, category, limit }) => {
    const memories = await persistentMemory.recall({
      userId: 'system',
      query,
      category,
      limit,
    });

    if (memories.length === 0) return 'No relevant memories found';

    return JSON.stringify(memories.map(m => ({
      key: m.key,
      category: m.category,
      value: m.value,
      importance: m.importance,
      lastAccessed: m.lastAccessedAt,
    })), null, 2);
  },
};

export const memoryForgetTool: Tool<typeof memoryForgetSchema> = {
  name: 'memory_forget',
  description: 'Deletes a specific memory entry. Use when information is outdated, incorrect, or no longer relevant.',
  schema: memoryForgetSchema,
  execute: async ({ category, key }) => {
    const success = await persistentMemory.forget('system', category, key);
    return success ? `Memory deleted: ${category}:${key}` : 'Failed to delete memory';
  },
};
