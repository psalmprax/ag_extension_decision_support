import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { query } from '@/services/databaseService';
import { getFarmerForPrincipal } from '@/services/dataGovernanceService';
import {
  saveUpload,
  readStoredUpload,
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  signatureMatches,
  normalizeMimeType,
  createDirectUploadPresign,
  confirmDirectUpload,
  type SupportedMimeType,
} from '@/services/uploadService';
import { objectStorage } from '@/services/objectStorageService';

const router = Router();

/**
 * Disk-spooled upload storage.
 *
 * memoryStorage() previously buffered every file fully in RAM before any
 * validation — a bounded burst of legitimate (or malicious) uploads pinned
 * 100MB × files × concurrency of process memory and invited OOM kills.
 * Files now stream to a private temp dir, the SAME magic-byte signature check
 * runs against the spooled file's head bytes, and cleanup is guaranteed via
 * express response finalizer even when handlers throw.
 */
const UPLOAD_TMP_DIR = process.env.UPLOAD_TMP_DIR || path.join(os.tmpdir(), 'ag-uploads');
try { fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true }); } catch { /* exists or unavailable — multer errors visibly below */ }

const spoolStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_TMP_DIR),
  filename: (_req, file, cb) => cb(null, `spool-${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname || '') || ''}`),
});

/** Read the magic-byte head of a spooled file (signature checks need ≤64 bytes). */
async function readSpooledHead(filePath: string, bytes: number): Promise<Buffer> {
  const fh = await fsp.open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await fh.read(Buffer.alloc(bytes), 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Delete a spooled temp file; never throws. */
function discardSpooled(filePath?: string): void {
  if (!filePath) return;
  void fsp.unlink(filePath).catch(() => { /* best effort */ });
}

const upload = multer({
  storage: spoolStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 },
  fileFilter: (_req, file, callback) => {
    let normalized: SupportedMimeType;
    try {
      normalized = normalizeMimeType(file.mimetype);
    } catch {
      return callback(new Error('Unsupported file type'));
    }
    // Pre-stream check on buffered head when the client provided it (multipart
    // bodies usually include small non-file parts first); the authoritative
    // signature check re-runs against the spooled file inside the handler.
    if (file.buffer && file.buffer.length > 0) {
      if (!signatureMatches(file.buffer, normalized)) {
        return callback(new Error('File content does not match declared type'));
      }
    }
    callback(null, true);
  },
});

async function validateSpooledFile(file: Express.Multer.File): Promise<void> {
  if (!file.path) return;
  const stat = await fsp.stat(file.path).catch(() => null);
  if (!stat || stat.size === 0 || stat.size > MAX_UPLOAD_BYTES) {
    throw new Error('Uploaded file is empty or exceeds the size limit');
  }
  const normalized = normalizeMimeType(file.mimetype);
  // SVG needs full-content inspection, not just head bytes.
  if (normalized === 'image/svg+xml') {
    const content = await fsp.readFile(file.path);
    if (!signatureMatches(content, normalized)) {
      throw new Error('File content does not match declared type');
    }
  } else {
    const head = await readSpooledHead(file.path, 64);
    if (!signatureMatches(head, normalized)) {
      throw new Error('File content does not match declared type');
    }
  }
}

async function processSpooledFiles(
  files: Express.Multer.File[],
  res: Response,
  handler: (files: Express.Multer.File[]) => Promise<void>
): Promise<void> {
  try {
    for (const file of files) await validateSpooledFile(file);
    await handler(files);
  } catch (error) {
    if (!res.headersSent) {
      const status = (error as { statusCode?: number }).statusCode;
      res.status(typeof status === 'number' ? status : 400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }
}

/**
 * Post-multer validation against the spooled file + guaranteed cleanup.
 * Wraps every upload handler: verifies magic bytes from disk, then removes the
 * temp file when the response finishes — success or failure.
 */
function withSpooledFile(
  req: Request,
  res: Response,
  handler: (files: Express.Multer.File[]) => Promise<void>
): void {
  const files: Express.Multer.File[] = [];
  const single = (req as unknown as { file?: Express.Multer.File }).file;
  const many = (req as unknown as { files?: Express.Multer.File[] }).files;
  if (single) files.push(single);
  if (many) files.push(...many);

  const cleanup = () => { for (const f of files) discardSpooled(f.path); };
  res.on('finish', cleanup);
  res.on('close', cleanup);

  void processSpooledFiles(files, res, handler);
}

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

function principal(req: Request): { userId: string; role: string } | null {
  return req.user?.userId && req.user.role ? { userId: req.user.userId, role: req.user.role } : null;
}

async function assertFarmerAccess(req: Request, farmerId: string): Promise<boolean> {
  const user = principal(req);
  if (!user) return false;
  return Boolean(await getFarmerForPrincipal(farmerId, user));
}

function uploadResponse(file: Express.Multer.File, saved: Awaited<ReturnType<typeof saveUpload>>) {
  return {
    id: saved.id,
    filename: saved.storageKey,
    originalName: saved.originalName,
    mimetype: saved.mimeType,
    size: saved.size,
    sha256: saved.sha256,
    url: saved.url,
    contentDisposition: 'inline-safe',
    source: objectStorage.getBackendType(),
    fieldName: file.fieldname,
  };
}

// ── GET Storage Backend Info ──
router.get('/info', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      backend: objectStorage.getBackendType(),
      isCloud: objectStorage.isCloudConfigured(),
      maxUploadBytes: MAX_UPLOAD_BYTES,
      maxUploadMb: Math.round(MAX_UPLOAD_BYTES / 1024 / 1024),
      supportedMimeTypes: Object.keys(UPLOAD_TYPES),
    },
  });
});

