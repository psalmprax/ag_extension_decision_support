import type {
  CountRow,
  PriorityQueueRow,
  RecommendedVisitRow,
  AlertSummaryRow,
  ReportListRow,
  SmsHistoryRow,
  UserRow,
  UserPublicRow,
  FieldStatsRow,
  WhatsAppMessageRow,
  SupportTicketRow,
  ApiClientRow,
} from '../rowTypes';
import { parseCount, parseDecimal, toIso } from './common';

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

// --- Reporting DTOs --------------------------------------------------------

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
  country: string | null;
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
    country: row.country ?? null,
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
  country: string | null;
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
    country: row.country ?? null,
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
