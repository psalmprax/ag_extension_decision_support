/**
 * Raw SQL row types — internal `query<T>()` return shapes.
 *
 * Row interfaces mirror the exact columns returned by raw `pg` queries
 * (snake_case). These are NOT exposed to the API — routes map them to
 * camelCase DTOs via the functions in `./dtos.ts`.
 *
 * For Prisma queries, prefer the generated `Prisma.*GetPayload<>` types
 * from `@prisma/client` instead of these row types.
 */

// --- Count row (used by all COUNT(*) queries) -------------------------------

export interface CountRow {
  count: string;
}

// --- Portfolio routes (portfolio.ts) ----------------------------------------

export interface PriorityQueueRow {
  farmer_id: string;
  name: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  crop: string | null;
}

export interface RecommendedVisitRow {
  farmer_id: string;
  name: string;
  lat: string | number | null;
  lng: string | number | null;
  reason: string;
  priority: number;
  estimatedtime: number;
}

export interface AlertSummaryRow {
  type: string;
  severity: string | null;
  description: string | null;
  location: string | null;
}

export interface FarmerDetailRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  farm_size_hectares: string | number | null;
  crops: string[] | null;
  language_preference: string | null;
  last_visit: Date | string | null;
}

export interface PortfolioExportFarmerRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  village: string | null;
  district: string | null;
  region: string | null;
  farm_size_hectares: string | number | null;
  crops: string[] | null;
  total_visits: string;
  last_visit_date: Date | string | null;
}

export interface PortfolioExportVisitRow {
  id: string;
  officer_id: string | null;
  farmer_id: string | null;
  visit_type: string | null;
  status: string | null;
  scheduled_at: Date | string | null;
  notes: string | null;
  first_name: string;
  last_name: string;
  village: string | null;
  type?: string;
}

// --- Knowledge routes (knowledge.ts) ----------------------------------------

export interface KnowledgeArticleRow {
  id: string;
  title: string;
  content: string;
  content_type: string | null;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  crops: string[] | null;
  regions: string[] | null;
  source: string | null;
  source_url: string | null;
}

export interface KnowledgeCategoryRow {
  category: string;
}

export interface KnowledgeCropRow {
  crop: string;
}

export interface KnowledgeVectorMetadata {
  title: string;
  category?: string | null;
  tags?: string[] | null;
  crops?: string[] | null;
  regions?: string[] | null;
  source?: string | null;
  sourceUrl?: string | null;
  contentType?: string | null;
}

export interface KnowledgeArticleForVector {
  id: string;
  content: string;
  title: string;
  category?: string | null;
  tags?: string[] | null;
  crops?: string[] | null;
  regions?: string[] | null;
  source?: string | null;
  sourceUrl?: string | null;
  contentType?: string | null;
}

// --- Reporting routes (reporting.ts) ----------------------------------------

export interface VisitStatsRow {
  total: string;
  completed: string;
  total_minutes: string | null;
}

export interface ConversationStatsRow {
  total_conversations: string;
  rated: string;
  avg_satisfaction: string | number | null;
}

/** Discriminated JSON shape stored in `reports.content` (Postgres JSONB). */
export interface ReportMetadata {
  region?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  officerId?: string | null;
  cropType?: string | null;
}

export interface ReportContent {
  visits?: VisitStatsRow;
  conversations?: ConversationStatsRow;
  metadata?: ReportMetadata;
  // Disease diagnosis fields
  overallHealth?: 'healthy' | 'stressed' | 'diseased';
  confidence?: number;
  diseases?: Array<{
    disease: string;
    severity?: string;
    confidence?: number;
    description?: string;
    symptoms?: string[];
    treatment?: string[];
  }>;
  nutrientDeficiencies?: string[];
  recommendations?: string[];
  // Soil diagnostic fields
  overallHealthScore?: number;
  texture?: string;
  estimatedMoisture?: string;
  drainageClass?: string;
  colorDiscoloration?: string;
  npkDeficiencies?: {
    nitrogen?: string;
    phosphorus?: string;
    potassium?: string;
  };
  cropSuitability?: string[];
}

export interface ReportListRow {
  id: string;
  type: string;
  title: string;
  status: string | null;
  content: ReportContent;
  created_at: Date | string;
  updated_at: Date | string | null;
}

// --- Visits routes (visits.ts) ---------------------------------------------

export interface VisitWithFarmerRow {
  id: string;
  officer_id: string | null;
  farmer_id: string | null;
  visit_type: string | null;
  status: string | null;
  scheduled_at: Date | string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  duration_minutes: number | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  notes: string | null;
  outcomes: string | null;
  follow_up_required: boolean | null;
  follow_up_date: Date | string | null;
  reminder_sent: boolean | null;
  overdue_alert_sent: boolean | null;
  follow_up_reminder_sent: boolean | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  farmer_name: string | null;
}

