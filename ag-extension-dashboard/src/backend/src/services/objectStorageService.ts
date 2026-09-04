import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { logger } from '@/utils/logger';

export type StorageBackendType =
  | 'cloudflare-r2'
  | 'backblaze-b2'
  | 'wasabi'
  | 'hetzner'
  | 'aws-s3'
  | 'minio'
  | 'local-disk';

interface StorageConfig {
  backend: StorageBackendType;
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  forcePathStyle?: boolean;
  localUploadDir: string;
  localCacheEnabled: boolean;
}

interface PutObjectOptions {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

interface StoredObjectMetadata {
  key: string;
  sizeBytes: number;
  contentType: string;
  sha256: string;
  etag?: string;
  url: string;
  publicUrl?: string | null;
  storageBackend: StorageBackendType;
  lastModified?: Date;
}

interface PresignedUrlOptions {
  key: string;
  contentType?: string;
  expiresInSeconds?: number;
  filename?: string;
}

const BACKEND_RULES: Array<{
  type: StorageBackendType;
  matches: (norm: string, endpoint?: string) => boolean;
}> = [
  {
    type: 'local-disk',
    matches: (norm) => ['local', 'local-disk', 'disk'].includes(norm),
  },
  {
    type: 'backblaze-b2',
    matches: (norm, ep) => ['b2', 'backblaze', 'backblaze-b2'].includes(norm) || Boolean(ep?.includes('backblazeb2.com')),
  },
  {
    type: 'cloudflare-r2',
    matches: (norm, ep) => ['r2', 'cloudflare', 'cloudflare-r2'].includes(norm) || Boolean(ep?.includes('r2.cloudflarestorage.com')),
  },
  {
    type: 'wasabi',
    matches: (norm, ep) => norm === 'wasabi' || Boolean(ep?.includes('wasabisys.com')),
  },
  {
    type: 'hetzner',
    matches: (norm, ep) => norm === 'hetzner' || Boolean(ep?.includes('hetzner.com') || ep?.includes('your-objectstorage.com')),
  },
  {
    type: 'minio',
    matches: (norm, ep) => norm === 'minio' || Boolean(ep?.includes('localhost') || ep?.includes('127.0.0.1')),
  },
  {
    type: 'aws-s3',
    matches: (norm) => ['s3', 'aws-s3', 'aws'].includes(norm),
  },
];

export function resolveBackendType(
  bucket: string,
  accessKeyId?: string,
  endpoint?: string,
  rawBackend?: string
): StorageBackendType {
  const norm = (rawBackend || '').toLowerCase().trim();

  for (const rule of BACKEND_RULES) {
    if (rule.matches(norm, endpoint)) {
      return rule.type;
    }
  }

  if (!bucket || (!accessKeyId && !endpoint)) {
    return 'local-disk';
  }

  return 'aws-s3';
}

class ObjectStorageService {
  private static instance: ObjectStorageService | null = null;
  private s3Client: S3Client | null = null;
  private config: StorageConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.initClient();
  }

  public static getInstance(): ObjectStorageService {
    if (!ObjectStorageService.instance) {
      ObjectStorageService.instance = new ObjectStorageService();
    }
    return ObjectStorageService.instance;
  }

  private loadConfig(): StorageConfig {
    const rawBackend = (process.env.STORAGE_BACKEND || '').toLowerCase();
    const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || undefined;
    const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || '';
    const region = process.env.S3_REGION || process.env.R2_REGION || 'auto';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || undefined;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || undefined;
    const publicUrl = process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || process.env.CDN_URL || undefined;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    const localUploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
    const localCacheEnabled = process.env.LOCAL_CACHE_ENABLED !== 'false';
    const backend = resolveBackendType(bucket, accessKeyId, endpoint, rawBackend);

    return {
      backend,
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicUrl,
      forcePathStyle,
      localUploadDir,
      localCacheEnabled,
    };
  }

