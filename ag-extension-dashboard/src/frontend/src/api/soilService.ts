import apiClient from './client';

export interface SoilGridsBaseline {
  source: string;
  dataStatus: string;
  disclaimer: string;
  location: { lat: number; lon: number };
  depth: string;
  ph: number | null;
  organicCarbonGPerKg: number | null;
  nitrogenCgPerKg: number | null;
  nitrogenMgPerKg: number | null;
  cecCmolPerKg: number | null;
  bulkDensityKgPerM3: number | null;
  sandPct: number | null;
  siltPct: number | null;
  clayPct: number | null;
}

export interface SoilMoistureSnapshot {
  source: string;
  dataStatus: string;
  disclaimer: string;
  location: { lat: number; lon: number };
  fetchedAt: string;
  soilMoisture: { '0-1cm': number | null; '1-3cm': number | null; '3-9cm': number | null; '9-27cm': null; avgTop9cm: number | null };
  soilTemperature: { '0cm': number | null; '6cm': number | null; avgTop6cm: number | null };
}

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

export interface FarmerSoilProfile {
  labResults: SoilLabResult[];
  baseline: SoilGridsBaseline | null;
  moisture: SoilMoistureSnapshot | null;
  location: { lat: number; lon: number } | null;
}

export const fetchSoilGrids = async (lat: number, lon: number) => {
  const { data } = await apiClient.get<{ success: boolean; data: SoilGridsBaseline }>(`/soil/grid`, { params: { lat, lon } });
  return data;
};

export const fetchSoilMoisture = async (lat: number, lon: number) => {
  const { data } = await apiClient.get<{ success: boolean; data: SoilMoistureSnapshot }>(`/soil/moisture`, { params: { lat, lon } });
  return data;
};

export const fetchFarmerSoilProfile = async (farmerId: string) => {
  const { data } = await apiClient.get<{ success: boolean; data: FarmerSoilProfile }>(`/soil/farmer/${farmerId}`);
  return data;
};
