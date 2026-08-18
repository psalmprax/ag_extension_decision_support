/**
 * Shared API contract — reporting (`/api/v1/reporting`).
 * The report entity as returned by the list/detail endpoints, plus the
 * generate-report request contract.
 */
import { z } from 'zod';

export const reportSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  generatedAt: z.string(),
  status: z.string(),
  data: z.record(z.string(), z.unknown()),
  // Legacy convenience fields the UI reads directly.
  content: z.string().optional(),
  createdBy: z.string().optional(),
});

export const reportListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    reports: z.array(reportSchema),
    total: z.number(),
  }),
});

export const generateReportRequestSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  farmerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  officerId: z.string().optional(),
  region: z.string().optional(),
});

export type Report = z.infer<typeof reportSchema>;
export type ReportListResponse = z.infer<typeof reportListResponseSchema>;
export type GenerateReportRequest = z.infer<typeof generateReportRequestSchema>;
