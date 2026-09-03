import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { assertNotMalicious } from '@/services/malwareScanService';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Per-user total storage quota (bytes). Override with UPLOAD_QUOTA_MB. */
export const USER_QUOTA_BYTES = Number(process.env.UPLOAD_QUOTA_MB || 500) * 1024 * 1024;

const UPLOAD_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
} as const;

type SupportedMimeType = keyof typeof UPLOAD_TYPES;

const signatureMatches = (buffer: Buffer, mimeType: SupportedMimeType): boolean => {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/gif') return buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a';
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
};

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  ownerUserId: string;
  farmerId?: string;
}

export interface UploadResult {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: SupportedMimeType;
  size: number;
  sha256: string;
  url: string;
}

function normalizeMimeType(mimeType: string): SupportedMimeType {
  if (Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, mimeType)) {
    return mimeType as SupportedMimeType;
  }
  throw new Error('Unsupported file type');
}

function safeOriginalName(name: string): string {
  const basename = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return basename.slice(0, 255) || 'upload';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  if (input.buffer.length === 0 || input.buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 10MB upload limit');
  }

  const mimeType = normalizeMimeType(input.mimeType);
  if (!signatureMatches(input.buffer, mimeType)) {
    throw new Error('File content does not match the declared type');
  }

  // Per-user storage quota: prevents a single account from filling the disk/bucket.
  const usage = await query<{ used: string | number | null }>(
    'SELECT COALESCE(SUM(size_bytes), 0) AS used FROM upload_records WHERE owner_user_id = $1',
    [input.ownerUserId]
  );
  const used = Number(usage.rows[0]?.used ?? 0);
  if (used + input.buffer.length > USER_QUOTA_BYTES) {
    throw new Error(`Storage quota exceeded (${Math.round(used / 1024 / 1024)} MB of ${Math.round(USER_QUOTA_BYTES / 1024 / 1024)} MB used). Delete old uploads to free space.`);
  }

  // Malware scan (ClamAV via CLAMD_HOST). Magic-byte checks above only prove the
  // container format; they say nothing about embedded payloads.
  await assertNotMalicious(input.buffer);

  const storageKey = `${crypto.randomUUID()}${UPLOAD_TYPES[mimeType]}`;
  const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

  // Storage backend: local disk (default) or S3 when STORAGE_BACKEND=s3.
  // Invariant: the DB row below is written only after the bytes are durably
  // stored somewhere — never record an upload that landed nowhere.
  const useS3 = process.env.STORAGE_BACKEND === 's3' && process.env.S3_BUCKET;
  let persistedTo: 's3' | 'local' | null = null;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  const destination = path.join(uploadRoot, storageKey);

  if (useS3) {
      // Dynamic import so build passes without @aws-sdk installed; install it when S3 is needed
      const s3mod = await import('@aws-sdk/client-s3' as unknown as string).catch(() => null) as unknown as { S3Client: new (o: unknown) => { send: (c: unknown) => Promise<void> }; PutObjectCommand: new (o: unknown) => unknown } | null;
      if (!s3mod?.S3Client || !s3mod?.PutObjectCommand) {
          throw new Error('STORAGE_BACKEND=s3 but @aws-sdk/client-s3 is not installed');
      }
      try {
          const client = new s3mod.S3Client({ region: process.env.S3_REGION || 'us-east-1' });
          await client.send(new s3mod.PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `uploads/${storageKey}`, Body: input.buffer, ContentType: mimeType }));
          persistedTo = 's3';
      } catch (err) {
          logger.error('S3 upload failed:', err);
          throw new Error(`S3 upload failed: ${(err as Error).message}`);
      }
      // Best-effort local cache for immediate reads; S3 is primary so failure is non-fatal but logged.
      try {
          await fs.mkdir(uploadRoot, { recursive: true });
          await fs.writeFile(destination, input.buffer, { flag: 'wx', mode: 0o600 });
      } catch (err) {
          logger.warn('Local upload cache write failed (S3 copy is authoritative):', err);
      }
  } else {
      await fs.mkdir(uploadRoot, { recursive: true });
      await fs.writeFile(destination, input.buffer, { flag: 'wx', mode: 0o600 });
      persistedTo = 'local';
  }
  if (!persistedTo) throw new Error('Upload was not persisted to any storage backend');

  try {
    const result = await query<{ id: string; tenant_id: string | null }>(
      `INSERT INTO upload_records
        (tenant_id, owner_user_id, farmer_id, storage_key, original_name, mime_type, size_bytes, sha256)
       SELECT u.tenant_id, $1, $2, $3, $4, $5, $6, $7
       FROM users u WHERE u.id = $1
       RETURNING id, tenant_id`,
      [input.ownerUserId, input.farmerId ?? null, storageKey, safeOriginalName(input.originalName), mimeType, input.buffer.length, sha256]
    );

    const row = result.rows[0];
    if (!row) throw new Error('Upload owner was not found');

    return {
      id: row.id,
      storageKey,
      originalName: safeOriginalName(input.originalName),
      mimeType,
      size: input.buffer.length,
      sha256,
      url: `/api/v1/upload/file/${storageKey}`,
    };
  } catch (error) {
    await fs.rm(destination, { force: true });
    logger.error('Upload record creation failed:', error);
    throw error;
  }
}

export async function readStoredUpload(storageKey: string): Promise<Buffer> {
  if (!/^[a-f0-9-]+\\.(jpg|png|gif|webp|pdf)$/i.test(storageKey)) {
    throw new Error('Invalid storage key');
  }
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  try {
      return await fs.readFile(path.join(uploadRoot, path.basename(storageKey)));
  } catch {
      // Try S3 fallback when configured
      if (process.env.STORAGE_BACKEND === 's3' && process.env.S3_BUCKET) {
          try {
              const s3mod = await import('@aws-sdk/client-s3' as unknown as string).catch(() => null) as unknown as { S3Client: new (o: unknown) => { send: (c: unknown) => Promise<{ Body: { transformToByteArray: () => Promise<Uint8Array> } }> }; GetObjectCommand: new (o: unknown) => unknown } | null;
              if (s3mod?.S3Client && s3mod?.GetObjectCommand) {
                  const client = new s3mod.S3Client({ region: process.env.S3_REGION || 'us-east-1' });
                  const res = await client.send(new s3mod.GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `uploads/${storageKey}` }));
                  return Buffer.from(await res.Body.transformToByteArray());
              }
          } catch { /* ignore S3 errors */ }
      }
      throw new Error('File not found');
  }
}

export async function purgeStoredUpload(storageKey: string): Promise<void> {
  if (!/^[a-f0-9-]+\\.(jpg|png|gif|webp|pdf)$/i.test(storageKey)) return;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  await fs.rm(path.join(uploadRoot, path.basename(storageKey)), { force: true });
}
