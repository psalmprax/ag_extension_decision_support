/**
 * @deprecated This module is a back-compat shim.
 *
 * Row types now live in `./rowTypes.ts` (snake_case raw SQL shapes), and
 * API DTOs + mappers live in `./dtos.ts`. New code should import directly
 * from those modules:
 *
 * ```ts
 * import type { UserRow } from '@/types/rowTypes';
 * import { mapUserRow, type UserDTO } from '@/types/dtos';
 * ```
 *
 * This re-export shim exists only so existing imports continue to compile
 * while the codebase is migrated. It will be removed once all routes are
 * updated to import from the new modules.
 */
export type {
  CountRow,
  PriorityQueueRow,
  RecommendedVisitRow,
  AlertSummaryRow,
  FarmerDetailRow,
  PortfolioExportFarmerRow,
  PortfolioExportVisitRow,
  KnowledgeArticleRow,
  KnowledgeCategoryRow,
  KnowledgeCropRow,
  KnowledgeVectorMetadata,
  KnowledgeArticleForVector,
  ReportListRow,
  VisitStatsRow,
  ConversationStatsRow,
  ReportMetadata,
  ReportContent,
  VisitWithFarmerRow,
  VisitInsertRow,
  VisitIdRow,
  SmsHistoryRow,
  UserRow,
  UserPublicRow,
  FieldRow,
  FieldStatsRow,
  WhatsAppMessageRow,
  SupportTicketRow,
  ChatMessageRow,
  ChatConversationRow,
  SatisfactionAvgRow,
  ApiClientRow,
  DiagnosticRunRow,
  AuthenticatedRequestUser,
} from './rowTypes';
