import apiClient from './client';

// ── Advice efficacy ──────────────────────────────────────────────────────────

export type OutcomeVerdict = 'resolved' | 'improved' | 'unresolved' | 'worsened' | 'lost_to_followup';

export interface OutcomeRecord {
    id: string;
    visitId: string | null;
    farmerId: string | null;
    crop: string;
    adviceCategory: string;
    outcome: OutcomeVerdict;
    measuredAt: string;
}

export interface EfficacyCategory {
    crop: string;
    adviceCategory: string;
    total: number;
    successCount: number;
    successRate: number;
}

export interface EfficacySummary {
    windowDays: number;
    totalOutcomes: number;
    successCount: number;
    overallSuccessRate: number;
    byCategory: EfficacyCategory[];
}

export interface FollowUpItem {
    visitId: string;
    farmerId: string | null;
    farmerName: string | null;
    visitDate: string | null;
    notes: string | null;
    daysOverdue: number;
}

export const efficacyService = {
    async recordOutcome(input: {
        visitId?: string;
        farmerId?: string;
        crop: string;
        adviceCategory: string;
        adviceSummary: string;
        outcome: OutcomeVerdict;
        officerNotes?: string;
    }): Promise<OutcomeRecord> {
        const { data } = await apiClient.post('/efficacy/outcomes', input);
        return data.data;
    },

    async getSummary(params: { days?: number; crop?: string } = {}): Promise<EfficacySummary> {
        const { data } = await apiClient.get('/efficacy/summary', { params });
        return data.data;
    },

    async getFollowUps(): Promise<FollowUpItem[]> {
        const { data } = await apiClient.get('/efficacy/followups');
        return data.data;
    },
};

// ── Proactive advisories ─────────────────────────────────────────────────────

export interface AdvisoryDispatch {
    ruleKey: string;
    district: string;
    channel: string;
    audienceCount: number;
    message: string;
    severity: string;
    dispatchedAt: string;
}

export interface AdvisoryPreference {
    optIn: boolean;
    channels: string[];
    categories: string[];
}

export const advisoryService = {
    async getRecent(limit = 20): Promise<AdvisoryDispatch[]> {
        const { data } = await apiClient.get('/advisories/recent', { params: { limit } });
        return data.data;
    },

    async getPreference(farmerId: string): Promise<AdvisoryPreference> {
        const { data } = await apiClient.get(`/advisories/preferences/${farmerId}`);
        return data.data;
    },

    async setPreference(farmerId: string, pref: AdvisoryPreference): Promise<AdvisoryPreference> {
        const { data } = await apiClient.put('/advisories/preferences', { farmerId, ...pref });
        return data.data;
    },
};

// ── Outbreak intelligence ────────────────────────────────────────────────────

export interface OutbreakCluster {
    district: string;
    crop: string;
    diseaseLabel: string;
    caseCount: number;
    distinctFarmers: number;
    firstSeen: string;
    lastSeen: string;
    centroid: { lat: number; lng: number } | null;
    alert?: boolean;
}

export const outbreakService = {
    async getClusters(params: { days?: number; bbox?: string } = {}): Promise<OutbreakCluster[]> {
        const { data } = await apiClient.get('/outbreaks', { params });
        return data.data;
    },
};
