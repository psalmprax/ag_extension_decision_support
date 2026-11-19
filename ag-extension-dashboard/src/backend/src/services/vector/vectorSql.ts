import { EMBEDDING_DIMENSIONS } from '@/services/embeddingDimensions';

/**
 * SQL fragments shared by every knowledge-base query, written to match the
 * indexes in migration 20261121090000_rag_retrieval_indexes exactly: the
 * planner only uses an expression or partial index when the query repeats the
 * same expression with the same constants.
 */

function validatedDimensions(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 16000) {
        throw new Error(`EMBEDDING_DIMENSIONS must be an integer between 1 and 16000 (got ${value})`);
    }
    return value;
}

/** Inlined as a literal (never user input) so partial-index predicates match. */
export const VECTOR_DIMENSIONS = validatedDimensions(EMBEDDING_DIMENSIONS);

/** The stored double precision[] column cast to pgvector, as indexed. */
export function embeddingExpression(column: string): string {
    return `(${column}::vector(${VECTOR_DIMENSIONS}))`;
}

/** Restricts a scan to rows of the configured width (the HNSW partial-index predicate). */
export function embeddingWidthPredicate(column: string): string {
    return `array_length(${column}, 1) = ${VECTOR_DIMENSIONS}`;
}

/** Cosine distance between a stored column and query parameter `$n`. */
export function cosineDistance(column: string, parameterIndex: number): string {
    return `${embeddingExpression(column)} <=> $${parameterIndex}::vector(${VECTOR_DIMENSIONS})`;
}

/** pgvector text literal for a query embedding. */
export function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
}

/** Weighted article tsvector (title A, body B), as indexed. */
export function articleSearchVector(alias = ''): string {
    const prefix = alias ? `${alias}.` : '';
    return `(setweight(to_tsvector('english', coalesce(${prefix}title, '')), 'A') || ` +
        `setweight(to_tsvector('english', coalesce(${prefix}content, '')), 'B'))`;
}
