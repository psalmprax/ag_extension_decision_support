/**
 * Structure-aware chunking for knowledge articles.
 *
 * Splits on headings and blank-line paragraphs, packs whole paragraphs (and
 * whole list blocks) into chunks of about `targetChars`, and only cuts inside a
 * paragraph, at sentence ends, when one paragraph alone is too long. Each chunk
 * keeps the heading of the section it came from, and consecutive chunks of one
 * section share their boundary sentence so a fact split across two chunks is
 * still retrievable from either. Pure functions, no I/O.
 */

export interface TextChunk {
    /** The passage shown to the model and the reader (starts with its heading, if any). */
    content: string;
    /** Nearest heading above the passage, if the article has headings. */
    section?: string;
}

export interface ChunkOptions {
    targetChars?: number;
    maxChars?: number;
    minChars?: number;
}

const MARKDOWN_HEADING = /^#{1,6}\s+(.+?)\s*#*$/;
const SHORT_TITLE_LINE = /^[\p{Lu}\p{N}][^.!?]{2,80}:$/u;

function markdownHeading(line: string): string | undefined {
    const markdown = MARKDOWN_HEADING.exec(line.trim());
    return markdown ? markdown[1]!.replace(/:$/, '').trim() : undefined;
}

/** A short "Title:" line counts as a heading only when it opens a paragraph. */
function titleLine(line: string): string | undefined {
    const trimmed = line.trim();
    return SHORT_TITLE_LINE.test(trimmed) ? trimmed.slice(0, -1).trim() : undefined;
}

/** Sentence split that keeps abbreviations like "e.g." and decimals like "2.5" intact. */
export function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}"'(])/u)
        .map(sentence => sentence.trim())
        .filter(Boolean);
}

function hardWrap(text: string, maxChars: number): string[] {
    if (!Number.isFinite(maxChars) || maxChars < 1) throw new RangeError(`chunk budget must be positive (got ${maxChars})`);
    const pieces: string[] = [];
    let rest = text.trim();
    while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(' ', maxChars);
        const at = cut > maxChars * 0.5 ? cut : maxChars;
        pieces.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
    return pieces;
}

interface Section { heading?: string; blocks: string[] }

/**
 * Sections and their paragraphs. Markdown headings start a new section on any
 * line, also without blank lines around them; blank lines end a paragraph.
 */
function sections(text: string): Section[] {
    const result: Section[] = [{ blocks: [] }];
    let paragraph: string[] = [];
    const endParagraph = () => {
        const body = paragraph.join('\n').trim();
        if (body) result[result.length - 1]!.blocks.push(body);
        paragraph = [];
    };
    for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
        if (!line.trim()) {
            endParagraph();
            continue;
        }
        const heading = markdownHeading(line) ?? (paragraph.length === 0 ? titleLine(line) : undefined);
        if (heading !== undefined) {
            endParagraph();
            result.push({ heading, blocks: [] });
            continue;
        }
        paragraph.push(line);
    }
    endParagraph();
    return result.filter(section => section.blocks.length > 0 || section.heading);
}

/** Units small enough to pack: whole paragraphs, or sentences of an oversized one. */
function packingUnits(block: string, maxChars: number): string[] {
    if (block.length <= maxChars) return [block];
    return splitSentences(block.replace(/\s*\n\s*/g, ' ')).flatMap(sentence =>
        sentence.length <= maxChars ? [sentence] : hardWrap(sentence, maxChars)
    );
}

/** The sentence repeated at the start of the next chunk, unless it is too long to repeat. */
function overlapSentence(text: string, limit: number): string | undefined {
    const sentence = splitSentences(text).pop();
    return sentence && sentence.length <= limit ? sentence : undefined;
}

/**
 * The heading line repeated on a section's chunks: shortened when it would
 * take more than a quarter of a chunk, so the text always keeps room.
 */
function headingPrefix(heading: string | undefined, maxChars: number): string {
    if (!heading) return '';
    const room = Math.floor(maxChars / 4);
    const shown = heading.length < room ? heading : `${heading.slice(0, Math.max(room - 2, 1)).trimEnd()}…`;
    return `${shown}\n`;
}

/** Pack one section's paragraphs into chunks, repeating the boundary sentence. */
function packSection(section: Section, targetChars: number, maxChars: number): TextChunk[] {
    const prefix = headingPrefix(section.heading, maxChars);
    const budget = maxChars - prefix.length;
    // A chunk closes at the target size, and never grows past the hard maximum.
    const limit = Math.min(targetChars, budget);
    const chunks: TextChunk[] = [];
    let current: string[] = [];
    let length = 0;
    const flush = () => {
        const body = current.join('\n\n').trim();
        if (body) chunks.push({ content: `${prefix}${body}`, section: section.heading });
    };
    for (const unit of section.blocks.flatMap(block => packingUnits(block, budget))) {
        if (length > 0 && length + unit.length + 2 > limit) {
            const carry = overlapSentence(current[current.length - 1] ?? '', targetChars * 0.35);
            flush();
            current = carry && carry.length + unit.length + 2 <= budget ? [carry] : [];
            length = current.reduce((sum, part) => sum + part.length + 2, 0);
        }
        current.push(unit);
        length += unit.length + 2;
    }
    flush();
    return chunks;
}

/** Fold a tiny chunk into its predecessor from the same section. */
function mergeTinyChunks(chunks: TextChunk[], minChars: number, maxChars: number): TextChunk[] {
    const merged: TextChunk[] = [];
    for (const chunk of chunks) {
        const previous = merged[merged.length - 1];
        const fits = previous !== undefined && previous.section === chunk.section &&
            previous.content.length + chunk.content.length <= maxChars;
        if (fits && chunk.content.length < minChars) {
            const body = chunk.content.slice(headingPrefix(chunk.section, maxChars).length);
            previous.content = `${previous.content}\n\n${body}`;
        } else {
            merged.push({ ...chunk });
        }
    }
    return merged;
}

function positiveSize(name: string, value: number): number {
    if (!Number.isFinite(value) || value < 1) throw new RangeError(`${name} must be a positive number (got ${value})`);
    return Math.floor(value);
}

export function chunkDocument(text: string, options: ChunkOptions = {}): TextChunk[] {
    const targetChars = positiveSize('targetChars', options.targetChars ?? 900);
    // Room for a shortened heading (a quarter) plus text.
    const maxChars = Math.max(positiveSize('maxChars', options.maxChars ?? 1400), targetChars, 8);
    if (!text?.trim()) return [];
    const chunks = sections(text).flatMap(section => packSection(section, targetChars, maxChars));
    return mergeTinyChunks(chunks, positiveSize('minChars', options.minChars ?? 40), maxChars).filter(chunk => chunk.content.trim().length > 0);
}

/** Text embedded for a chunk: the article title and section give a short passage its topic. */
export function chunkEmbeddingInput(title: string | undefined, chunk: TextChunk): string {
    const header = [title?.trim(), chunk.section && chunk.section !== title ? chunk.section : undefined]
        .filter(Boolean).join(' — ');
    return header ? `${header}\n\n${chunk.content}` : chunk.content;
}
