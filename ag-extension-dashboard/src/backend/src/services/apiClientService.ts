/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '@/services/databaseService';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { UserRole } from '@/middleware/authorize';

export interface ApiClientRecord {
    id: string;
    ownerUserId: string;
    name: string;
    status: string;
    monthlyQuota: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
}

export interface ApiKeyValidationResult {
    client: ApiClientRecord;
    apiKeyId: string;
    keyPrefix: string;
}

export interface CommercialAuthRequest extends Request {
    commercialAuth?: {
        type: 'jwt' | 'api_key';
        userId: string;
        role: UserRole;
        clientId?: string;
        apiKeyId?: string;
    };
}

function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function randomSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
}

class ApiClientService {
    private initialized = false;

    async ensureTables(): Promise<void> {
        if (this.initialized) return;

        await query(`
            CREATE TABLE IF NOT EXISTS api_clients (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'active',
                monthly_quota INTEGER NOT NULL DEFAULT 1000,
                current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
                current_period_end TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                key_prefix VARCHAR(80) NOT NULL,
                key_hash VARCHAR(128) NOT NULL UNIQUE,
                status VARCHAR(30) NOT NULL DEFAULT 'active',
                last_used_at TIMESTAMP,
                expires_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS api_usage_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
                api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
                endpoint VARCHAR(160) NOT NULL,
                units INTEGER NOT NULL DEFAULT 1,
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await query('CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)');
        await query('CREATE INDEX IF NOT EXISTS idx_api_usage_client_period ON api_usage_events(client_id, created_at)');
        this.initialized = true;
    }

    async createClient(ownerUserId: string, name: string, monthlyQuota: number = 1000, keyName: string = 'Default key') {
        await this.ensureTables();
        const clientResult = await query(`
            INSERT INTO api_clients (owner_user_id, name, monthly_quota)
            VALUES ($1, $2, $3)
            RETURNING id, owner_user_id, name, status, monthly_quota, current_period_start, current_period_end, created_at
        `, [ownerUserId, name, monthlyQuota]);

        const client = clientResult.rows[0];
        const apiKey = await this.createKey(client.id, keyName);
        return { client, apiKey };
    }

    async createKey(clientId: string, name: string, expiresAt?: string) {
        await this.ensureTables();
        const secret = randomSecret();
        const token = `agx_${clientId}.${secret}`;
        const prefix = token.slice(0, 22);
        const keyHash = sha256(token);

        const result = await query(`
            INSERT INTO api_keys (client_id, name, key_prefix, key_hash, expires_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, client_id, name, key_prefix, status, expires_at, created_at
        `, [clientId, name, prefix, keyHash, expiresAt || null]);

        return { ...result.rows[0], token };
    }

    async listClients(ownerUserId?: string) {
        await this.ensureTables();
        const params: any[] = [];
        let where = '';
        if (ownerUserId) {
            params.push(ownerUserId);
            where = 'WHERE owner_user_id = $1';
        }

        const result = await query(`
            SELECT c.*, COALESCE(SUM(u.units), 0)::int AS current_usage,
                   COUNT(k.id)::int AS key_count
            FROM api_clients c
            LEFT JOIN api_usage_events u ON u.client_id = c.id
                AND u.created_at >= c.current_period_start
                AND u.created_at < c.current_period_end
            LEFT JOIN api_keys k ON k.client_id = c.id AND k.status = 'active'
            ${where}
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, params);
        return result.rows;
    }

    async listKeys(clientId: string) {
        await this.ensureTables();
        const result = await query(`
            SELECT id, client_id, name, key_prefix, status, last_used_at, expires_at, created_at
            FROM api_keys
            WHERE client_id = $1
            ORDER BY created_at DESC
        `, [clientId]);
        return result.rows;
    }

    async revokeKey(keyId: string) {
        await this.ensureTables();
        const result = await query(`
            UPDATE api_keys SET status = 'revoked', updated_at = NOW()
            WHERE id = $1
            RETURNING id, client_id, name, key_prefix, status
        `, [keyId]);
        return result.rows[0] || null;
    }

    async validateApiKey(token: string): Promise<ApiKeyValidationResult | null> {
        await this.ensureTables();
        const [clientPart] = token.replace(/^Bearer\s+/i, '').split('.');
        const clientId = clientPart?.replace(/^agx_/, '');
        if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) return null;

        const keyHash = sha256(token.replace(/^Bearer\s+/i, ''));
        const result = await query(`
            SELECT k.id AS api_key_id, k.key_prefix, k.expires_at,
                   c.id, c.owner_user_id, c.name, c.status, c.monthly_quota, c.current_period_start, c.current_period_end
            FROM api_keys k
            JOIN api_clients c ON c.id = k.client_id
            WHERE c.id = $1 AND k.key_hash = $2 AND k.status = 'active' AND c.status = 'active'
            LIMIT 1
        `, [clientId, keyHash]);

        const row = result.rows[0];
        if (!row) return null;
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;

        await query('UPDATE api_keys SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1', [row.api_key_id]);

        return {
            apiKeyId: row.api_key_id,
            keyPrefix: row.key_prefix,
            client: {
                id: row.id,
                ownerUserId: row.owner_user_id,
                name: row.name,
                status: row.status,
                monthlyQuota: row.monthly_quota,
                currentPeriodStart: row.current_period_start,
                currentPeriodEnd: row.current_period_end
            }
        };
    }

