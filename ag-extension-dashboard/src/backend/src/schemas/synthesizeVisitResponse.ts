import { z } from 'zod';
import { logger } from '@/utils/logger';

/**
 * Validation schema + safe parser for the AI response from /synthesize-visit.
 *
 * Goals:
 * - Never crash the route on malformed/hostile AI output.
 * - Cap string lengths to prevent DoS via runaway model responses.
 * - Fall back to safe defaults for invalid enum values, missing fields, and
 *   unparseable JSON instead of rejecting the whole response.
 * - Always return a structurally-valid object that matches the response shape
 *   documented in routes/knowledge.ts.
 */

export const CROP_HEALTH_STATUSES = ['good', 'fair', 'poor'] as const;
export const ACTION_PRIORITIES = ['high', 'medium', 'low'] as const;

const MAX_SUMMARY_LEN = 2000;
const MAX_NOTES_LEN = 1000;
const MAX_DESCRIPTION_LEN = 500;
const MAX_ACTIONS = 20;
const MAX_INPUT_LEN = 64 * 1024; // 64 KB cap on raw model output we'll inspect

const isoDateString = z
    .string()
    .trim()
    .refine((s) => {
        if (!s) return true; // empty allowed; normalized to null
        const t = Date.parse(s);
        return Number.isFinite(t);
    }, { message: 'followUpDate must be a parseable ISO date string' })
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .catch(null);

const actionItemSchema = z
    .object({
        priority: z.enum(ACTION_PRIORITIES).catch('medium'),
        description: z
            .string()
            .trim()
            .min(1, 'Action description is required')
            .max(MAX_DESCRIPTION_LEN)
            .catch('Action description unavailable'),
    })
    .catch({ priority: 'medium', description: 'Action description unavailable' });

export const synthesizeVisitResponseSchema = z.object({
    summary: z.string().trim().max(MAX_SUMMARY_LEN).default(''),
    cropHealth: z
        .object({
            status: z.enum(CROP_HEALTH_STATUSES).catch('fair'),
            notes: z.string().trim().max(MAX_NOTES_LEN).default(''),
        })
        .default({ status: 'fair', notes: '' }),
    actions: z
        .array(actionItemSchema)
        .max(MAX_ACTIONS)
        .default([]),
    followUpDate: isoDateString.default(null),
});

export type SynthesizeVisitResponse = z.infer<typeof synthesizeVisitResponseSchema>;

/**
 * Used when the model returns nothing parseable. Callers may overwrite
 * `summary` with the raw model text for better UX.
 */
export const SYNTHESIZE_VISIT_SAFE_DEFAULTS: SynthesizeVisitResponse = {
    summary: '',
    cropHealth: { status: 'fair', notes: 'No structured assessment available.' },
    actions: [],
    followUpDate: null,
};

/**
 * Extract a JSON object substring from a model's text output, handling common
 * wrapping patterns: ```json ... ``` code fences, leading prose, trailing
 * commentary. Returns null if no plausible JSON object is present.
 */
function extractJsonObject(text: string): string | null {
    if (!text) return null;
    const capped = text.length > MAX_INPUT_LEN ? text.slice(0, MAX_INPUT_LEN) : text;

    // Prefer fenced ```json ... ``` blocks when present
    const fenceMatch = capped.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1];
    }

    // Otherwise, grab the substring from the first '{' to the last '}'
    const start = capped.indexOf('{');
    if (start === -1) return null;
    const end = capped.lastIndexOf('}');
    if (end <= start) return null;
    return capped.substring(start, end + 1);
}

/**
 * Parse the AI response from /synthesize-visit into a structurally-valid
 * object. Never throws. Returns safe defaults on any failure (invalid JSON,
 * schema mismatch, empty input, etc.).
 *
 * If the model failed to return a structured object but did return prose,
 * pass that prose as `summaryFallback` and it will be used as the `summary`.
 */
export function parseSynthesizeVisitResponse(
    text: string | null | undefined,
    summaryFallback: string = ''
): SynthesizeVisitResponse {
    const fallback = (summaryFallback || '').slice(0, MAX_SUMMARY_LEN);

    const slice = extractJsonObject(text ?? '');
    if (slice === null) {
        return { ...SYNTHESIZE_VISIT_SAFE_DEFAULTS, summary: fallback };
    }

    let raw: unknown;
    try {
        raw = JSON.parse(slice);
    } catch {
        return { ...SYNTHESIZE_VISIT_SAFE_DEFAULTS, summary: fallback };
    }

    const result = synthesizeVisitResponseSchema.safeParse(raw);
    if (result.success) {
        // If the parsed summary is empty but we have a fallback, prefer the
        // fallback so the caller still surfaces something useful to the user.
        return result.data.summary ? result.data : { ...result.data, summary: fallback };
    }

    logger.warn('Synthesize-visit AI response failed zod validation; using safe defaults', {
        inputLength: (text ?? '').length,
        issueCount: result.error.issues.length,
        issuePaths: result.error.issues.map((i) => i.path.join('.')).slice(0, 5),
    });
    return { ...SYNTHESIZE_VISIT_SAFE_DEFAULTS, summary: fallback };
}
