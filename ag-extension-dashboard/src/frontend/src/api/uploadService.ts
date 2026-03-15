import apiClient from './client';

export interface UploadedFile {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    url: string;
}

export const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data.data;
};

export const uploadMultipleFiles = async (files: File[]): Promise<UploadedFile[]> => {
    const formData = new FormData();
    files.forEach((file) => {
        formData.append('files', file);
    });

    const { data } = await apiClient.post('/upload/multiple', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data.data;
};

export const uploadFarmerImage = async (file: File, farmerId: string): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('farmerId', farmerId);

    const { data } = await apiClient.post('/upload/farmer/image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data.data;
};

export const uploadFarmDocument = async (file: File, farmId: string, documentType: string): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('farmId', farmId);
    formData.append('documentType', documentType);

    const { data } = await apiClient.post('/upload/farm/document', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return data.data;
};
