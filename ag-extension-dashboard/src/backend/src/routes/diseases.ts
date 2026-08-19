import { Router, Request, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { plantDiseaseService } from '@/services/plantDiseaseService';
import { MAX_UPLOAD_BYTES } from '@/services/uploadService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { logSensitiveAction } from '@/middleware/auditMiddleware';

const router = Router();

// Apply authorization
const allowedRoles = authorize(['extension_officer', 'admin', 'farmer']);

// Get all available diseases
router.get('/', allowedRoles, async (req: Request, res: Response) => {
    try {
        const diseases = plantDiseaseService.getAllDiseases();
        res.json({ success: true, data: diseases });
    } catch (error) {
        logger.error('Failed to get diseases:', error);
        safeError(res, 500, 'Failed to get diseases');
    }
});

// Get specific disease information
router.get('/:diseaseName', allowedRoles, async (req: Request, res: Response) => {
    try {
        const { diseaseName } = req.params;
        const diseaseInfo = plantDiseaseService.getDiseaseInfo(diseaseName);

        if (!diseaseInfo) {
            return res.status(404).json({ success: false, error: 'Disease not found' });
        }

        res.json({ success: true, data: diseaseInfo });
    } catch (error) {
        logger.error('Failed to get disease info:', error);
        safeError(res, 500, 'Failed to get disease info');
    }
});

// Diagnose diseases from symptoms
router.post('/diagnose', allowedRoles, checkUsageLimit('ai_vision'), async (req: AuthRequest, res: Response) => {
    try {
        const { symptoms, cropType } = req.body;

        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({ success: false, error: 'Symptoms array is required' });
        }

        const diagnosis = await plantDiseaseService.diagnoseFromSymptoms(symptoms, cropType);
        const userId = req.user?.userId;
        if (userId) {
            void logSensitiveAction(userId, 'disease_diagnosis_recommendation', {
                cropType: typeof cropType === 'string' ? cropType : null,
                resultCount: diagnosis.length,
                recommendations: diagnosis.map(result => ({
                    disease: result.disease,
                    confidence: result.confidence,
                    reviewStatus: result.reviewStatus,
                    evidenceStatus: result.provenance.evidenceStatus,
                    treatmentCount: result.treatment.length,
                })),
            });
        }
        res.json({ success: true, data: diagnosis });
    } catch (error) {
        logger.error('Failed to diagnose disease:', error);
        safeError(res, 500, 'Failed to diagnose disease');
    }
});

// Analyze plant image with database log telemetry
router.post('/diagnose/image', allowedRoles, checkUsageLimit('ai_vision'), async (req: AuthRequest, res: Response) => {
    try {
        const { imageData, cropType } = req.body;

        if (!imageData) {
            return res.status(400).json({ success: false, error: 'Image data is required' });
        }

        // Validate file size (max 10MB decoded)
        const base64Data = imageData.split(',')[1] || imageData;
        const decodedBytes = Buffer.from(base64Data, 'base64').length;
        if (decodedBytes > MAX_UPLOAD_BYTES) {
            return res.status(400).json({ success: false, error: `Image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
        }

        const analysis = await plantDiseaseService.analyzeImage(imageData);

        // Save report telemetry
        let reportId: string | null = null;
        try {
            const reportTitle = `Plant Leaf Diagnosis - ${cropType || 'Unspecified Crop'}`;
            const userId = req.user?.userId || null;
            const dbResult = await query(`
                INSERT INTO reports (type, title, generated_by, content, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
                RETURNING id
            `, [
                'disease_diagnosis',
                reportTitle,
                userId,
                JSON.stringify({ ...analysis, metadata: { cropType, generatedAt: new Date().toISOString() } })
            ]);
            if (dbResult.rows && dbResult.rows.length > 0) {
                reportId = dbResult.rows[0].id;
            }
        } catch (dbError) {
            logger.error('Failed to save disease diagnosis report telemetry:', dbError);
        }

        res.json({ success: true, data: { ...analysis, reportId } });
    } catch (error) {
        logger.error('Failed to analyze image:', error);
        safeError(res, 500, 'Failed to analyze image');
    }
});

// Analyze soil image with database log telemetry
router.post('/diagnose/soil', allowedRoles, checkUsageLimit('ai_vision'), async (req: AuthRequest, res: Response) => {
    try {
        const { imageData, cropType, details } = req.body;

        if (!imageData) {
            return res.status(400).json({ success: false, error: 'Soil image data is required' });
        }

        // Validate file size (max 10MB decoded)
        const base64Data = imageData.split(',')[1] || imageData;
        const decodedBytes = Buffer.from(base64Data, 'base64').length;
        if (decodedBytes > MAX_UPLOAD_BYTES) {
            return res.status(400).json({ success: false, error: `Image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
        }

        const analysis = await plantDiseaseService.analyzeSoilImage(imageData, details);

        // Save report telemetry
        let reportId: string | null = null;
        try {
            const reportTitle = `Soil Diagnostics - ${cropType || 'General Farm'}`;
            const userId = req.user?.userId || null;
            const dbResult = await query(`
                INSERT INTO reports (type, title, generated_by, content, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW())
                RETURNING id
            `, [
                'soil_diagnostic',
                reportTitle,
                userId,
                JSON.stringify({ ...analysis, metadata: { cropType, details, generatedAt: new Date().toISOString() } })
            ]);
            if (dbResult.rows && dbResult.rows.length > 0) {
                reportId = dbResult.rows[0].id;
            }
        } catch (dbError) {
            logger.error('Failed to save soil diagnostic report telemetry:', dbError);
        }

        res.json({ success: true, data: { ...analysis, reportId } });
    } catch (error) {
        logger.error('Failed to analyze soil image:', error);
        safeError(res, 500, 'Failed to analyze soil image');
    }
});

export default router;