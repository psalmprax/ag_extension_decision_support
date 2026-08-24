export type QueueState = 'pending' | 'failed' | 'conflict';

export interface QueuedRequest<T = unknown> {
    id: string;
    idempotencyKey: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: T;
    attachmentRefs?: string[];
    timestamp: number;
    retries: number;
    maxRetries: number;
    state: QueueState;
    lastError?: string;
}

export interface OfflineStatus {
    isOnline: boolean;
    lastChecked: number;
}

export interface OfflineAttachment {
    id: string;
    file: Blob;
    farmerId: string;
    sizeBytes: number;
    createdAt: number;
    uploadedId?: string;
    encryptedFarmerId?: string;
}
