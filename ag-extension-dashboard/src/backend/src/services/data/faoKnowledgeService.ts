/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { VectorService } from '../vectorService';

export interface FaoArticle {
    title: string;
    content: string;
    crops: string[];
    regions: string[];
}

/**
 * Service to handle ingestion and structuring of FAO/CGIAR agronomic data into the vector database.
 */
export class FaoKnowledgeService {
    /**
     * Finds the best split point for a text slice to prevent word truncation.
     */
    private getSplitPoint(text: string, start: number, end: number, chunkSize: number): number {
        if (end >= text.length) return end;
        const lastSpace = text.substring(start, end).lastIndexOf(' ');
        return lastSpace > chunkSize * 0.8 ? start + lastSpace : end;
    }

    /**
     * Safely appends remaining text either as a new chunk or merging into the last one.
     */
    private appendRemainingText(chunks: string[], remaining: string, chunkSize: number): void {
        if (remaining.length === 0) return;
        
        const lastChunk = chunks.at(-1);
        if (lastChunk && (lastChunk.length + remaining.length) < chunkSize) {
            const lastIndex = chunks.length - 1;
            chunks[lastIndex] = (lastChunk + " " + remaining).trim();
        } else {
            chunks.push(remaining);
        }
    }

    /**
     * Chunks a long text into smaller segments on word boundaries.
     */
    chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
        if (!text || text.trim().length === 0) return [];
        if (text.length <= chunkSize) return [text.trim()];

        const chunks: string[] = [];
        let start = 0;

        while (start < text.length) {
            const end = this.getSplitPoint(text, start, start + chunkSize, chunkSize);
            const chunk = text.substring(start, end).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }

            // Move pointer forward by chunkSize minus overlap
            start = end - overlap;
            if (start >= text.length - overlap) {
                this.appendRemainingText(chunks, text.substring(end).trim(), chunkSize);
                break;
            }
        }

        return chunks;
    }

    /**
     * Segment, embed, and store unstructured FAO agronomic articles in PostgreSQL.
     */
    async ingestAgronomicData(articles: FaoArticle[]): Promise<void> {
        try {
            logger.info(`Started ingestion of ${articles.length} FAO knowledge articles.`);
            
            let totalChunks = 0;

            for (const article of articles) {
                logger.info(`Processing article: "${article.title}"...`);
                const chunks = this.chunkText(article.content);
                logger.info(`Split "${article.title}" into ${chunks.length} chunks.`);

                for (let i = 0; i < chunks.length; i++) {
                    const chunkId = uuidv4();
                    const chunkContent = chunks[i];
                    
                    // Construct precise metadata for the chunk
                    const metadata = {
                        title: `${article.title} - Part ${i + 1}`,
                        category: 'Agronomic Knowledge',
                        crops: article.crops,
                        regions: article.regions,
                        source: 'FAO / CGIAR Manuals',
                        sourceUrl: `https://www.fao.org/agronomy/guidelines/${encodeURIComponent(article.title.toLowerCase().split(' ').join('-'))}`,
                        contentType: 'text',
                        order: i
                    };

                    logger.debug(`Ingesting chunk ${i + 1}/${chunks.length} for "${article.title}"`);
                    await VectorService.upsertDocument(chunkId, chunkContent, metadata);
                    totalChunks++;
                }
            }
            
            logger.info(`FAO knowledge ingestion completed successfully. Total chunks stored: ${totalChunks}`);
        } catch (error) {
            logger.error(`Error ingesting FAO knowledge: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw new Error(`Failed to ingest FAO knowledge: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
}

export const faoKnowledgeService = new FaoKnowledgeService();


