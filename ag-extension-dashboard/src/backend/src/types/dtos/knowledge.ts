import type {
  KnowledgeArticleRow,
  KnowledgeCategoryRow,
  KnowledgeCropRow,
} from '../rowTypes';

// --- Knowledge DTOs --------------------------------------------------------

export interface KnowledgeArticleDTO {
  id: string;
  title: string;
  content: string;
  contentType: string | null;
  summary: string | null;
  category: string | null;
  tags: string[] | null;
  crops: string[] | null;
  regions: string[] | null;
  source: string | null;
  sourceUrl: string | null;
}
export function mapKnowledgeArticleRow(row: KnowledgeArticleRow): KnowledgeArticleDTO {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    contentType: row.content_type,
    summary: row.summary,
    category: row.category,
    tags: row.tags,
    crops: row.crops,
    regions: row.regions,
    source: row.source,
    sourceUrl: row.source_url,
  };
}

export interface KnowledgeCategoryDTO {
  category: string;
}
function mapKnowledgeCategoryRow(row: KnowledgeCategoryRow): KnowledgeCategoryDTO {
  return { category: row.category };
}
export function mapKnowledgeCategoryRows(rows: KnowledgeCategoryRow[]): KnowledgeCategoryDTO[] {
  return rows.map(mapKnowledgeCategoryRow);
}

export interface KnowledgeCropDTO {
  crop: string;
}
function mapKnowledgeCropRow(row: KnowledgeCropRow): KnowledgeCropDTO {
  return { crop: row.crop };
}
export function mapKnowledgeCropRows(rows: KnowledgeCropRow[]): KnowledgeCropDTO[] {
  return rows.map(mapKnowledgeCropRow);
}
