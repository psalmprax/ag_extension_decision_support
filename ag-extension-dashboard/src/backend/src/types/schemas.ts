/**
 * Zod schemas for runtime validation of API DTOs.
 *
 * Each schema mirrors a DTO from `./dtos.ts`. Use these at API boundaries
 * (request validation, response shape checks) to enforce contracts at
 * runtime in addition to compile-time. For most route handlers, the DTO
 * type itself is sufficient — these schemas are for boundary validation.
 *
 * The DTO types in `dtos.ts` are the single source of truth; schemas here
 * are kept in lockstep manually (no auto-derivation to keep transform
 * behaviour explicit).
 */
import { z } from 'zod';

// --- Helpers ---------------------------------------------------------------

/** ISO-8601 string or null. */
const isoString = z.string().datetime().nullable();

/** Decimal coerced to number, or null. */
// const decimalOrNull = z.union([z.number(), z.string()]).transform(v =>
//   typeof v === 'number' ? v : Number.parseFloat(v)
// ).refine(n => Number.isFinite(n), { message: 'must be a finite number' }).nullable();

// --- Count schema ----------------------------------------------------------

export const countSchema = z.object({
  count: z.number().int().nonnegative(),
});

// --- Portfolio schemas -----------------------------------------------------

export const priorityQueueSchema = z.object({
  farmerId: z.string(),
  name: z.string(),
  reason: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  crop: z.string().nullable(),
});

export const recommendedVisitSchema = z.object({
  farmerId: z.string(),
  name: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  reason: z.string(),
  priority: z.number(),
  estimatedTime: z.number(),
});

export const alertSummarySchema = z.object({
  type: z.string(),
  severity: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
});

export const farmerDetailSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  village: z.string().nullable(),
  district: z.string().nullable(),
  region: z.string().nullable(),
  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  farmSizeHectares: z.number().nullable(),
  crops: z.array(z.string()).nullable(),
  languagePreference: z.string().nullable(),
  lastVisit: isoString,
});

export const portfolioExportFarmerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  village: z.string().nullable(),
  district: z.string().nullable(),
  region: z.string().nullable(),
  farmSizeHectares: z.number().nullable(),
  crops: z.array(z.string()).nullable(),
  totalVisits: z.number().int().nonnegative(),
  lastVisitDate: isoString,
});

export const portfolioExportVisitSchema = z.object({
  id: z.string(),
  officerId: z.string().nullable(),
  farmerId: z.string().nullable(),
  visitType: z.string().nullable(),
  status: z.string().nullable(),
  scheduledAt: isoString,
  notes: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  village: z.string().nullable(),
  type: z.string().optional(),
});

// --- Knowledge schemas -----------------------------------------------------

export const knowledgeArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  contentType: z.string().nullable(),
  summary: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  crops: z.array(z.string()).nullable(),
  regions: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  sourceUrl: z.string().nullable(),
});

export const knowledgeCategorySchema = z.object({ category: z.string() });
export const knowledgeCropSchema = z.object({ crop: z.string() });

// --- Visits schemas --------------------------------------------------------

export const visitWithFarmerSchema = z.object({
  id: z.string(),
  officerId: z.string().nullable(),
  farmerId: z.string().nullable(),
  visitType: z.string().nullable(),
  status: z.string().nullable(),
  scheduledAt: isoString,
  startedAt: isoString,
  completedAt: isoString,
  durationMinutes: z.number().nullable(),
  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  notes: z.string().nullable(),
  outcomes: z.string().nullable(),
  followUpRequired: z.boolean().nullable(),
  followUpDate: isoString,
  reminderSent: z.boolean().nullable(),
  overdueAlertSent: z.boolean().nullable(),
  followUpReminderSent: z.boolean().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  farmerName: z.string().nullable(),
});

export const visitInsertSchema = visitWithFarmerSchema.omit({ farmerName: true });

export const visitIdSchema = z.object({ id: z.string() });

// --- SMS schema ------------------------------------------------------------

export const smsHistorySchema = z.object({
  id: z.string(),
  senderId: z.string().nullable(),
  recipientPhone: z.string(),
  farmerId: z.string().nullable(),
  message: z.string(),
  status: z.string().nullable(),
  provider: z.string().nullable(),
  createdAt: isoString,
});

// --- Users schemas ---------------------------------------------------------

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.string().nullable(),
  region: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean().nullable(),
  lastLogin: isoString,
  avatarUrl: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});

export const userPublicSchema = userSchema.omit({ createdAt: true, updatedAt: true, email: true }).extend({
  email: z.string().email(),
});

// --- Fields schemas --------------------------------------------------------

export const fieldSchema = z.object({
  id: z.string(),
  farmerId: z.string().nullable(),
  name: z.string().nullable(),
  sizeHectares: z.number().nullable(),
  cropType: z.string().nullable(),
  soilType: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});

export const fieldStatsSchema = z.object({
  farmerId: z.string(),
  totalFields: z.number().int().nonnegative(),
  totalSize: z.number().nullable(),
  soilTypes: z.array(z.string()).nullable(),
});

// --- WhatsApp schema -------------------------------------------------------

export const whatsAppMessageSchema = z.object({
  id: z.string(),
  senderId: z.string().nullable(),
  recipientPhone: z.string(),
  farmerId: z.string().nullable(),
  message: z.string(),
  direction: z.string().nullable(),
  status: z.string().nullable(),
  provider: z.string().nullable(),
  createdAt: isoString,
});

// --- Support schema --------------------------------------------------------

export const supportTicketSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  subject: z.string(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  assignedTo: z.string().nullable(),
  resolvedAt: isoString,
  createdAt: isoString,
  updatedAt: isoString,
});

// --- Chatbot schemas -------------------------------------------------------

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().nullable(),
  role: z.string(),
  content: z.string(),
  farmerId: z.string().nullable(),
  userId: z.string().nullable(),
  rating: z.number().nullable(),
  feedback: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: isoString,
});

export const chatConversationSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  farmerId: z.string().nullable(),
  title: z.string().nullable(),
  status: z.string().nullable(),
  startedAt: isoString,
  endedAt: isoString,
  satisfactionRating: z.number().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});

export const satisfactionAvgSchema = z.object({
  avgSatisfaction: z.number().nullable(),
  totalRatings: z.number().int().nonnegative(),
});

// --- API client schema ----------------------------------------------------

export const apiClientSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  permissions: z.array(z.string()).nullable(),
  rateLimitPerMin: z.number().nullable(),
  isActive: z.boolean().nullable(),
  lastUsedAt: isoString,
  createdBy: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});

// --- Diagnostics schema ---------------------------------------------------

export const diagnosticRunSchema = z.object({
  id: z.string(),
  type: z.string().nullable(),
  status: z.string().nullable(),
  results: z.record(z.unknown()).nullable(),
  createdAt: isoString,
});
