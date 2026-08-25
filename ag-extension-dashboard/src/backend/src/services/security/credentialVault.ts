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
      logger.warn(`Credential expired: ${name} (${category})`);
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

  private encrypt(value: string): string {
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  }

  private decrypt(encrypted: string): string {
    const key = crypto.createHash('sha256').update(this.encryptionKey).digest();
    const parts = encrypted.split(':');
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(parts[2], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    // Legacy XOR fallback for existing encrypted values
    let result = '';
    for (let i = 0; i < encrypted.length; i++) {
      result += String.fromCharCode(encrypted.charCodeAt(i) ^ key[i % key.length]);
    }
    return result;
  }

  private generateId(name: string, category: string): string {
    return `${category}:${name}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
  }
}

export const credentialVault = CredentialVault.getInstance();
