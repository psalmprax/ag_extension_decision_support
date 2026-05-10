import { ReactNode } from 'react';

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
}

export interface Report {
    id: string;
    title: string;
    type: string;
    generatedAt: string;
    url?: string;
}

export interface Visit {
    id: string;
    farmer_id: string;
    farmer_name: string;
    scheduled_at: string;
    visit_type: string;
    status: string;
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
