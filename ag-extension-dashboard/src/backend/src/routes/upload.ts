import { Router, Request, Response, NextFunction } from 'express';
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 },
  fileFilter: (_req, file, callback) => {
    let normalized: SupportedMimeType;
    try {
      normalized = normalizeMimeType(file.mimetype);
    } catch {
      return callback(new Error('Unsupported file type'));
    }

    if (file.buffer && file.buffer.length > 0) {
      if (!signatureMatches(file.buffer, normalized)) {
        return callback(new Error('File content does not match declared type'));
      }
    }
    callback(null, true);
  },
});

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
    const range = req.headers.range;

    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');

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
    res.setHeader('Content-Disposition', 'inline');
    return res.send(buffer);
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
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    if (!user || !req.file) return res.status(400).json({ success: false, error: 'A supported file is required' });

    const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
    if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
      return res.status(403).json({ success: false, error: 'Access denied to farmer' });
    }

    const saved = await saveUpload({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      ownerUserId: user.userId,
      farmerId,
    });

    logger.info('File uploaded', { uploadId: saved.id, userId: user.userId, farmerId });
    return res.status(201).json({ success: true, data: uploadResponse(req.file, saved) });
  } catch (error) {
    logger.error('Upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Upload failed');
  }
});

// ── Multiple Files Upload ──
router.post('/upload/multiple', upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    const files = req.files as Express.Multer.File[] | undefined;
    if (!user || !files?.length) return res.status(400).json({ success: false, error: 'At least one supported file is required' });

    const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
    if (farmerId && !(await assertFarmerAccess(req, farmerId))) {
      return res.status(403).json({ success: false, error: 'Access denied to farmer' });
    }

    const saved = [];
    for (const file of files) {
      const record = await saveUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        ownerUserId: user.userId,
        farmerId,
      });
      saved.push(uploadResponse(file, record));
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    logger.error('Multiple upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Upload failed');
  }
});

// ── Farmer Image Upload ──
router.post('/farmer/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : '';
    if (!user || !req.file || !farmerId) return res.status(400).json({ success: false, error: 'farmerId and image are required' });
    if (!(await assertFarmerAccess(req, farmerId))) return res.status(403).json({ success: false, error: 'Access denied to farmer' });

    const saved = await saveUpload({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      ownerUserId: user.userId,
      farmerId,
    });
    return res.status(201).json({ success: true, data: { ...uploadResponse(req.file, saved), farmerId } });
  } catch (error) {
    logger.error('Farmer image upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Upload failed');
  }
});

// ── Farm Document Upload ──
router.post('/farm/document', upload.single('document'), async (req: Request, res: Response) => {
  try {
    const user = principal(req);
    const farmerId = typeof req.body.farmerId === 'string' ? req.body.farmerId : undefined;
    if (!user || !req.file) return res.status(400).json({ success: false, error: 'A supported document is required' });
    if (farmerId && !(await assertFarmerAccess(req, farmerId))) return res.status(403).json({ success: false, error: 'Access denied to farmer' });

    const saved = await saveUpload({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      ownerUserId: user.userId,
      farmerId,
    });
    return res.status(201).json({
      success: true,
      data: { ...uploadResponse(req.file, saved), farmerId, documentType: req.body.documentType },
    });
  } catch (error) {
    logger.error('Farm document upload error:', error);
    return safeError(res, 400, error instanceof Error ? error.message : 'Upload failed');
  }
});

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
