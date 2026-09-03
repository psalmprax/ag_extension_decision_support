export type QueueState = 'pending' | 'failed' | 'conflict' | 'dead_letter';

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
    /** Epoch ms before which automatic replay must not run (exponential backoff). */
    nextAttemptAt?: number;
    // Dead letter metadata
    movedToDeadLetterAt?: number;
    originalRetries?: number;
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
