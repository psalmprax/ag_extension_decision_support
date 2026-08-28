/**
 * API DTOs (camelCase) + row→DTO mapping functions.
 *
 * Each DTO mirrors a row type from `./rowTypes.ts` but uses camelCase
 * property names (matching the API response shape the frontend expects).
 * Each `mapXxxRow` function:
 *   - renames snake_case fields → camelCase
 *   - applies basic transforms: `parseInt` for stringified numbers
 *     (e.g. `CountRow.count`), `null` → `undefined` for optional fields
 *   - leaves Date strings as ISO strings (JSON cannot preserve Date objects)
 *
 * Use the paired Zod schema in `./schemas.ts` for runtime validation.
 */
import type {
  CountRow,
  PriorityQueueRow,
  RecommendedVisitRow,
  AlertSummaryRow,
  FarmerDetailRow,
  KnowledgeArticleRow,
  KnowledgeCategoryRow,
  KnowledgeCropRow,
  ReportListRow,
  VisitStatsRow,
  ConversationStatsRow,
  VisitWithFarmerRow,
  VisitInsertRow,
  VisitIdRow,
  SmsHistoryRow,
  UserRow,
  UserPublicRow,
  FieldStatsRow,
  WhatsAppMessageRow,
  SupportTicketRow,
  ChatMessageRow,
  ChatConversationRow,
  SatisfactionAvgRow,
  ApiClientRow,
} from './rowTypes';

// --- Helpers ---------------------------------------------------------------

/** Parse a pg `COUNT(*)` string into a number, defaulting to 0 for null. */
function parseCount(value: string | null | undefined): number {
  if (value == null) return 0;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a string-or-number pg DECIMAL into a JS number (or null). */
function parseDecimal(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a string-or-Date pg timestamp to an ISO string (or undefined). */
function toIso(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  return v;
}

// --- Count DTO -------------------------------------------------------------

export interface CountDTO {
  count: number;
}
export function mapCountRow(row: CountRow): CountDTO {
  return { count: parseCount(row.count) };
}
export function mapCountRows(rows: CountRow[]): CountDTO[] {
  return rows.map(mapCountRow);
}

// --- Portfolio DTOs --------------------------------------------------------

export interface PriorityQueueDTO {
  farmerId: string;
  name: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  crop: string | null;
}
function mapPriorityQueueRow(row: PriorityQueueRow): PriorityQueueDTO {
  return {
    farmerId: row.farmer_id,
    name: row.name,
    reason: row.reason,
    severity: row.severity,
    crop: row.crop,
  };
}
export function mapPriorityQueueRows(rows: PriorityQueueRow[]): PriorityQueueDTO[] {
  return rows.map(mapPriorityQueueRow);
}

export interface RecommendedVisitDTO {
  farmerId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  reason: string;
  priority: number;
  estimatedTime: number;
}
function mapRecommendedVisitRow(row: RecommendedVisitRow): RecommendedVisitDTO {
  return {
    farmerId: row.farmer_id,
    name: row.name,
    lat: parseDecimal(row.lat),
    lng: parseDecimal(row.lng),
    reason: row.reason,
    priority: row.priority,
    estimatedTime: row.estimatedtime,
  };
}
export function mapRecommendedVisitRows(rows: RecommendedVisitRow[]): RecommendedVisitDTO[] {
  return rows.map(mapRecommendedVisitRow);
}

export interface AlertSummaryDTO {
  type: string;
  severity: string | null;
  description: string | null;
  location: string | null;
}
function mapAlertSummaryRow(row: AlertSummaryRow): AlertSummaryDTO {
  return {
    type: row.type,
    severity: row.severity,
    description: row.description,
    location: row.location,
  };
}
export function mapAlertSummaryRows(rows: AlertSummaryRow[]): AlertSummaryDTO[] {
  return rows.map(mapAlertSummaryRow);
}

export interface FarmerDetailDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  locationLat: number | null;
  locationLng: number | null;
  farmSizeHectares: number | null;
  crops: string[] | null;
  languagePreference: string | null;
  lastVisit: string | null;
}
export function mapFarmerDetailRow(row: FarmerDetailRow): FarmerDetailDTO {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    village: row.village,
    district: row.district,
    region: row.region,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    farmSizeHectares: parseDecimal(row.farm_size_hectares),
    crops: row.crops,
    languagePreference: row.language_preference,
    lastVisit: toIso(row.last_visit) ?? null,
  };
}

export interface PortfolioExportFarmerDTO {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  farmSizeHectares: number | null;
  crops: string[] | null;
  totalVisits: number;
  lastVisitDate: string | null;
}

