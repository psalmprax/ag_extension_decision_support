export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'admin' | 'extension_officer' | 'farmer';
    region?: string;
    phone?: string;
}

export interface Farmer {
    id: string;
    firstName: string;
    lastName: string;
    location?: string;
    village?: string;
    phone?: string;
    languagePreference?: string;
    crops?: string[];
    farmSize?: number;
    latitude?: number;
    longitude?: number;
    region?: string;
    yield?: number;
    status?: string;
    vitalScore?: number;
    yieldHistory?: { month: string; yield: number }[];
}

export interface Visit {
    id: string;
    farmer_id: string;
    farmer_name: string;
    visit_type: string;
    status: 'scheduled' | 'completed' | 'cancelled' | 'pending';
    scheduled_at: string;
    notes?: string;
    outcomes?: string;
    reason?: string;
}

export interface Report {
    id: string;
    title: string;
    status: string;
    generatedAt: string;
    createdBy?: string;
    downloadUrl?: string;
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

export interface ShareSettings {
    accessType: 'restricted' | 'organization' | 'public';
    expiresIn: string;
    allowExport: boolean;
}

export interface ShareData {
    shareId: string;
    shareUrl: string;
    expiresAt?: string;
    accessType: string;
}
