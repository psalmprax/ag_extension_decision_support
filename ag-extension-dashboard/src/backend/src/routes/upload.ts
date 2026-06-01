/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { authorize } from '../middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Configure multer storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter for images and documents
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'));
    }
};

// Configure upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Apply authentication to all routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

// Upload single file
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        logger.info(`File uploaded: ${req.file.originalname} by user`);

        res.json({
            success: true,
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: fileUrl
            }
        });
    } catch (error) {
        logger.error('Upload error:', error);
        safeError(res, 500, 'Upload failed');
    }
});

// Upload multiple files
router.post('/upload/multiple', upload.array('files', 5), (req: Request, res: Response) => {
    try {
        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        const files = (req.files as Express.Multer.File[]).map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`
        }));

        logger.info(`${files.length} files uploaded by user`);

        res.json({
            success: true,
            data: files
        });
    } catch (error) {
        logger.error('Multiple upload error:', error);
        safeError(res, 500, 'Upload failed');
    }
});

// Upload farmer profile image
router.post('/farmer/image', upload.single('image'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }

        const { farmerId } = req.body;

        logger.info(`Farmer image uploaded: ${req.file.originalname} for farmer ${farmerId}`);

        res.json({
            success: true,
            data: {
                filename: req.file.filename,
                url: `/uploads/${req.file.filename}`,
                farmerId
            }
        });
    } catch (error) {
        logger.error('Farmer image upload error:', error);
        safeError(res, 500, 'Upload failed');
    }
});

// Upload farm document
router.post('/farm/document', upload.single('document'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No document uploaded' });
        }

        const { farmId, documentType } = req.body;

        logger.info(`Farm document uploaded: ${req.file.originalname} for farm ${farmId}`);

        res.json({
            success: true,
            data: {
                filename: req.file.filename,
                url: `/uploads/${req.file.filename}`,
                farmId,
                documentType
            }
        });
    } catch (error) {
        logger.error('Farm document upload error:', error);
        safeError(res, 500, 'Upload failed');
    }
});

// Error handling middleware for multer
router.use((error: any, _req: Request, res: Response, next: any) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB' });
        }
        return res.status(400).json({ success: false, error: error.message });
    }
    if (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
    next();
});

export default router;