export interface PortfolioExportVisitDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  notes: string | null;
  firstName: string;
  lastName: string;
  village: string | null;
  type?: string;
}

// --- Reporting DTOs --------------------------------------------------------

export interface VisitStatsDTO {
  total: number;
  completed: number;
  totalMinutes: number | null;
}
export function mapVisitStatsRow(row: VisitStatsRow): VisitStatsDTO {
  return {
    total: parseCount(row.total),
    completed: parseCount(row.completed),
    totalMinutes: row.total_minutes == null ? null : parseInt(row.total_minutes, 10),
  };
}

export interface ConversationStatsDTO {
  totalConversations: number;
  rated: number;
  avgSatisfaction: number | null;
}
export function mapConversationStatsRow(row: ConversationStatsRow): ConversationStatsDTO {
  return {
    totalConversations: parseCount(row.total_conversations),
    rated: parseCount(row.rated),
    avgSatisfaction: parseDecimal(row.avg_satisfaction),
  };
}

export interface ReportListDTO {
  id: string;
  type: string;
  title: string;
  status: string | null;
  generatedAt: string;
  updatedAt: string | null;
  content: ReportListRow['content'];
}
export function mapReportListRow(row: ReportListRow): ReportListDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    status: row.status,
    generatedAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? null,
    content: row.content,
  };
}
export function mapReportListRows(rows: ReportListRow[]): ReportListDTO[] {
  return rows.map(mapReportListRow);
}

// --- Knowledge DTOs --------------------------------------------------------

export interface KnowledgeArticleDTO {
  id: string;
  title: string;
  content: string;
  contentType: string | null;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  crops: string[] | null;
  regions: string[] | null;
  source: string | null;
  sourceUrl: string | null;
}
export function mapKnowledgeArticleRow(row: KnowledgeArticleRow): KnowledgeArticleDTO {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    contentType: row.content_type,
    summary: row.summary,
    category: row.category,
    tags: row.tags,
    crops: row.crops,
    regions: row.regions,
    source: row.source,
    sourceUrl: row.source_url,
  };
}

export interface KnowledgeCategoryDTO {
  category: string;
}
function mapKnowledgeCategoryRow(row: KnowledgeCategoryRow): KnowledgeCategoryDTO {
  return { category: row.category };
}
export function mapKnowledgeCategoryRows(rows: KnowledgeCategoryRow[]): KnowledgeCategoryDTO[] {
  return rows.map(mapKnowledgeCategoryRow);
}

export interface KnowledgeCropDTO {
  crop: string;
}
function mapKnowledgeCropRow(row: KnowledgeCropRow): KnowledgeCropDTO {
  return { crop: row.crop };
}
export function mapKnowledgeCropRows(rows: KnowledgeCropRow[]): KnowledgeCropDTO[] {
  return rows.map(mapKnowledgeCropRow);
}

// --- Visits DTOs ------------------------------------------------------------

export interface VisitWithFarmerDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  locationLat: number | null;
  locationLng: number | null;
  notes: string | null;
  outcomes: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  reminderSent: boolean | null;
  overdueAlertSent: boolean | null;
  followUpReminderSent: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  farmerName: string | null;
}
export function mapVisitWithFarmerRow(row: VisitWithFarmerRow): VisitWithFarmerDTO {
  return {
    id: row.id,
    officerId: row.officer_id,
    farmerId: row.farmer_id,
    visitType: row.visit_type,
    status: row.status,
    scheduledAt: toIso(row.scheduled_at) ?? null,
    startedAt: toIso(row.started_at) ?? null,
    completedAt: toIso(row.completed_at) ?? null,
    durationMinutes: row.duration_minutes,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    notes: row.notes,
    outcomes: row.outcomes,
    followUpRequired: row.follow_up_required,
    followUpDate: toIso(row.follow_up_date) ?? null,
    reminderSent: row.reminder_sent,
    overdueAlertSent: row.overdue_alert_sent,
    followUpReminderSent: row.follow_up_reminder_sent,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
    farmerName: row.farmer_name,
  };
}
export function mapVisitWithFarmerRows(rows: VisitWithFarmerRow[]): VisitWithFarmerDTO[] {
  return rows.map(mapVisitWithFarmerRow);
}

