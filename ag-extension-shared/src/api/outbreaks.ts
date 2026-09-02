import { z } from 'zod';
import { isoStringSchema } from './helpers';

export const outbreakSchema = z.object({
    id: z.string(),
    diseaseId: z.string(),
    diseaseName: z.string(),
    crop: z.string(),
    location: z.string(),
    coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
    }).optional(),
    radiusKm: z.number().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    reportedCases: z.number().int().min(0).optional(),
    estimatedAffectedArea: z.number().optional(),
    startDate: isoStringSchema,
    endDate: isoStringSchema.optional(),
    status: z.enum(['active', 'contained', 'resolved']),
    source: z.string().optional(),
    notes: z.string().optional(),
});

export const outbreakSearchSchema = z.object({
    bbox: z.string().optional(),
    disease: z.string().optional(),
    crop: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: z.enum(['active', 'contained', 'resolved']).optional(),
    days: z.number().int().min(1).max(365).optional().default(30),
    limit: z.number().int().min(1).max(100).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
});

export const outbreakReportSchema = z.object({
    diseaseId: z.string(),
    crop: z.string(),
    location: z.string(),
    coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
    }).optional(),
    radiusKm: z.number().min(0.1).max(500).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    reportedCases: z.number().int().min(0).optional(),
    description: z.string().optional(),
    reporterId: z.string().optional(),
    imageData: z.string().optional(),
});

export type Outbreak = z.infer<typeof outbreakSchema>;
export type OutbreakSearchParams = z.infer<typeof outbreakSearchSchema>;
export type OutbreakReportInput = z.infer<typeof outbreakReportSchema>;