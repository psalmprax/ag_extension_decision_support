import apiClient from './client';

// ── Route optimizer ──────────────────────────────────────────────────────────

export interface PlannedStop {
    visitId: string;
    farmerName: string | null;
    lat: number;
    lng: number;
    daysOverdue: number;
    order: number;
    legKm: number;
    priorityWeight: number;
}

// ── Farm plans ───────────────────────────────────────────────────────────────

export interface PlanMilestone {
    id: string;
    title: string;
    category: string;
    dueDate: string | null;
    status: 'pending' | 'done' | 'missed';
    completedAt: string | null;
}

// ── Gamification ─────────────────────────────────────────────────────────────

export interface OfficerScore {
    officerId: string;
    officerName: string;
    region: string | null;
    visitsCompleted: number;
    outcomesRecorded: number;
    efficacySuccessRate: number | null;
    farmersSupported: number;
    score: number;
    badges: string[];
}

// ── Soil lab ─────────────────────────────────────────────────────────────────

export interface SoilLabResult {
    id: string;
    labName: string | null;
    sampleRef: string | null;
    ph: number | null;
    nitrogenPpm: number | null;
    phosphorusPpm: number | null;
    potassiumPpm: number | null;
    organicMatterPct: number | null;
    testedAt: string | null;
}

export const fieldIntelService = {
    async getRoutePlan(maxStops = 10): Promise<{ stops: PlannedStop[]; totalKm: number }> {
        const { data } = await apiClient.get('/field-intel/route-plan', { params: { maxStops } });
        return data.data;
    },

    async generateFarmPlan(cropCycleId: string): Promise<{ milestones: number; crop: string }> {
        const { data } = await apiClient.post(`/field-intel/farm-plans/${cropCycleId}/generate`);
        return data.data;
    },

    async getFarmPlan(cropCycleId: string): Promise<PlanMilestone[]> {
        const { data } = await apiClient.get(`/field-intel/farm-plans/${cropCycleId}`);
        return data.data;
    },

    async setMilestoneStatus(milestoneId: string, status: 'pending' | 'done' | 'missed'): Promise<void> {
        await apiClient.patch(`/field-intel/farm-plans/milestones/${milestoneId}`, { status });
    },

    async getLeaderboard(): Promise<OfficerScore[]> {
        const { data } = await apiClient.get('/field-intel/leaderboard');
        return data.data;
    },

    async importSoilLab(csv: string): Promise<{ imported: number; unmatchedFarmers: string[] }> {
        const { data } = await apiClient.post('/field-intel/soil-lab/import', { csv });
        return data.data;
    },

    async getSoilLabResults(farmerId: string): Promise<SoilLabResult[]> {
        const { data } = await apiClient.get(`/field-intel/soil-lab/farmer/${farmerId}`);
        return data.data;
    },

    misExportUrl(dataset: 'farmers' | 'visits' | 'outcomes'): string {
        return `/field-intel/mis/export/${dataset}`;
    },
};
