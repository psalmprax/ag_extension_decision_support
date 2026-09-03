export type KnowledgeEvidenceStatus = 'verified_sources' | 'context_only' | 'no_verified_source';

export function getKnowledgeEvidenceStatus(citationCount: number, contextCount: number, maxScore?: number): KnowledgeEvidenceStatus {
    const hasStrongCitations = citationCount >= 2 && (maxScore === undefined || maxScore >= 0.75);
    if (hasStrongCitations) return 'verified_sources';
    if (citationCount > 0 && (maxScore === undefined || maxScore >= 0.5)) return 'verified_sources';
    if (contextCount > 0) return 'context_only';
    return 'no_verified_source';
}

export interface KnowledgeArticle {
    id: string;
    title: string;
    content: string;
    category: string;
    crop: string;
    tags: string[];
}
