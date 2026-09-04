import crypto from 'crypto';
import path from 'path';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { assertNotMalicious } from '@/services/malwareScanService';
import { objectStorage } from '@/services/objectStorageService';

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 100) * 1024 * 1024;
/** Per-user total storage quota (bytes). Override with UPLOAD_QUOTA_MB. */
const USER_QUOTA_BYTES = Number(process.env.UPLOAD_QUOTA_MB || 500) * 1024 * 1024;

export const UPLOAD_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  // Documents
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  // Videos
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  // Audio
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
} as const;

export type SupportedMimeType = keyof typeof UPLOAD_TYPES;

function matchesImageSignature(buffer: Buffer, mimeType: SupportedMimeType): boolean {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/gif') {
    const head = buffer.subarray(0, 6).toString('ascii');
    return head === 'GIF87a' || head === 'GIF89a';
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'image/svg+xml') {
    const text = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trim().toLowerCase();
    const isSvg = text.includes('<svg') || (text.startsWith('<?xml') && text.includes('<svg'));
    const hasScript = text.includes('<script') || text.includes('javascript:');
    return isSvg && !hasScript;
  }
  return false;
}

function matchesDocumentSignature(buffer: Buffer, mimeType: SupportedMimeType): boolean {
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mimeType === 'text/csv' || mimeType === 'text/plain') {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    return !sample.some(b => b === 0);
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  if (mimeType === 'application/vnd.ms-excel' || mimeType === 'application/msword') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  return false;
}

function matchesVideoSignature(buffer: Buffer, mimeType: SupportedMimeType): boolean {
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    if (buffer.length >= 12) {
      const ftyp = buffer.subarray(4, 8).toString('ascii');
      return ftyp === 'ftyp' || ftyp === 'moov' || ftyp === 'wide' || ftyp === 'mdat';
    }
    return false;
  }
  if (mimeType === 'video/webm' || mimeType === 'video/x-matroska') {
    return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }
  return false;
}

