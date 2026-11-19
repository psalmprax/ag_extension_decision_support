export interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  delay: number;
  cardClass?: string;
  headingClass?: string;
  dataClass?: string;
}

export interface Conversation {
  id: string;
  /** farmer_thread (farmer, officer, AI) or officer_ai (an officer's private AI chat). */
  kind?: 'farmer_thread' | 'officer_ai';
  title: string;
  farmerId?: string;
  farmerName?: string;
  farmerRegion?: string;
  /** The farmer's assigned officer (as the API sends it). */
  officerName?: string | null;
  lastMessage?: string;
  updatedAt: string;
  startedAt: string;
}

export interface ChatMessage {
  /** 'user' and 'farmer' are both the farmer; 'assistant' is the AI. */
  role: 'user' | 'farmer' | 'assistant' | 'officer';
  /** Received or delivered by SMS, WhatsApp or Telegram; absent or null = in the app. */
  channel?: 'sms' | 'whatsapp' | 'telegram' | null;
  content: string;
  // Backend ChatMessageDTO carries `createdAt`; some producers send
  // `timestamp`. Either may be absent — renderers must tolerate both.
  timestamp?: string;
  createdAt?: string | null;
  /** Photos sent with the message in the app. */
  attachments?: ChatAttachment[];
}

/** A photo on a chat message, visit report or progress entry; `url` needs the signed-in session. */
export interface ChatAttachment {
  id: string;
  url: string;
  name: string;
  mimeType: string;
}

export interface Farmer {
  id: string;
  firstName: string;
  lastName: string;
  region?: string;
  village?: string;
  farmSize?: number;
  crops?: string[];
  latitude?: number;
  longitude?: number;
  phone?: string;
  yield?: number;
  status?: string;
  district?: string;
  yieldHistory?: { month: string; yield: number }[];
  vitalScore?: number;
  languagePreference?: string;
}

import type { Report } from '@/api/reportService';
export type { Report };

export interface Visit {
  id: string;
  farmer_id: string;
  farmer_name: string;
  scheduled_at: string;
  visit_type: string;
  status: string;
  reason?: string;
  notes?: string;
  outcomes?: string;
  farmerId?: string;
  farmerName?: string;
  visitType?: string;
  scheduledAt?: string;
  started_at?: string;
  startedAt?: string;
  completed_at?: string;
  completedAt?: string;
  /** Visit report: whether the farmer needs a follow-up, and by when (YYYY-MM-DD). */
  followUpRequired?: boolean | null;
  follow_up_required?: boolean | null;
  followUpDate?: string | null;
  follow_up_date?: string | null;
  durationMinutes?: number | null;
}

export interface DashboardData {
  overview: {
    totalFarmers: number;
    activeConversations: number;
    visitsThisMonth: number;
    avgSatisfaction: number;
    avgConversationsPerFarmer: number;
    totalHectares?: number;
    avgYield?: number;
  };
  trends: {
    farmersGrowth: number;
    conversationsGrowth: number;
    visitsGrowth: number;
    satisfactionChange: number;
  };
  geography?: { region: string; farmers: number }[];
  crops?: { name: string; count: number }[];
}