export interface VisitInsertRow {
  id: string;
  officer_id: string | null;
  farmer_id: string | null;
  visit_type: string | null;
  status: string | null;
  scheduled_at: Date | string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  duration_minutes: number | null;
  location_lat: string | number | null;
  location_lng: string | number | null;
  notes: string | null;
  outcomes: string | null;
  follow_up_required: boolean | null;
  follow_up_date: Date | string | null;
  reminder_sent: boolean | null;
  overdue_alert_sent: boolean | null;
  follow_up_reminder_sent: boolean | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface VisitIdRow {
  id: string;
}

// --- SMS routes (sms.ts) ---------------------------------------------------

export interface SmsHistoryRow {
  id: string;
  sender_id: string | null;
  recipient_phone: string;
  farmer_id: string | null;
  message: string;
  status: string | null;
  provider: string | null;
  created_at: Date | string | null;
}

// --- Users routes (users.ts) -----------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  region: string | null;
  phone: string | null;
  is_active: boolean | null;
  last_login: Date | string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface UserPublicRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  region: string | null;
  phone: string | null;
  is_active: boolean | null;
  preferred_language: string | null;
  avatar_url: string | null;
  last_login: Date | string | null;
}

// --- Fields routes (fields.ts) ---------------------------------------------

export interface FieldRow {
  id: string;
  farmer_id: string | null;
  name: string | null;
  size_hectares: string | number | null;
  crop_type: string | null;
  soil_type: string | null;
  lat: string | number | null;
  lng: string | number | null;
  notes: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface FieldStatsRow {
  farmer_id: string;
  total_fields: string;
  total_size: string | number | null;
  crop_types: string[] | null;
}

// --- WhatsApp routes (whatsapp.ts) -----------------------------------------

export interface WhatsAppMessageRow {
  id: string;
  sender_id: string | null;
  recipient_phone: string;
  farmer_id: string | null;
  message: string;
  direction: string | null;
  status: string | null;
  provider: string | null;
  created_at: Date | string | null;
}

// --- Support routes (support.ts) -------------------------------------------

export interface SupportTicketRow {
  id: string;
  user_id: string | null;
  subject: string;
  status: string | null;
  priority: string | null;
  category: string | null;
  description: string | null;
  assigned_to: string | null;
  resolved_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

// --- Chatbot routes (chatbot.ts) -------------------------------------------

export interface ChatMessageRow {
  id: string;
  conversation_id: string | null;
  role: string;
  content: string;
  farmer_id: string | null;
  user_id: string | null;
  rating: number | null;
  feedback: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string | null;
}

export interface ChatConversationRow {
  id: string;
  user_id?: string | null;
  officer_id?: string | null;
  farmer_id: string | null;
  title?: string | null;
  status: string | null;
  language?: string | null;
  started_at: Date | string | null;
  ended_at?: Date | string | null;
  satisfaction_rating?: number | null;
  satisfaction_score?: number | null;
  metadata?: Record<string, unknown> | null;
  farmer_name?: string | null;
  farmer_region?: string | null;
  farmer_phone?: string | null;
  officer_name?: string | null;
  officer_region?: string | null;
  officer_email?: string | null;
  last_message?: string | null;
  last_message_at?: Date | string | null;
  message_count?: number | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface SatisfactionAvgRow {
  avg_satisfaction: string | number | null;
  total_ratings: string;
}

// --- API clients (contextMenus.ts) -----------------------------------------

export interface ApiClientRow {
  id: string;
  name: string | null;
  description: string | null;
  api_key_hash: string | null;
  permissions: string[] | null;
  rate_limit_per_min: number | null;
  is_active: boolean | null;
  last_used_at: Date | string | null;
  created_by: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

// --- Diagnostics routes (diagnostics.ts) -----------------------------------

export interface DiagnosticRunRow {
  id: string;
  type: string | null;
  status: string | null;
  results: Record<string, unknown> | null;
  created_at: Date | string | null;
}

// --- Common request augmentations -------------------------------------------

export interface AuthenticatedRequestUser {
  userId: string;
  email: string;
  role: 'admin' | 'regional_manager' | 'extension_officer' | 'farmer';
}

// --- Channel Gateway & Onboarding types (channels.ts, telegram.ts) -----------

export interface TenantChannelConfigRow {
  id: string;
  tenant_id: string;
  channel: string;
  provider: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
  auto_onboarding: boolean;
  welcome_template: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface TelegramMessageRow {
  id: string;
  tenant_id: string | null;
  chat_id: string;
  username: string | null;
  first_name: string | null;
  message: string;
  direction: string;
  status: string;
  farmer_id: string | null;
  sender_id: string | null;
  created_at: Date | string | null;
}

export interface FarmerOnboardingSessionRow {
  id: string;
  tenant_id: string | null;
  channel: string;
  external_identifier: string;
  step: string;
  collected_data: Record<string, unknown>;
  created_farmer_id: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface AutonomousCampaignRunRow {
  id: string;
  tenant_id: string | null;
  created_by: string | null;
  goal_prompt: string;
  target_region: string | null;
  target_crop: string | null;
  status: string;
  affected_farmers_count: number;
  dispatched_messages_count: number;
  scheduled_visits_count: number;
  execution_trace: Array<Record<string, unknown>>;
  advisory_summary: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface RegionalAgronomySkillRow {
  id: string;
  tenant_id: string | null;
  region: string;
  crop: string;
  topic: string;
  title: string;
  skill_markdown: string;
  source_type: string;
  source_visit_id: string | null;
  created_by: string | null;
  confidence_score: number | null;
  usage_count: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}


