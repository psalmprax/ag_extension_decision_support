/**
 * Pure text-normalization helpers for knowledge answers and retrieved context.
 * No I/O, no service dependencies.
 */

export const METADATA_LABELS = new Set([
    'title', 'author', 'source', 'url', 'category', 'categories', 'tag', 'tags',
    'date', 'published', 'image', 'photo', 'figure', 'note', 'credit', 'copyright',
    'by', 'reference', 'references', 'link', 'primary source reference'
]);

const PRESERVED_ACRONYMS = new Set([
    'FAO', 'USDA', 'NRCS', 'GPS', 'IPM', 'NGO', 'EU', 'US', 'USA', 'USAID',
    'CGIAR', 'IITA', 'EIL', 'PPE', 'PHI', 'DTM', 'NPK', 'AI', 'RAG', 'PWA',
    'SMS', 'IVR', 'URI', 'URL', 'ID', 'KPI', 'CO2', 'PH', 'IT', 'GIS'
]);

export function isMostlyUppercase(text: string): boolean {
    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length < 6) return false;
    const uppers = text.replace(/[^A-Z]/g, '');
    return (uppers.length / letters.length) >= 0.7;
}

export function toSentenceCase(text: string): string {
    const trimmed = text.trim();
    if (trimmed.length === 0) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function convertAllCapsWord(word: string, isFirstWord: boolean): string {
    const clean = word.replace(/[^A-Za-z0-9]/g, '');
    if (PRESERVED_ACRONYMS.has(clean.toUpperCase())) {
        return word;
    }
    const lower = word.toLowerCase();
    if (isFirstWord && lower.length > 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return lower;
}

export function convertAllCapsLine(line: string): string {
    const headerMatch = line.match(/^(\s*#{1,6}\s+|[-*•]\s+|\d+\.\s+)?(.*)/s);
    const prefix = headerMatch?.[1] || '';
    const content = headerMatch?.[2] || line;

    if (!isMostlyUppercase(content)) {
        return line;
    }

    const words = content.split(' ');
    const convertedWords = words.map((w, idx) => convertAllCapsWord(w, idx === 0));
    return `${prefix}${convertedWords.join(' ')}`;
}

export function normalizeAllCapsText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    const lines = text.split('\n');
    const normalized = lines.map(line => convertAllCapsLine(line));
    return normalized.join('\n');
}

export function sanitizeContextText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    const cleaned = text
        // Strip HTML comments, scripts, styles, and tags
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        // Common web navigation & social junk
        .replace(/\b(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram|Telegram)\b(\s+(Facebook|Twitter|X|LinkedIn|Pinterest|WhatsApp|Instagram|Telegram)\b)*/gi, '')
        .replace(/\b(Share on|Follow us on|Pin on|Tweet this|Share this)\b[^\n.]*/gi, '')
        .replace(/\bWhat are You Looking for\?\s+[A-Za-z\s&]+/gi, '')
        .replace(/\b(Administration\s+Agriculture\s+Arts & Humanities\s+Education\s+Engineering[^\n.]*)/gi, '')
        .replace(/\b(Read also|Read more|Related posts?|Leave a Reply|Cancel reply|Save my name|Sign up for our newsletter|Subscribe to):?[^\n.]*/gi, '')
        // Common boilerplate branding repetitions
        .replace(/(\b[A-Za-z]{4,20}\s+In\s+[A-Za-z]{4,20}\b)(?:\s+\1)+/gi, '$1')
        // Vendor promo footers and corporate sponsorship blurbs
        .replace(/\bAt\s+[A-Z][A-Za-z0-9\s.,]+(?:PVT|LTD|LLC|Inc|Corp|Limited)?,\s*(?:we are|we remain)\s+committed to[^\n.]*\.?/gi, '')
        .replace(/\b[A-Z][A-Za-z0-9\s.,]+ (?:recognizes|reaffirms|commits to) the essential role farmers play[^\n.]*\.?/gi, '')
        // Raw ellipsis and scraper truncation artifacts
        .replace(/\[\s*\.\.\.\s*\]/g, '')
        .replace(/…\s*\[\s*\.\.\.\s*\]/g, '')
        // Isolate inline markdown headers squashed against running text
        .replace(/([.!?])\s*(#{1,6}\s+)/g, '$1\n\n$2')
        // Isolate inline bullet points & list markers squashed against sentences
        .replace(/([.!?])\s+([*•-]\s+)/g, '$1\n\n$2')
        .replace(/([.!?])\s+(\d+\.\s+[A-Z])/g, '$1\n\n$2')
        // Strip metadata-only lines (e.g., "Title: Foo", "Author: Bar")
        .replace(/^\s*(?:Title|Author|Published|Date|Source|Image credit|Photo credit|Category|Categories|Tags)\s*:\s*[^\n]*$/gmi, '')
        // Whitespace normalization
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();

    return normalizeAllCapsText(cleaned);
}