  private initClient(): void {
    if (this.config.backend === 'local-disk' || !this.config.bucket) {
      this.s3Client = null;
      return;
    }

    try {
      this.s3Client = new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint,
        credentials: (this.config.accessKeyId && this.config.secretAccessKey) ? {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        } : undefined,
        forcePathStyle: this.config.forcePathStyle || this.config.backend === 'minio',
      });
      logger.info(`[ObjectStorage] Initialized ${this.config.backend} client (Bucket: ${this.config.bucket})`);
    } catch (error) {
      logger.error('[ObjectStorage] Failed to initialize S3 client, falling back to local disk:', error);
      this.s3Client = null;
      this.config.backend = 'local-disk';
    }
  }

  public isCloudConfigured(): boolean {
    return this.s3Client !== null && Boolean(this.config.bucket);
  }

  public getBackendType(): StorageBackendType {
    return this.config.backend;
  }

  public getConfig(): Readonly<StorageConfig> {
    return { ...this.config };
  }

  private sanitizeKey(key: string): string {
    return key.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private getLocalPath(key: string): string {
    const cleanKey = this.sanitizeKey(key);
    return path.join(this.config.localUploadDir, cleanKey);
  }

  private async ensureParentDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  public async putObject(options: PutObjectOptions): Promise<StoredObjectMetadata> {
    const key = this.sanitizeKey(options.key);
    const sha256 = crypto.createHash('sha256').update(options.buffer).digest('hex');
    let etag: string | undefined;

    if (this.s3Client && this.config.bucket) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: options.buffer,
          ContentType: options.contentType,
          Metadata: options.metadata,
        });
        const res = await this.s3Client.send(command);
        etag = res.ETag?.replace(/"/g, '');
      } catch (err) {
        logger.error(`[ObjectStorage] Cloud upload failed for key ${key}:`, err);
        throw new Error(`Object storage upload failed: ${(err as Error).message}`);
      }
    }

    // Write to local cache / local storage
    if (this.config.localCacheEnabled || !this.s3Client) {
      try {
        const localPath = this.getLocalPath(key);
        await this.ensureParentDir(localPath);
        await fs.writeFile(localPath, options.buffer, { mode: 0o600 });
      } catch (err) {
        if (!this.s3Client) {
          logger.error(`[ObjectStorage] Local write failed for ${key}:`, err);
          throw new Error(`Local storage write failed: ${(err as Error).message}`);
        }
        logger.warn(`[ObjectStorage] Local cache write failed for ${key} (non-fatal):`, err);
      }
    }

    const publicUrl = this.config.publicUrl ? `${this.config.publicUrl.replace(/\/+$/, '')}/${key}` : null;
    const internalUrl = `/api/v1/upload/file/${key}`;

    return {
      key,
      sizeBytes: options.buffer.length,
      contentType: options.contentType,
      sha256,
      etag,
      url: publicUrl || internalUrl,
      publicUrl,
      storageBackend: this.config.backend,
      lastModified: new Date(),
    };
  }

  public async getObject(key: string): Promise<Buffer> {
    const cleanKey = this.sanitizeKey(key);

    // Check local disk cache first
    const localPath = this.getLocalPath(cleanKey);
    try {
      return await fs.readFile(localPath);
    } catch {
      // Not on local disk, fetch from Cloudflare R2 / S3
    }

    if (this.s3Client && this.config.bucket) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: cleanKey,
        });
        const response = await this.s3Client.send(command);
        if (!response.Body) {
          throw new Error('Empty response body from object storage');
        }

        const byteArray = await response.Body.transformToByteArray();
        const buffer = Buffer.from(byteArray);

        // Populate local cache asynchronously
        if (this.config.localCacheEnabled) {
          this.ensureParentDir(localPath)
            .then(() => fs.writeFile(localPath, buffer, { mode: 0o600 }))
            .catch(err => logger.warn(`[ObjectStorage] Failed to cache ${cleanKey}:`, err));
        }

        return buffer;
      } catch (err) {
        logger.error(`[ObjectStorage] Failed to get object ${cleanKey} from S3/R2:`, err);
        throw new Error(`Object not found: ${cleanKey}`);
      }
    }

    throw new Error(`Object not found: ${cleanKey}`);
  }

  public async getObjectStream(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
    const cleanKey = this.sanitizeKey(key);

    if (this.s3Client && this.config.bucket) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: cleanKey,
        });
        const response = await this.s3Client.send(command);
        if (response.Body) {
          return {
            stream: response.Body as unknown as Readable,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
          };
        }
      } catch (err) {
        logger.warn(`[ObjectStorage] Stream from S3/R2 failed for ${cleanKey}, falling back to local:`, err);
      }
    }

    const localPath = this.getLocalPath(cleanKey);
    const stats = await fs.stat(localPath);
    const { createReadStream } = await import('fs');
    return {
      stream: createReadStream(localPath),
      contentLength: stats.size,
    };
  }

  public async deleteObject(key: string): Promise<void> {
    const cleanKey = this.sanitizeKey(key);

    if (this.s3Client && this.config.bucket) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: cleanKey,
        }));
      } catch (err) {
        logger.warn(`[ObjectStorage] Failed to delete from S3/R2 (${cleanKey}):`, err);
      }
    }

    const localPath = this.getLocalPath(cleanKey);
    try {
      await fs.rm(localPath, { force: true });
    } catch (err) {
      logger.warn(`[ObjectStorage] Failed to remove local file (${cleanKey}):`, err);
    }
  }

  public async hasObject(key: string): Promise<boolean> {
    const cleanKey = this.sanitizeKey(key);
    const localPath = this.getLocalPath(cleanKey);
    try {
      await fs.access(localPath);
      return true;
    } catch {
      // Check cloud
    }

    if (this.s3Client && this.config.bucket) {
      try {
        await this.s3Client.send(new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: cleanKey,
        }));
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  public async getPresignedUploadUrl(options: PresignedUrlOptions): Promise<string> {
    const cleanKey = this.sanitizeKey(options.key);
    if (!this.s3Client || !this.config.bucket) {
      throw new Error('Presigned upload URLs require cloud object storage (Cloudflare R2, S3, or B2)');
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: cleanKey,
      ContentType: options.contentType || 'application/octet-stream',
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: options.expiresInSeconds || 3600,
    });
  }

  public async getPresignedDownloadUrl(options: PresignedUrlOptions): Promise<string> {
    const cleanKey = this.sanitizeKey(options.key);
    if (!this.s3Client || !this.config.bucket) {
      return `/api/v1/upload/file/${cleanKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: cleanKey,
      ResponseContentDisposition: options.filename
        ? `attachment; filename="${encodeURIComponent(options.filename)}"`
        : undefined,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: options.expiresInSeconds || 3600,
    });
  }
}

export const objectStorage = ObjectStorageService.getInstance();