    async checkAndRecordUsage(clientId: string, apiKeyId: string | undefined, endpoint: string, units: number = 1, metadata: any = {}) {
        await this.ensureTables();
        const clientResult = await query('SELECT * FROM api_clients WHERE id = $1', [clientId]);
        const client = clientResult.rows[0];
        if (!client || client.status !== 'active') return { allowed: false, current: 0, limit: 0 };

        let periodStart = new Date(client.current_period_start);
        let periodEnd = new Date(client.current_period_end);
        if (periodEnd.getTime() <= Date.now()) {
            const updated = await query(`
                UPDATE api_clients
                SET current_period_start = NOW(), current_period_end = NOW() + INTERVAL '1 month', updated_at = NOW()
                WHERE id = $1
                RETURNING current_period_start, current_period_end
            `, [clientId]);
            periodStart = updated.rows[0].current_period_start;
            periodEnd = updated.rows[0].current_period_end;
        }

        const usageResult = await query(`
            SELECT COALESCE(SUM(units), 0)::int AS used
            FROM api_usage_events
            WHERE client_id = $1 AND created_at >= $2 AND created_at < $3
        `, [clientId, periodStart, periodEnd]);
        const current = parseInt(usageResult.rows[0]?.used || '0', 10);
        const limit = client.monthly_quota;
        const allowed = limit === -1 || current + units <= limit;
        if (!allowed) return { allowed, current, limit };

        await query(`
            INSERT INTO api_usage_events (client_id, api_key_id, endpoint, units, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `, [clientId, apiKeyId || null, endpoint, units, metadata]);

        return { allowed: true, current: current + units, limit };
    }
}

export const apiClientService = new ApiClientService();

export async function authenticateCommercialAccess(req: CommercialAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const apiKey = req.header('x-api-key') || (req.header('authorization')?.startsWith('Bearer agx_') ? req.header('authorization')!.replace(/^Bearer\s+/, '') : undefined);

        if (apiKey) {
            const validation = await apiClientService.validateApiKey(apiKey);
            if (!validation) {
                res.status(401).json({ success: false, error: 'Invalid or inactive API key' });
                return;
            }

            req.commercialAuth = {
                type: 'api_key',
                userId: validation.client.ownerUserId,
                role: 'extension_officer',
                clientId: validation.client.id,
                apiKeyId: validation.apiKeyId
            };
            return next();
        }

        const authHeader = req.header('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Bearer token or x-api-key required' });
            return;
        }

        const decoded = jwt.verify(authHeader.split(' ')[1], config.jwt.secret as jwt.Secret) as { userId: string; role: UserRole; email: string };
        req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
        req.commercialAuth = { type: 'jwt', userId: decoded.userId, role: decoded.role };
        next();
    } catch (error) {
        logger.error('Commercial API authentication failed:', error);
        res.status(401).json({ success: false, error: 'Commercial API authentication failed' });
    }
}
