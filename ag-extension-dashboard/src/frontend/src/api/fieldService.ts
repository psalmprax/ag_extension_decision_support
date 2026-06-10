import apiClient from './client';

export interface Field {
    id: string;
    farmerId: string;
    name: string;
    areaHectares: number;
    soilType?: string;
    soilPh?: number;
    latitude?: number;
    longitude?: number;
    boundaryCoordinates?: any; // GeoJSON or JSON structure
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    cropCycles?: CropCycle[];
}

export interface CropCycle {
    id: string;
    fieldId: string;
    cropName: string;
    variety?: string;
    status: 'planned' | 'growing' | 'harvested' | 'failed';
    plantingDate?: string;
    expectedHarvestDate?: string;
    actualHarvestDate?: string;
    yieldKg?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export const fetchFields = async (farmerId?: string) => {
    const url = farmerId ? `/fields?farmerId=${farmerId}` : '/fields';
    const response = await apiClient.get(`/v1${url}`);
    return response.data;
};

export const fetchFieldById = async (id: string) => {
    const response = await apiClient.get(`/v1/fields/${id}`);
    return response.data;
};

export const createField = async (data: Partial<Field>) => {
    const response = await apiClient.post('/v1/fields', data);
    return response.data;
};

export const updateField = async (id: string, data: Partial<Field>) => {
    const response = await apiClient.put(`/v1/fields/${id}`, data);
    return response.data;
};

export const deleteField = async (id: string) => {
    const response = await apiClient.delete(`/v1/fields/${id}`);
    return response.data;
};

export const fetchCropCycles = async (fieldId: string) => {
    const response = await apiClient.get(`/v1/fields/${fieldId}/cycles`);
    return response.data;
};

export const createCropCycle = async (fieldId: string, data: Partial<CropCycle>) => {
    const response = await apiClient.post(`/v1/fields/${fieldId}/cycles`, data);
    return response.data;
};

export const updateCropCycle = async (fieldId: string, cycleId: string, data: Partial<CropCycle>) => {
    const response = await apiClient.patch(`/v1/fields/${fieldId}/cycles/${cycleId}`, data);
    return response.data;
};

export const deleteCropCycle = async (fieldId: string, cycleId: string) => {
    const response = await apiClient.delete(`/v1/fields/${fieldId}/cycles/${cycleId}`);
    return response.data;
};
