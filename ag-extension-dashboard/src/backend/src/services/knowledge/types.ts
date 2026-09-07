/** Shared lightweight types for the knowledge pipeline (no runtime code). */
export interface KnowledgeAttachment {
    type: 'image' | 'file' | 'audio';
    data: string;
    mimeType?: string;
}

export interface ReasonOptions {
    preferredProvider?: string;
}

export interface AskOptions extends ReasonOptions {
    bypassCache?: boolean;
}