function matchesAudioSignature(buffer: Buffer, mimeType: SupportedMimeType): boolean {
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') {
    return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mimeType === 'audio/webm') {
    return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }
  if (mimeType === 'audio/mpeg') {
    const isId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
    const isSync = buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return isId3 || isSync;
  }
  if (mimeType === 'audio/wav') {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  if (mimeType === 'audio/ogg') {
    return buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (mimeType === 'audio/aac') {
    const isAdts = buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0;
    const isId3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
    return isAdts || isId3;
  }
  return false;
}

export const signatureMatches = (buffer: Buffer, mimeType: SupportedMimeType): boolean => {
  if (buffer.length < 3) return false;
  if (mimeType.startsWith('image/')) return matchesImageSignature(buffer, mimeType);
  if (mimeType.startsWith('video/')) return matchesVideoSignature(buffer, mimeType);
  if (mimeType.startsWith('audio/')) return matchesAudioSignature(buffer, mimeType);
  return matchesDocumentSignature(buffer, mimeType);
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

export function normalizeMimeType(mimeType: string): SupportedMimeType {
  const lower = mimeType.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(UPLOAD_TYPES, lower)) {
    return lower as SupportedMimeType;
  }
  throw new Error('Unsupported file type');
}

function safeOriginalName(name: string): string {
  const basename = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return basename.slice(0, 255) || 'upload';
}

async function checkStorageQuota(ownerUserId: string, incomingBytes: number): Promise<void> {
  const usage = await query<{ used: string | number | null }>(
    'SELECT COALESCE(SUM(size_bytes), 0) AS used FROM upload_records WHERE owner_user_id = $1 AND status != $2',
    [ownerUserId, 'deleted']
  );
  const used = Number(usage.rows[0]?.used ?? 0);
  if (used + incomingBytes > USER_QUOTA_BYTES) {
    throw new Error(
      `Storage quota exceeded (${Math.round(used / 1024 / 1024)} MB of ${Math.round(USER_QUOTA_BYTES / 1024 / 1024)} MB used). Delete old uploads to free space.`
    );
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  if (input.buffer.length === 0 || input.buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB upload limit`);
  }

  const mimeType = normalizeMimeType(input.mimeType);
  if (!signatureMatches(input.buffer, mimeType)) {
    throw new Error('File content does not match the declared type');
  }

  // Quota check before writing or scanning
  await checkStorageQuota(input.ownerUserId, input.buffer.length);

  // Malware scan (ClamAV via CLAMD_HOST when configured)
  await assertNotMalicious(input.buffer);

  const storageKey = `${crypto.randomUUID()}${UPLOAD_TYPES[mimeType]}`;
  const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

  // Persist to unified object storage (Cloudflare R2, S3, B2, or Local Disk)
  const stored = await objectStorage.putObject({
    key: storageKey,
    buffer: input.buffer,
    contentType: mimeType,
    metadata: {
      ownerUserId: input.ownerUserId,
      farmerId: input.farmerId || '',
      originalName: safeOriginalName(input.originalName),
    },
  });

  try {
    const result = await query<{ id: string; tenant_id: string | null }>(
      `INSERT INTO upload_records
        (tenant_id, owner_user_id, farmer_id, storage_key, original_name, mime_type, size_bytes, sha256)
       SELECT u.tenant_id, $1, $2, $3, $4, $5, $6, $7
       FROM users u WHERE u.id = $1
       RETURNING id, tenant_id`,
      [
        input.ownerUserId,
        input.farmerId ?? null,
        storageKey,
        safeOriginalName(input.originalName),
        mimeType,
        input.buffer.length,
        sha256,
      ]
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
      url: stored.url,
    };
  } catch (error) {
    await objectStorage.deleteObject(storageKey);
    logger.error('Upload record creation failed:', error);
    throw error;
  }
}

export async function readStoredUpload(storageKey: string): Promise<Buffer> {
  const cleanKey = path.basename(storageKey);
  const ext = path.extname(cleanKey).toLowerCase();
  const validExtensions = Object.values(UPLOAD_TYPES);
  if (!validExtensions.includes(ext as (typeof validExtensions)[number])) {
    throw new Error('Invalid storage key');
  }

  return objectStorage.getObject(cleanKey);
}

export async function purgeStoredUpload(storageKey: string): Promise<void> {
  const cleanKey = path.basename(storageKey);
  await objectStorage.deleteObject(cleanKey);
}

export async function createDirectUploadPresign(params: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  ownerUserId: string;
  farmerId?: string;
}): Promise<{ uploadUrl: string; storageKey: string; publicUrl?: string | null }> {
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(`File size must be between 1 byte and ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`);
  }

  const mimeType = normalizeMimeType(params.mimeType);
  await checkStorageQuota(params.ownerUserId, params.sizeBytes);

  const storageKey = `${crypto.randomUUID()}${UPLOAD_TYPES[mimeType]}`;
  const uploadUrl = await objectStorage.getPresignedUploadUrl({
    key: storageKey,
    contentType: mimeType,
    expiresInSeconds: 3600,
  });

  const config = objectStorage.getConfig();
  const publicUrl = config.publicUrl ? `${config.publicUrl.replace(/\/+$/, '')}/${storageKey}` : null;

  await query(
    `INSERT INTO upload_records
      (tenant_id, owner_user_id, farmer_id, storage_key, original_name, mime_type, size_bytes, sha256, status)
     SELECT u.tenant_id, $1, $2, $3, $4, $5, $6, $7, 'pending'
     FROM users u WHERE u.id = $1`,
    [
      params.ownerUserId,
      params.farmerId ?? null,
      storageKey,
      safeOriginalName(params.originalName),
      mimeType,
      params.sizeBytes,
      'pending',
    ]
  );

  return { uploadUrl, storageKey, publicUrl };
}

export async function confirmDirectUpload(storageKey: string, ownerUserId: string): Promise<UploadResult> {
  const cleanKey = path.basename(storageKey);
  const exists = await objectStorage.hasObject(cleanKey);
  if (!exists) {
    throw new Error('Object not found in storage. Ensure direct upload finished before confirming.');
  }

  const result = await query<{
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    sha256: string;
  }>(
    `UPDATE upload_records
     SET status = 'active'
     WHERE storage_key = $1 AND owner_user_id = $2
     RETURNING id, original_name, mime_type, size_bytes, sha256`,
    [cleanKey, ownerUserId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Upload record not found or not owned by user');
  }

  const config = objectStorage.getConfig();
  const publicUrl = config.publicUrl ? `${config.publicUrl.replace(/\/+$/, '')}/${cleanKey}` : null;

  return {
    id: row.id,
    storageKey: cleanKey,
    originalName: row.original_name,
    mimeType: row.mime_type as SupportedMimeType,
    size: row.size_bytes,
    sha256: row.sha256,
    url: publicUrl || `/api/v1/upload/file/${cleanKey}`,
  };
}
