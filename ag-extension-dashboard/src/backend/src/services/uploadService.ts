import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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

export async function saveUpload(input: UploadInput): Promise<UploadResult> {
  if (input.buffer.length === 0 || input.buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 10MB upload limit');
  }

  const mimeType = normalizeMimeType(input.mimeType);
  if (!signatureMatches(input.buffer, mimeType)) {
    throw new Error('File content does not match the declared type');
  }

  const storageKey = `${crypto.randomUUID()}${UPLOAD_TYPES[mimeType]}`;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  const destination = path.join(uploadRoot, storageKey);
  const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

  await fs.mkdir(uploadRoot, { recursive: true });
  await fs.writeFile(destination, input.buffer, { flag: 'wx', mode: 0o600 });

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
  return fs.readFile(path.join(uploadRoot, path.basename(storageKey)));
}

export async function purgeStoredUpload(storageKey: string): Promise<void> {
  if (!/^[a-f0-9-]+\\.(jpg|png|gif|webp|pdf)$/i.test(storageKey)) return;
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  await fs.rm(path.join(uploadRoot, path.basename(storageKey)), { force: true });
}
