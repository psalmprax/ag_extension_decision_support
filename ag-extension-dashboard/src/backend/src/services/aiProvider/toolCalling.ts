/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared helpers so every OpenAI-compatible provider handles tool-calling the
 * same way regardless of how the caller expressed the tools.
 *
 * Callers pass `options.tools` in one of two shapes:
 *   1. Internal `Tool` objects from src/tools (name, description, schema: zod)
 *   2. OpenAI function-tool definitions { type:'function', function:{ name, description, parameters } }
 *
 * Providers must also accept either a string prompt or a messages array.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface OpenAIToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
    };
}

export interface NormalizedToolCall {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: NormalizedToolCall[];
}

function isZodSchema(v: unknown): v is Parameters<typeof zodToJsonSchema>[0] {
    return !!v && typeof v === 'object' && typeof (v as any).safeParse === 'function';
}

function resolveToolParameters(t: Record<string, unknown>): Record<string, unknown> {
    let parameters: Record<string, unknown> = { type: 'object', properties: {} };
    if (t.jsonSchema && typeof t.jsonSchema === 'object') {
        parameters = t.jsonSchema as Record<string, unknown>;
    } else if (isZodSchema(t.schema)) {
        try {
            parameters = zodToJsonSchema(t.schema, { $refStrategy: 'none' }) as Record<string, unknown>;
            // zod-to-json-schema wraps in a top-level with $schema; strip non-parameter keys.
            delete parameters.$schema;
        } catch {
            parameters = { type: 'object', properties: {} };
        }
    } else if (t.inputSchema && typeof t.inputSchema === 'object') {
        parameters = t.inputSchema as Record<string, unknown>;
    }
    return parameters;
}

function formatFunctionTool(fn: { name: unknown; description?: unknown; parameters?: unknown }): OpenAIToolDefinition {
    return {
        type: 'function',
        function: {
            name: String(fn.name),
            description: fn.description ? String(fn.description) : undefined,
            parameters: (fn.parameters as Record<string, unknown>) || { type: 'object', properties: {} },
        },
    };
}

/** Convert any supported tool shape into OpenAI function-tool definitions. */
export function normalizeToolDefinitions(tools: unknown[] | undefined): OpenAIToolDefinition[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    const out: OpenAIToolDefinition[] = [];
    for (const t of tools as any[]) {
        if (!t) continue;
        if (t.type === 'function' && t.function?.name) {
            out.push(formatFunctionTool(t.function));
            continue;
        }
        if (typeof t.name === 'string') {
            const parameters = resolveToolParameters(t);
            out.push({
                type: 'function',
                function: { name: t.name, description: t.description ? String(t.description) : undefined, parameters },
            });
        }
    }
    return out.length > 0 ? out : undefined;
}

/** Accept a string prompt or a messages array and return a messages array. */
export function normalizeMessages(
    prompt: string | Array<{ role: string; content: any }> | unknown,
    systemPrompt = 'You are a helpful agricultural extension assistant.'
): ChatMessage[] {
    if (Array.isArray(prompt) && prompt.length > 0 && typeof prompt[0] === 'object' && prompt[0] && 'role' in (prompt[0] as any)) {
        return prompt as ChatMessage[];
    }
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) },
    ];
}

/** Normalize provider tool_calls into the shape our callers consume. */
export function normalizeToolCalls(raw: any[] | undefined | null): NormalizedToolCall[] | undefined {
    if (!raw || raw.length === 0) return undefined;
    return raw
        .filter(tc => tc && tc.function && tc.function.name)
        .map((tc, i) => ({
            id: String(tc.id || `call_${i}`),
            type: 'function' as const,
            function: {
                name: String(tc.function.name),
                arguments: typeof tc.function.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function.arguments ?? {}),
            },
        }));
}

/** Parse the JSON-string `arguments` a model returns into an object (tolerant of junk). */
export function parseToolArguments(args: unknown): Record<string, unknown> {
    if (args && typeof args === 'object' && !Array.isArray(args)) return args as Record<string, unknown>;
    if (typeof args !== 'string' || args.trim() === '') return {};
    try {
        const parsed = JSON.parse(args);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        // Some models emit trailing text after the JSON object; salvage the first object.
        const match = args.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch { /* fall through */ }
        }
        return {};
    }
}
