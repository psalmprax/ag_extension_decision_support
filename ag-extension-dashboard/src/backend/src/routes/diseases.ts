import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { plantDiseaseService } from '@/services/plantDiseaseService';
import { logger } from '@/utils/logger';

const router = Router();

// Get all available diseases
router.get('/', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const diseases = plantDiseaseService.getAllDiseases();
        res.json({ success: true, data: diseases });
    } catch (error) {
        logger.error('Failed to get diseases:', error);
        res.status(500).json({ success: false, error: 'Failed to get diseases' });
    }
});

// Get specific disease information
router.get('/:diseaseName', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { diseaseName } = req.params;
        const diseaseInfo = plantDiseaseService.getDiseaseInfo(diseaseName);

        if (!diseaseInfo) {
            return res.status(404).json({ success: false, error: 'Disease not found' });
        }

        res.json({ success: true, data: diseaseInfo });
    } catch (error) {
        logger.error('Failed to get disease info:', error);
        res.status(500).json({ success: false, error: 'Failed to get disease info' });
    }
});

// Diagnose diseases from symptoms
router.post('/diagnose', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { symptoms, cropType } = req.body;

        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return res.status(400).json({ success: false, error: 'Symptoms array is required' });
        }

        const diagnosis = plantDiseaseService.diagnoseFromSymptoms(symptoms, cropType);
        res.json({ success: true, data: diagnosis });
    } catch (error) {
        logger.error('Failed to diagnose disease:', error);
        res.status(500).json({ success: false, error: 'Failed to diagnose disease' });
    }
});

// Analyze plant image
router.post('/diagnose/image', authorize(['extension_officer', 'admin', 'farmer']), async (req: Request, res: Response) => {
    try {
        const { imageData, cropType } = req.body;

        if (!imageData) {
            return res.status(400).json({ success: false, error: 'Image data is required' });
        }

        const analysis = await plantDiseaseService.analyzeImage(imageData);
        res.json({ success: true, data: analysis });
    } catch (error) {
        logger.error('Failed to analyze image:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze image' });
    }
});

export default router;