import type {
  ConversationStatsRow,
  ChatMessageRow,
  ChatConversationRow,
  SatisfactionAvgRow,
} from '../rowTypes';
import { parseCount, parseDecimal, toIso } from './common';

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

const getNullableString = (val?: string | null) => val ?? null;
const getLastMsgIso = (row: ChatConversationRow) => toIso(row.last_message_at) ?? toIso(row.started_at) ?? null;
const getSatisfactionRating = (row: ChatConversationRow) => row.satisfaction_rating ?? row.satisfaction_score ?? null;
const getMsgCount = (row: ChatConversationRow): number => {
  if (typeof row.message_count === 'number') return row.message_count;
  return parseCount(row.message_count != null ? String(row.message_count) : null);
};

export function mapChatConversationRow(row: ChatConversationRow): ChatConversationDTO {
  const displayName = row.farmer_name ?? row.title ?? null;

  return {
    id: row.id,
    userId: getNullableString(row.user_id),
    officerId: getNullableString(row.officer_id),
    farmerId: row.farmer_id,
    farmerName: displayName,
    farmerRegion: getNullableString(row.farmer_region),
    farmerPhone: getNullableString(row.farmer_phone),
    officerName: getNullableString(row.officer_name),
    officerRegion: getNullableString(row.officer_region),
    officerEmail: getNullableString(row.officer_email),
    title: displayName,
    status: row.status,
    language: row.language ?? 'en',
    lastMessage: getNullableString(row.last_message),
    lastMessageAt: getLastMsgIso(row),
    messageCount: getMsgCount(row),
    startedAt: toIso(row.started_at) ?? null,
    endedAt: toIso(row.ended_at) ?? null,
    satisfactionRating: getSatisfactionRating(row),
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
