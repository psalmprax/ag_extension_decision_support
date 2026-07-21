export interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ElementType;
  delay: number;
  cardClass?: string;
  headingClass?: string;
  dataClass?: string;
  isModern?: boolean;
  subtextClass?: string;
}

export interface Conversation {
  id: string;
  title: string;
  farmerId?: string;
  farmerName?: string;
  lastMessage?: string;
  updatedAt: string;
  startedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'officer';
  content: string;
  timestamp: string;
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
}

export interface DashboardData {
  overview: {
    totalFarmers: number;
    activeConversations: number;
    visitsThisMonth: number;
    avgSatisfaction: number;
    avgConversationsPerFarmer: number;
  };
  trends: {
    farmersGrowth: number;
    conversationsGrowth: number;
    visitsGrowth: number;
    satisfactionChange: number;
  };
}
