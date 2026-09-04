import { z } from 'zod';
import { isoStringSchema } from './helpers';

export const diseaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    scientificName: z.string().optional(),
    commonNames: z.array(z.string()).optional(),
    crops: z.array(z.string()),
    symptoms: z.array(z.string()),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().optional(),
    treatment: z.string().optional(),
    prevention: z.string().optional(),
    transmission: z.string().optional(),
    region: z.string().optional(),
    lastUpdated: isoStringSchema.optional(),
});

export const diseaseSearchSchema = z.object({
    crop: z.string().optional(),
    symptom: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    region: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
});

export const diseaseDiagnoseSchema = z.object({
    symptoms: z.array(z.string()).min(1),
    crop: z.string().optional(),
    location: z.string().optional(),
    imageData: z.string().optional(),
    language: z.string().optional().default('en'),
});

export const diseaseDiagnoseResultSchema = z.object({
    disease: z.string(),
    confidence: z.number().min(0).max(1),
    symptoms: z.array(z.string()),
    treatment: z.string().optional(),
    prevention: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export type Disease = z.infer<typeof diseaseSchema>;
export type DiseaseSearchParams = z.infer<typeof diseaseSearchSchema>;
export type DiseaseDiagnoseInput = z.infer<typeof diseaseDiagnoseSchema>;
export type DiseaseDiagnoseResult = z.infer<typeof diseaseDiagnoseResultSchema>;