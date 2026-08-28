/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, getPool } from '@/services/databaseService';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

export interface MemoryEntry {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  embedding: number[];
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  importance: number;
}

export interface MemoryQuery {
  userId: string;
  query: string;
  category?: string;
  limit?: number;
}

/** Raw `agent_memories` row shape as returned by `pg`. */
interface MemoryRow {
  id: string;
  user_id: string;
  category: string;
  key: string;
  value: string;
  embedding: string | null;
  created_at: Date | string;
  last_accessed_at: Date | string;
  access_count: number;
  importance: number;
}

interface MemorySummaryRow {
  category: string;
  count: string;
  avg_importance: string | null;
}

class PersistentMemory {
  private static instance: PersistentMemory;
  private initialized = false;

  static getInstance(): PersistentMemory {
    if (!PersistentMemory.instance) {
      PersistentMemory.instance = new PersistentMemory();
    }
    return PersistentMemory.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const pool = getPool();
      if (!pool) {
        logger.warn('Cannot initialize persistent memory — database unavailable');
        return;
      }

      await query(`
        CREATE TABLE IF NOT EXISTS agent_memories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL DEFAULT 'general',
          key VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          embedding FLOAT[],
          created_at TIMESTAMP DEFAULT NOW(),
          last_accessed_at TIMESTAMP DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          importance FLOAT DEFAULT 0.5,
          UNIQUE(user_id, category, key)
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_agent_memories_user_category 
        ON agent_memories(user_id, category)
      `);

      this.initialized = true;
      logger.info('Persistent memory initialized');
    } catch (error) {
      logger.error('Failed to initialize persistent memory:', error);
    }
  }

  async store(entry: {
    userId: string;
    category: string;
    key: string;
    value: string;
    importance?: number;
  }): Promise<boolean> {
    try {
      const pool = getPool();
      if (!pool) return false;

      const embedding = await this.generateEmbedding(entry.value);

      await query(`
        INSERT INTO agent_memories (user_id, category, key, value, embedding, importance)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, category, key) 
        DO UPDATE SET value = $4, embedding = $5, importance = $6, last_accessed_at = NOW()
      `, [
        entry.userId,
        entry.category,
        entry.key,
        entry.value,
        embedding ? `[${embedding.join(',')}]` : null,
        entry.importance || 0.5,
      ]);

      logger.debug(`Memory stored: ${entry.category}:${entry.key} for user ${entry.userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to store memory:', error);
      return false;
    }
  }

  async recall(queryData: MemoryQuery): Promise<MemoryEntry[]> {
    try {
      const pool = getPool();
      if (!pool) return [];

      const limit = queryData.limit || 10;

      if (queryData.query) {
        const queryEmbedding = await this.generateEmbedding(queryData.query);

        if (queryEmbedding && queryData.category) {
          const result = await query<MemoryRow>(`
            SELECT id, user_id, category, key, value, created_at, last_accessed_at, access_count, importance
            FROM agent_memories
            WHERE user_id = $2 AND category = $3
            ORDER BY importance DESC, last_accessed_at DESC
            LIMIT $4
          `, [queryData.userId, queryData.category, limit]);

          return result.rows.map(this.mapRow);
        }

        if (queryEmbedding) {
          const result = await query<MemoryRow>(`
            SELECT id, user_id, category, key, value, created_at, last_accessed_at, access_count, importance
            FROM agent_memories
            WHERE user_id = $1
            ORDER BY importance DESC, last_accessed_at DESC
            LIMIT $2
          `, [queryData.userId, limit]);

          return result.rows.map(this.mapRow);
        }
      }

      if (queryData.category) {
        const result = await query<MemoryRow>(`
          SELECT id, user_id, category, key, value, created_at, last_accessed_at, access_count, importance
          FROM agent_memories
          WHERE user_id = $1 AND category = $2
          ORDER BY importance DESC, last_accessed_at DESC
          LIMIT $3
        `, [queryData.userId, queryData.category, limit]);

        return result.rows.map(this.mapRow);
      }

      const result = await query<MemoryRow>(`
        SELECT id, user_id, category, key, value, created_at, last_accessed_at, access_count, importance
        FROM agent_memories
        WHERE user_id = $1
        ORDER BY importance DESC, last_accessed_at DESC
        LIMIT $2
      `, [queryData.userId, limit]);

      return result.rows.map(this.mapRow);
    } catch (error) {
      logger.error('Failed to recall memory:', error);
      return [];
    }
  }

  async updateImportance(userId: string, category: string, key: string, importance: number): Promise<boolean> {
    try {
      const pool = getPool();
      if (!pool) return false;

      await query(`
        UPDATE agent_memories 
        SET importance = $1, last_accessed_at = NOW(), access_count = access_count + 1
        WHERE user_id = $2 AND category = $3 AND key = $4
      `, [importance, userId, category, key]);

      return true;
    } catch (error) {
      logger.error('Failed to update memory importance:', error);
      return false;
    }
  }

  async forget(userId: string, category: string, key: string): Promise<boolean> {
    try {
      const pool = getPool();
      if (!pool) return false;

      await query(`
        DELETE FROM agent_memories 
        WHERE user_id = $1 AND category = $2 AND key = $3
      `, [userId, category, key]);

      return true;
    } catch (error) {
      logger.error('Failed to forget memory:', error);
      return false;
    }
  }

  async getMemorySummary(userId: string): Promise<{ category: string; count: number; avgImportance: number }[]> {
    try {
      const pool = getPool();
      if (!pool) return [];

      const result = await query<MemorySummaryRow>(`
        SELECT category, COUNT(*) as count, AVG(importance) as avg_importance
        FROM agent_memories
        WHERE user_id = $1
        GROUP BY category
        ORDER BY count DESC
      `, [userId]);

      return result.rows.map((row) => ({
        category: row.category,
        count: parseInt(row.count),
        avgImportance: parseFloat(row.avg_importance ?? '0'),
      }));
    } catch (error) {
      logger.error('Failed to get memory summary:', error);
      return [];
    }
  }

  async cleanupOldMemories(daysOld = 90): Promise<number> {
    try {
      const pool = getPool();
      if (!pool) return 0;

      const result = await query(`
        DELETE FROM agent_memories 
        WHERE last_accessed_at < NOW() - INTERVAL '${daysOld} days'
        AND importance < 0.3
      `);

      const deleted = result.rowCount || 0;
      if (deleted > 0) {
        logger.info(`Cleaned up ${deleted} old low-importance memories`);
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup old memories:', error);
      return 0;
    }
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const provider = await AIProviderFactory.getProvider();
      if (!provider.capabilities.includes('embeddings')) return null;

      const result = await provider.createEmbedding(text.substring(0, 8000));
      return result.embedding;
    } catch (error) {
      logger.warn('Failed to generate embedding:', error);
      return null;
    }
  }

  /** Normalize a pg timestamp to the ISO string the service exposes. */
  private static toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private mapRow(row: MemoryRow): MemoryEntry {
    let emb: number[] = [];
    if (row.embedding) {
      try {
        if (typeof row.embedding === 'string') {
          emb = row.embedding.startsWith('[')
            ? JSON.parse(row.embedding)
            : row.embedding.replace(/[{}]/g, '').split(',').map(Number).filter(n => !isNaN(n));
        } else if (Array.isArray(row.embedding)) {
          emb = row.embedding;
        }
      } catch {
        emb = [];
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      key: row.key,
      value: row.value,
      embedding: emb,
      createdAt: PersistentMemory.toIsoString(row.created_at),
      lastAccessedAt: PersistentMemory.toIsoString(row.last_accessed_at),
      accessCount: row.access_count,
      importance: row.importance,
    };
  }
}

export const persistentMemory = PersistentMemory.getInstance();
