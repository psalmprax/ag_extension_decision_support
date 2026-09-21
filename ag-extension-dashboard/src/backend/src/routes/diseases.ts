import { Router, Request, Response } from 'express';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { plantDiseaseService, type DiseaseDiagnosis, type PlantImageAnalysis } from '@/services/plantDiseaseService';
import { MAX_UPLOAD_BYTES } from '@/services/uploadService';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { logSensitiveAction } from '@/middleware/auditMiddleware';
import { outbreakService } from '@/services/outbreakService';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';

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

function rejectUnsafeRecommendation(req: AuthRequest, res: Response): boolean {
    const { cropType } = req.body;
    // Regulatory Safety Gating (AD-001 / CE-001)
    if (req.body.jurisdiction && (req.body.pesticideName || req.body.pesticideMlHa)) {
        const boundaryCheck = agronomicSafetyGuard.validateStructuredMetrics({
            cropType: typeof cropType === 'string' ? cropType : undefined,
            jurisdiction: req.body.jurisdiction,
            pesticideName: req.body.pesticideName,
            pesticideMlHa: typeof req.body.pesticideMlHa === 'number' ? req.body.pesticideMlHa : undefined,
            daysToHarvest: typeof req.body.daysToHarvest === 'number' ? req.body.daysToHarvest : undefined,
            floweringOrPollinatorsPresent: Boolean(req.body.floweringPresent || req.body.pollinatorsPresent),
            adviceTimestamp: req.body.adviceTimestamp,
            farmerId: req.body.farmerId,
            clientOfflineContext: req.body.clientOfflineContext,
        });

        if (boundaryCheck.regulatoryDecision?.status === 'HARD_REJECTION') {
            res.status(422).json({
                success: false,
                error: boundaryCheck.regulatoryDecision.rejectionMessage || 'Chemical recommendation rejected under fail-closed regulatory governance',
                regulatoryDecision: boundaryCheck.regulatoryDecision,
            });
            return true;
        }
    }

    return false;
}

function recordSymptomOutbreakEvents(req: AuthRequest, diagnosis: DiseaseDiagnosis[]): void {
    const { cropType } = req.body;
    // Feed outbreak intelligence system with high-confidence symptom diagnoses
    try {
        const resolvedFarmerId = req.body.farmerId || (req.user?.role === 'farmer' ? req.user.userId : null);
        const resolvedDistrict = req.body.district || null;
        for (const item of diagnosis) {
            if ((item.confidence ?? 0) >= 50) {
                void outbreakService
                    .recordDiagnosisEvent({
                        farmerId: resolvedFarmerId,
                        district: resolvedDistrict,
                        crop: cropType || 'unspecified',
                        diseaseLabel: item.disease,
                        confidence: item.confidence,
                        source: 'symptom_diagnosis',
                    })
                    .catch(err => logger.error('[outbreak] failed to record symptom diagnosis event:', err));
            }
        }
    } catch (outbreakErr) {
        logger.error('[outbreak] error processing symptom diagnosis events:', outbreakErr);
    }
}

function validatePlantImage(imageData: string, res: Response): boolean {
    // Validate file size (max 10MB decoded) before heap allocation
    const base64Data = imageData.split(',')[1] || imageData;
    if (base64Data.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3)) {
        res.status(413).json({ success: false, error: `Image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
        return false;
    }
    const decodedBytes = Buffer.from(base64Data, 'base64').length;
    if (decodedBytes === 0) {
        res.status(400).json({ success: false, error: 'Invalid or empty image payload' });
        return false;
    }
    if (decodedBytes > MAX_UPLOAD_BYTES) {
        res.status(413).json({ success: false, error: `Image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
        return false;
    }

    return true;
}

async function saveDiagnosisReport(req: AuthRequest, analysis: PlantImageAnalysis): Promise<string | null> {
    const { cropType } = req.body;
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

    return reportId;
}

function parseDiagnosisConfidence(confidence: unknown): number | null {
    if (typeof confidence === 'string') return parseFloat(confidence);
    return typeof confidence === 'number' ? confidence : null;
}

function recordImageOutbreakEvents(req: AuthRequest, analysis: PlantImageAnalysis): void {
    const { cropType } = req.body;
    // Feed outbreak intelligence system with detected image diseases
    try {
        const resolvedFarmerId = req.body.farmerId || (req.user?.role === 'farmer' ? req.user.userId : null);
        const resolvedDistrict = req.body.district || null;
        if (analysis.diseases && Array.isArray(analysis.diseases)) {
            for (const item of analysis.diseases) {
                const conf = parseDiagnosisConfidence(item.confidence);
                void outbreakService
                    .recordDiagnosisEvent({
                        farmerId: resolvedFarmerId,
                        district: resolvedDistrict,
                        crop: cropType || 'unspecified',
                        diseaseLabel: item.disease,
                        confidence: conf,
                        source: 'ai_vision',
                    })
                    .catch(err => logger.error('[outbreak] failed to record image diagnosis event:', err));
            }
        }
    } catch (outbreakErr) {
        logger.error('[outbreak] error processing image diagnosis events:', outbreakErr);
    }
}

// Diagnose diseases from symptoms
router.post('/diagnose', allowedRoles, checkUsageLimit('ai_vision'), async (req: AuthRequest, res: Response) => {
    try {
        const { symptoms, cropType } = req.body;

        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({ success: false, error: 'Symptoms array is required' });
        }

        if (rejectUnsafeRecommendation(req, res)) return;

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

        recordSymptomOutbreakEvents(req, diagnosis);

        res.json({ success: true, data: diagnosis });
    } catch (error) {
        logger.error('Failed to diagnose disease:', error);
        safeError(res, 500, 'Failed to diagnose disease');
    }
});

// Analyze plant image with database log telemetry
router.post('/diagnose/image', allowedRoles, checkUsageLimit('ai_vision'), async (req: AuthRequest, res: Response) => {
    try {
        const { imageData } = req.body;

        if (!imageData) {
            return res.status(400).json({ success: false, error: 'Image data is required' });
        }

        if (!validatePlantImage(imageData, res)) return;

        if (rejectUnsafeRecommendation(req, res)) return;

        const analysis = await plantDiseaseService.analyzeImage(imageData);

        const reportId = await saveDiagnosisReport(req, analysis);

        recordImageOutbreakEvents(req, analysis);

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

        // Validate file size (max 10MB decoded) before heap allocation
        // Handle data URLs: split on comma, take everything after the first comma.
        // If no comma exists, treat the whole string as base64.
        const commaIdx = imageData.indexOf(',');
        const base64Data = commaIdx >= 0 ? imageData.slice(commaIdx + 1) : imageData;
        if (base64Data.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3)) {
            return res.status(413).json({ success: false, error: `Soil image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
        }
        const decodedBytes = Buffer.from(base64Data, 'base64').length;
        if (decodedBytes === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or empty soil image payload' });
        }
        if (decodedBytes > MAX_UPLOAD_BYTES) {
            return res.status(413).json({ success: false, error: `Soil image size exceeds maximum limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` });
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
