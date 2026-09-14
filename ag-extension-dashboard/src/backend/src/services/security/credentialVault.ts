import { logger } from '@/utils/logger';
import * as crypto from 'crypto';

export interface CredentialRecord {
  id: string;
  name: string;
  category: string;
  encrypted: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  rotationDays: number;
  expiresAt: string;
}

class CredentialVault {
  /**
   * Paging-grade log resilient to partial logger doubles: prefers
   * logger.crit, degrades to a tagged error when absent.
   */
  private logCrit(message: string): void {
    const maybeCrit = (logger as unknown as { crit?: unknown }).crit;
    if (typeof maybeCrit === 'function') {
      (maybeCrit as (msg: string) => void).call(logger, message);
    } else {
      logger.error(`[CRIT] ${message}`);
    }
  }
  private static instance: CredentialVault;
  private credentials: Map<string, CredentialRecord> = new Map();
  private encryptionKey: string;
  private accessLog: Array<{ credentialId: string; accessedAt: string; accessor: string }> = [];

  constructor() {
    const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (envKey && envKey.length >= 32) {
      this.encryptionKey = envKey;
    } else {
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
      logger.warn('CREDENTIAL_ENCRYPTION_KEY not set or too short — using runtime-generated key (not persistent across restarts)');
    }
  }

  static getInstance(): CredentialVault {
    if (!CredentialVault.instance) {
      CredentialVault.instance = new CredentialVault();
    }
    return CredentialVault.instance;
  }

  storeCredential(name: string, category: string, value: string, rotationDays = 90): string {
    const id = this.generateId(name, category);
    const encrypted = this.encrypt(value);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + rotationDays * 24 * 60 * 60 * 1000).toISOString();

    this.credentials.set(id, {
      id,
      name,
      category,
      encrypted,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      rotationDays,
      expiresAt,
    });

    logger.info(`Credential stored: ${name} (${category})`);
    return id;
  }

  getCredential(name: string, category: string): string | null {
    const id = this.generateId(name, category);
    const record = this.credentials.get(id);

    if (!record) {
      logger.warn(`Credential not found: ${name} (${category})`);
      return null;
    }

    if (new Date(record.expiresAt) < new Date()) {
      // CRIT: an expired credential was requested — rotation is overdue and
      // someone must act. Paging/monitoring should fire on this level.
      this.logCrit(`Credential expired and requested (rotation overdue): ${name} (${category})`);
      return null;
    }
    record.accessCount++;
    record.lastAccessedAt = new Date().toISOString();
    this.credentials.set(id, record);

    this.accessLog.push({
      credentialId: id,
      accessedAt: new Date().toISOString(),
      accessor: 'system',
    });

    return this.decrypt(record.encrypted);
  }

  /**
   * Strict read: throws on missing or expired credentials instead of
   * returning null, so callers cannot silently run with absent secrets.
   * Rotation is enforced by expiry — expired credentials must be rotated
   * via storeCredential/rotateCredential before use.
   */
  getCredentialOrThrow(name: string, category: string): string {
    const id = this.generateId(name, category);
    const record = this.credentials.get(id);
    if (!record) throw new Error(`Credential not found: ${name} (${category})`);
    if (new Date(record.expiresAt) < new Date()) {
      this.logCrit(`Credential expired and requested via strict read (rotation overdue): ${name} (${category})`);
      throw new Error(`Credential expired and must be rotated: ${name} (${category})`);
    }
    return this.getCredential(name, category) as string;
  }

  /** Credentials past expiry that must be rotated before further use. */
  listOverdueCredentials(): CredentialRecord[] {
    const now = new Date();
    return Array.from(this.credentials.values()).filter(cred => new Date(cred.expiresAt) < now);
  }

  rotateCredential(name: string, category: string, newValue: string): boolean {
    const id = this.generateId(name, category);
    const existing = this.credentials.get(id);
    if (!existing) return false;

    existing.encrypted = this.encrypt(newValue);
    existing.createdAt = new Date().toISOString();
    existing.expiresAt = new Date(Date.now() + existing.rotationDays * 24 * 60 * 60 * 1000).toISOString();
    existing.accessCount = 0;

    this.credentials.set(id, existing);
    logger.info(`Credential rotated: ${name} (${category})`);
    return true;
  }

  revokeCredential(name: string, category: string): boolean {
    const id = this.generateId(name, category);
    const deleted = this.credentials.delete(id);
    if (deleted) {
      logger.info(`Credential revoked: ${name} (${category})`);
    }
    return deleted;
  }

  getExpiringCredentials(daysThreshold = 7): CredentialRecord[] {
    const threshold = Date.now() + daysThreshold * 24 * 60 * 60 * 1000;
    return Array.from(this.credentials.values()).filter(
      cred => new Date(cred.expiresAt).getTime() < threshold
    );
  }

  getAccessLog(credentialId?: string): typeof this.accessLog {
    if (credentialId) {
      return this.accessLog.filter(entry => entry.credentialId === credentialId);
    }
    return [...this.accessLog];
  }

  getAllCredentialsSummary(): Array<{ name: string; category: string; expiresAt: string; accessCount: number }> {
    return Array.from(this.credentials.values()).map(cred => ({
      name: cred.name,
      category: cred.category,
      expiresAt: cred.expiresAt,
      accessCount: cred.accessCount,
    }));
  }

  private deriveKey(salt: Buffer): Buffer {
    // scrypt with per-value salt replaces the previous single-SHA-256 stretch.
    return crypto.scryptSync(this.encryptionKey, salt, 32);
  }

  private encrypt(value: string): string {
    const salt = crypto.randomBytes(16);
    const key = this.deriveKey(salt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return ['v2', salt.toString('hex'), iv.toString('hex'), authTag, encrypted].join(':');
  }

  private decryptV1(parts: string[]): string {
    // Pre-scrypt rows (iv:tag:data with SHA-256-stretched key). Decrypt once for
    // transparent upgrade; callers re-encrypt to v2 on next store/rotate.
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts[0] === 'v2' && parts.length === 5) {
      const key = this.deriveKey(Buffer.from(parts[1], 'hex'));
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[2], 'hex'));
      decipher.setAuthTag(Buffer.from(parts[3], 'hex'));
      let decrypted = decipher.update(parts[4], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    if (parts.length === 3) {
      logger.warn('Credential in retired v1 format — decrypting once for upgrade; re-encrypting to v2');
      return this.decryptV1(parts);
    }
    // Legacy XOR rows are no longer decryptable in-process. They must be
    // rotated via storeCredential; failing loudly avoids silent weak-crypto use.
    throw new Error('Credential uses retired legacy encryption and must be rotated via storeCredential');
  }

  private generateId(name: string, category: string): string {
    return `${category}:${name}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
  }
}

export const credentialVault = CredentialVault.getInstance();