// ── Helper: send a stored buffer with range-request support ──
function sendFileBuffer(res: Response, buffer: Buffer, mimeType: string, range?: string): Response {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (mimeType === 'image/svg+xml') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Content-Disposition', 'attachment; filename="file.svg"');
  } else {
    res.setHeader('Content-Disposition', 'inline');
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;

    if (start >= buffer.length || end >= buffer.length || start > end) {
      res.setHeader('Content-Range', `bytes */${buffer.length}`);
      return res.status(416).send('Requested range not satisfiable');
    }

    const chunk = buffer.subarray(start, end + 1);
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${buffer.length}`);
    res.setHeader('Content-Length', chunk.length);
    return res.send(chunk);
  }

  res.setHeader('Content-Length', buffer.length);
  return res.send(buffer);
}

// ── GET Stored File (with Range Requests for Audio/Video Streaming) ──
router.get('/file/:storageKey', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    const storageKey = req.params.storageKey;
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const result = await query<{ owner_user_id: string; farmer_id: string | null; mime_type: string; status: string }>(
      `SELECT owner_user_id, farmer_id, mime_type, status
       FROM upload_records WHERE storage_key = $1`,
      [storageKey]
    );
    const record = result.rows[0];
    if (!record || record.status !== 'active') return res.status(404).json({ success: false, error: 'File not found' });

    const allowed = user.role === 'admin' || record.owner_user_id === user.userId;
    const farmerAllowed = record.farmer_id ? Boolean(await getFarmerForPrincipal(record.farmer_id, user)) : false;
    if (!allowed && !farmerAllowed) return res.status(403).json({ success: false, error: 'Access denied' });

    const buffer = await readStoredUpload(storageKey);
    return sendFileBuffer(res, buffer, record.mime_type, req.headers.range);
  } catch (error) {
    logger.error('Read upload error:', error);
    return safeError(res, 404, 'File not found');
  }
});

// ── Presigned Direct Upload URL (for high-volume Video / Audio / Large Docs) ──
router.post('/presign', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { filename, mimeType, sizeBytes, farmerId } = req.body;
    if (!filename || !mimeType || !sizeBytes) {
      return res.status(400).json({ success: false, error: 'filename, mimeType, and sizeBytes are required' });
    }

    if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
      return res.status(403).json({ success: false, error: 'Access denied to farmer' });
    }

    const presigned = await createDirectUploadPresign({
      originalName: String(filename),
      mimeType: String(mimeType),
      sizeBytes: Number(sizeBytes),
      ownerUserId: user.userId,
      farmerId: typeof farmerId === 'string' ? farmerId : undefined,
    });

    return res.status(200).json({ success: true, data: presigned });
  } catch (error) {
    logger.error('Presign upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Presign failed');
  }
});

// ── Confirm Direct Upload ──
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });

    const { storageKey } = req.body;
    if (!storageKey) {
      return res.status(400).json({ success: false, error: 'storageKey is required' });
    }

    const confirmed = await confirmDirectUpload(String(storageKey), user.userId);
    return res.status(200).json({ success: true, data: confirmed });
  } catch (error) {
    logger.error('Confirm upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Confirmation failed');
  }
});

// ── Standard Multipart Upload ──
router.post('/upload', upload.single('file'), (req, res) => withSpooledFile(req, res, async (files) => {
  const user = principal(req);
  const file = files[0];
  if (!user || !file) throw new Error('A supported file is required');

  const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
  if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
    throw Object.assign(new Error('Access denied to farmer'), { statusCode: 403 });
  }

  // Read the spooled file one-at-a-time; the multer parse phase no longer
  // holds every upload in RAM. Full S3 multipart streaming needs
  // @aws-sdk/lib-storage (tracked separately) — putObject still takes a buffer.
  const saved = await saveUpload({
    buffer: await fsp.readFile(file.path),
    originalName: file.originalname,
    mimeType: file.mimetype,
    ownerUserId: user.userId,
    farmerId,
  });

  logger.info('File uploaded', { uploadId: saved.id, userId: user.userId, farmerId });
  res.status(201).json({ success: true, data: uploadResponse(file, saved) });
}));

// ── Multiple Files Upload ──
router.post('/upload/multiple', upload.array('files', 5), (req, res) => withSpooledFile(req, res, async (files) => {
  const user = principal(req);
  if (!user || !files.length) throw new Error('At least one supported file is required');

  const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
  if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
    throw Object.assign(new Error('Access denied to farmer'), { statusCode: 403 });
  }

  const saved = [];
  for (const file of files) {
    const record = await saveUpload({
      buffer: await fsp.readFile(file.path),
      originalName: file.originalname,
      mimeType: file.mimetype,
      ownerUserId: user.userId,
      farmerId,
    });
    saved.push(uploadResponse(file, record));
  }

  res.status(201).json({ success: true, data: saved });
}));

// ── Farmer Image Upload ──
router.post('/farmer/image', upload.single('image'), (req, res) => withSpooledFile(req, res, async (files) => {
  const user = principal(req);
  const file = files[0];
  const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : '';
  if (!user || !file || !farmerId) throw new Error('farmerId and image are required');
  if (!(await assertFarmerAccess(req, farmerId))) {
    throw Object.assign(new Error('Access denied to farmer'), { statusCode: 403 });
  }

  const saved = await saveUpload({
    buffer: await fsp.readFile(file.path),
    originalName: file.originalname,
    mimeType: file.mimetype,
    ownerUserId: user.userId,
    farmerId,
  });
  res.status(201).json({ success: true, data: { ...uploadResponse(file, saved), farmerId } });
}));

// ── Farm Document Upload ──
router.post('/farm/document', upload.single('document'), (req, res) => withSpooledFile(req, res, async (files) => {
  const user = principal(req);
  const file = files[0];
  if (!user || !file) throw new Error('A supported document is required');
  const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
  if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
    throw Object.assign(new Error('Access denied to farmer'), { statusCode: 403 });
  }

  const saved = await saveUpload({
    buffer: await fsp.readFile(file.path),
    originalName: file.originalname,
    mimeType: file.mimetype,
    ownerUserId: user.userId,
    farmerId,
  });
  res.status(201).json({
    success: true,
    data: { ...uploadResponse(file, saved), farmerId, documentType: req.body.documentType },
  });
}));

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const maxMb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
    const message = error.code === 'LIMIT_FILE_SIZE' ? `File too large. Maximum size is ${maxMb}MB` : error.message;
    return res.status(400).json({ success: false, error: message });
  }
  if (error) return res.status(400).json({ success: false, error: 'Unsupported upload' });
  return next();
});

export default router;