export interface VisitInsertDTO {
  id: string;
  officerId: string | null;
  farmerId: string | null;
  visitType: string | null;
  status: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  locationLat: number | null;
  locationLng: number | null;
  notes: string | null;
  outcomes: string | null;
  followUpRequired: boolean | null;
  followUpDate: string | null;
  reminderSent: boolean | null;
  overdueAlertSent: boolean | null;
  followUpReminderSent: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export function mapVisitInsertRow(row: VisitInsertRow): VisitInsertDTO {
  return {
    id: row.id,
    officerId: row.officer_id,
    farmerId: row.farmer_id,
    visitType: row.visit_type,
    status: row.status,
    scheduledAt: toIso(row.scheduled_at) ?? null,
    startedAt: toIso(row.started_at) ?? null,
    completedAt: toIso(row.completed_at) ?? null,
    durationMinutes: row.duration_minutes,
    locationLat: parseDecimal(row.location_lat),
    locationLng: parseDecimal(row.location_lng),
    notes: row.notes,
    outcomes: row.outcomes,
    followUpRequired: row.follow_up_required,
    followUpDate: toIso(row.follow_up_date) ?? null,
    reminderSent: row.reminder_sent,
    overdueAlertSent: row.overdue_alert_sent,
    followUpReminderSent: row.follow_up_reminder_sent,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}

export interface VisitIdDTO {
  id: string;
}
export function mapVisitIdRow(row: VisitIdRow): VisitIdDTO {
  return { id: row.id };
}

// --- SMS DTOs --------------------------------------------------------------

export interface SmsHistoryDTO {
  id: string;
  senderId: string | null;
  recipientPhone: string;
  farmerId: string | null;
  message: string;
  status: string | null;
  provider: string | null;
  createdAt: string | null;
}
function mapSmsHistoryRow(row: SmsHistoryRow): SmsHistoryDTO {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientPhone: row.recipient_phone,
    farmerId: row.farmer_id,
    message: row.message,
    status: row.status,
    provider: row.provider,
    createdAt: toIso(row.created_at) ?? null,
  };
}
export function mapSmsHistoryRows(rows: SmsHistoryRow[]): SmsHistoryDTO[] {
  return rows.map(mapSmsHistoryRow);
}

// --- Users DTOs ------------------------------------------------------------

export interface UserDTO {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  region: string | null;
  phone: string | null;
  isActive: boolean | null;
  lastLogin: string | null;
  avatarUrl: string | null;
  preferredLanguage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
function mapUserRow(row: UserRow): UserDTO {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    region: row.region,
    phone: row.phone,
    isActive: row.is_active,
    lastLogin: toIso(row.last_login) ?? null,
    avatarUrl: row.avatar_url,
    preferredLanguage: row.preferred_language,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}
export function mapUserRows(rows: UserRow[]): UserDTO[] {
  return rows.map(mapUserRow);
}

export interface UserPublicDTO {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  region: string | null;
  phone: string | null;
  isActive: boolean | null;
  preferredLanguage: string | null;
  avatarUrl: string | null;
  lastLogin: string | null;
}
export function mapUserPublicRow(row: UserPublicRow): UserPublicDTO {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    region: row.region,
    phone: row.phone,
    isActive: row.is_active,
    preferredLanguage: row.preferred_language,
    avatarUrl: row.avatar_url,
    lastLogin: toIso(row.last_login) ?? null,
  };
}
export function mapUserPublicRows(rows: UserPublicRow[]): UserPublicDTO[] {
  return rows.map(mapUserPublicRow);
}

// --- Fields DTOs -----------------------------------------------------------

export interface FieldDTO {
  id: string;
  farmerId: string | null;
  name: string | null;
  sizeHectares: number | null;
  cropType: string | null;
  soilType: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FieldStatsDTO {
  farmerId: string;
  totalFields: number;
  totalSize: number | null;
  soilTypes: string[] | null;
}
function mapFieldStatsRow(row: FieldStatsRow): FieldStatsDTO {
  return {
    farmerId: row.farmer_id,
    totalFields: parseCount(row.total_fields),
    totalSize: parseDecimal(row.total_size),
    soilTypes: row.crop_types,
  };
}
export function mapFieldStatsRows(rows: FieldStatsRow[]): FieldStatsDTO[] {
  return rows.map(mapFieldStatsRow);
}

// --- WhatsApp DTOs ---------------------------------------------------------

export interface WhatsAppMessageDTO {
  id: string;
  senderId: string | null;
  recipientPhone: string;
  farmerId: string | null;
  message: string;
  direction: string | null;
  status: string | null;
  provider: string | null;
  createdAt: string | null;
}
export function mapWhatsAppMessageRow(row: WhatsAppMessageRow): WhatsAppMessageDTO {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientPhone: row.recipient_phone,
    farmerId: row.farmer_id,
    message: row.message,
    direction: row.direction,
    status: row.status,
    provider: row.provider,
    createdAt: toIso(row.created_at) ?? null,
  };
}
export function mapWhatsAppMessageRows(rows: WhatsAppMessageRow[]): WhatsAppMessageDTO[] {
  return rows.map(mapWhatsAppMessageRow);
}

// --- Support DTOs ----------------------------------------------------------

export interface SupportTicketDTO {
  id: string;
  userId: string | null;
  subject: string;
  status: string | null;
  priority: string | null;
  category: string | null;
  description: string | null;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export function mapSupportTicketRow(row: SupportTicketRow): SupportTicketDTO {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    category: row.category,
    description: row.description,
    assignedTo: row.assigned_to,
    resolvedAt: toIso(row.resolved_at) ?? null,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}
export function mapSupportTicketRows(rows: SupportTicketRow[]): SupportTicketDTO[] {
  return rows.map(mapSupportTicketRow);
}

// --- Chatbot DTOs ----------------------------------------------------------

export interface ChatMessageDTO {
  id: string;
  conversationId: string | null;
  role: string;
  content: string;
  farmerId: string | null;
  userId: string | null;
  rating: number | null;
  feedback: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}
export function mapChatMessageRow(row: ChatMessageRow): ChatMessageDTO {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    farmerId: row.farmer_id,
    userId: row.user_id,
    rating: row.rating,
    feedback: row.feedback,
    metadata: row.metadata,
    createdAt: toIso(row.created_at) ?? null,
  };
}
export function mapChatMessageRows(rows: ChatMessageRow[]): ChatMessageDTO[] {
  return rows.map(mapChatMessageRow);
}

export interface ChatConversationDTO {
  id: string;
  userId: string | null;
  officerId?: string | null;
  farmerId: string | null;
  farmerName?: string | null;
  farmerRegion?: string | null;
  farmerPhone?: string | null;
  officerName?: string | null;
  officerRegion?: string | null;
  officerEmail?: string | null;
  title: string | null;
  status: string | null;
  language?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  messageCount?: number;
  startedAt: string | null;
  endedAt: string | null;
  satisfactionRating: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}
export function mapChatConversationRow(row: ChatConversationRow): ChatConversationDTO {
  return {
    id: row.id,
    userId: row.user_id || row.officer_id || null,
    officerId: row.officer_id || row.user_id || null,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name || row.title || null,
    farmerRegion: row.farmer_region || null,
    farmerPhone: row.farmer_phone || null,
    officerName: row.officer_name || null,
    officerRegion: row.officer_region || null,
    officerEmail: row.officer_email || null,
    title: row.title || row.farmer_name || null,
    status: row.status,
    language: row.language || 'en',
    lastMessage: row.last_message || null,
    lastMessageAt: toIso(row.last_message_at) ?? toIso(row.started_at) ?? null,
    messageCount: typeof row.message_count === 'number' ? row.message_count : parseInt(String(row.message_count || '0'), 10),
    startedAt: toIso(row.started_at) ?? null,
    endedAt: toIso(row.ended_at) ?? null,
    satisfactionRating: row.satisfaction_rating ?? row.satisfaction_score ?? null,
    metadata: row.metadata ?? null,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}
export function mapChatConversationRows(rows: ChatConversationRow[]): ChatConversationDTO[] {
  return rows.map(mapChatConversationRow);
}

export interface SatisfactionAvgDTO {
  avgSatisfaction: number | null;
  totalRatings: number;
}
export function mapSatisfactionAvgRow(row: SatisfactionAvgRow): SatisfactionAvgDTO {
  return {
    avgSatisfaction: parseDecimal(row.avg_satisfaction),
    totalRatings: parseCount(row.total_ratings),
  };
}

// --- API clients (contextMenus.ts) -----------------------------------------

export interface ApiClientDTO {
  id: string;
  name: string | null;
  description: string | null;
  permissions: string[] | null;
  rateLimitPerMin: number | null;
  isActive: boolean | null;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
/** Maps an API client row, omitting the secret `apiKeyHash` (never sent to client). */
export function mapApiClientRow(row: ApiClientRow): ApiClientDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions,
    rateLimitPerMin: row.rate_limit_per_min,
    isActive: row.is_active,
    lastUsedAt: toIso(row.last_used_at) ?? null,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at) ?? null,
    updatedAt: toIso(row.updated_at) ?? null,
  };
}
export function mapApiClientRows(rows: ApiClientRow[]): ApiClientDTO[] {
  return rows.map(mapApiClientRow);
}

// --- Diagnostics DTOs -----------------------------------------------------

export interface DiagnosticRunDTO {
  id: string;
  type: string | null;
  status: string | null;
  results: Record<string, unknown> | null;
  createdAt: string | null;
}
