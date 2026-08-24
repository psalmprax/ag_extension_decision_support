import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { query } from '@/services/databaseService';
import { getFarmerForPrincipal } from '@/services/dataGovernanceService';
import { saveUpload, readStoredUpload, MAX_UPLOAD_BYTES } from '@/services/uploadService';

/**
 * Verify file magic bytes against allowed MIME types.
 *
 * MIME alone is client-controlled — a file named .jpg could contain an executable.
 * This checks the leading bytes of the buffer to confirm the real type before
 * the file reaches storage or AI pipelines.
 */
function verifyMagicBytes(buffer: Buffer, declaredMime: string): boolean {
    if (buffer.length < 4) return false;
    const head = buffer.slice(0, 12);
    return !isBinaryExecutable(head) && matchesDeclaredType(head, buffer, declaredMime);
}

const EXECUTABLE_SIGNATURES: readonly number[][] = [
    [0x7f, 0x45, 0x4c, 0x46], // ELF
    [0x4d, 0x5a],             // MZ (PE / DOS)
    [0x23, 0x21],             // #! shebang
    [0xfe, 0xed, 0xfa],       // Mach-O 32-bit
    [0xce, 0xfa, 0xed],       // Mach-O 64-bit
    [0xcf, 0xfa, 0xed],       // Mach-O 64-bit (reverse)
];

function isBinaryExecutable(head: Buffer): boolean {
    for (const sig of EXECUTABLE_SIGNATURES) {
        if (sig.every((b, i) => head[i] === b)) return true;
    }
    return false;
}

function matchesDeclaredType(head: Buffer, fullBuf: Buffer, mime: string): boolean {
    if (mime === 'image/jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (mime === 'image/png')  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (mime === 'image/gif')  return head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38;
    if (mime === 'image/webp') {
        return head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
            && fullBuf[8] === 0x57 && fullBuf[9] === 0x45 && fullBuf[10] === 0x42 && fullBuf[11] === 0x50;
    }
    if (mime === 'application/pdf') return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
    return false;
}

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 5 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error('Unsupported file type'));
    }
    // Verify magic bytes match the declared MIME
    if (!verifyMagicBytes(file.buffer, file.mimetype)) {
      return callback(new Error('File content does not match declared type'));
    }
    callback(null, true);
  },
});

router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    logger.error('Read upload error:', error);
    return safeError(res, 404, 'File not found');
  }
});

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
    source: 'local-storage-adapter',
    fieldName: file.fieldname,
  };
}

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
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 10MB' : error.message;
    return res.status(400).json({ success: false, error: message });
  }
  if (error) return res.status(400).json({ success: false, error: 'Unsupported upload' });
  return next();
});

export default router;
