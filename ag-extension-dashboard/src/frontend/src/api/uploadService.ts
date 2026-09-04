import apiClient from './client';

export interface UploadedFile {
  id?: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  sha256?: string;
  url: string;
  source?: string;
}

// fallow-ignore-next-line unused-type
export interface StorageInfo {
  backend: 'cloudflare-r2' | 'backblaze-b2' | 'aws-s3' | 'minio' | 'local-disk';
  isCloud: boolean;
  maxUploadBytes: number;
  maxUploadMb: number;
  supportedMimeTypes: string[];
}

// fallow-ignore-next-line unused-export
export const fetchStorageInfo = async (): Promise<StorageInfo> => {
  const { data } = await apiClient.get<{ success: boolean; data: StorageInfo }>('/upload/info');
  return data.data;
};

// fallow-ignore-next-line unused-export
export const uploadFile = async (file: File, farmerId?: string): Promise<UploadedFile> => {
  const formData = new FormData();
  formData.append('file', file);
  if (farmerId) formData.append('farmerId', farmerId);

  const { data } = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const uploadMultipleFiles = async (files: File[]): Promise<UploadedFile[]> => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const { data } = await apiClient.post('/upload/multiple', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data.data;
};

// fallow-ignore-next-line unused-export
export const requestPresignedUpload = async (params: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  farmerId?: string;
}): Promise<{ uploadUrl: string; storageKey: string; publicUrl?: string | null }> => {
  const { data } = await apiClient.post<{
    success: boolean;
    data: { uploadUrl: string; storageKey: string; publicUrl?: string | null };
  }>('/upload/presign', params);
  return data.data;
};

// fallow-ignore-next-line unused-export
export const confirmDirectUpload = async (storageKey: string): Promise<UploadedFile> => {
  const { data } = await apiClient.post<{ success: boolean; data: UploadedFile }>('/upload/confirm', {
    storageKey,
  });
  return data.data;
};

/**
 * Upload large video, audio, or document files directly to Cloudflare R2 / S3 via Presigned URL.
 * Bypasses backend webserver RAM and network bottlenecks. Falls back to multipart upload if presigning is unavailable.
 */
// fallow-ignore-next-line unused-export
export const uploadLargeMediaDirect = async (
  file: File,
  farmerId?: string,
  onProgress?: (percent: number) => void
): Promise<UploadedFile> => {
  try {
    const { uploadUrl, storageKey } = await requestPresignedUpload({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      farmerId,
    });

    // Upload directly to Cloudflare R2 / S3
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Direct storage upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during direct object storage upload'));
      xhr.send(file);
    });

    // Confirm with backend to activate the record
    return await confirmDirectUpload(storageKey);
  } catch {
    // Graceful fallback to multipart standard upload if cloud presigning isn't active
    return await uploadFile(file, farmerId);
  }
};
