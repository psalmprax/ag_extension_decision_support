import { AIRouter, ReasoningResult } from '@/services/aiProvider/aiProvider';
import { mcpAdapter } from '@/services/mcpAdapter';
import { logger } from '@/utils/logger';
import type { KnowledgeAttachment, ReasonOptions } from '@/services/knowledge/types';

/**
 * Answer reasoning: grounded direct synthesis with a 35s timeout, plus an
 * opt-in agentic loop (MCP micro-tools) that degrades gracefully to direct
 * synthesis when tools are unavailable or unhelpful.
 */

export interface AgenticToolCall {
    function: { name: string; arguments: unknown };
}

export interface AgenticToolDef {
    type: 'function';
    function: { name: string; description: string; parameters: unknown };
}

const REASONING_TIMEOUT_MS = 35000;
const AGENTIC_BUDGET_MS = 35000;
const AGENTIC_TURN_TIMEOUT_MS = 30000;
const TOOL_TIMEOUT_MS = 8000;

const GROUNDING_DIRECTIVE = `
Agronomic Decision Support Protocol (Phase 2):
1. Location-First & Climate Precision:
   - If this query is an agronomic recommendation (e.g., planting dates, crop selection, pest treatment) and NO explicit location/growing zone is given by the user or context, DO NOT hallucinate or assume an arbitrary state/country.
   - Prompt the user to provide their county/region or USDA / Plant Hardiness Zone for personalized precision.
   - Present a structured climate-band comparison (Cool Zones 3–4, Temperate Zones 5–7, Warm/Subtropical Zones 8–10, or Tropical Wet/Dry) so the answer is immediately usable without false assumptions.
2. Temporal & Soil Temperature Triggers:
   - Avoid vague seasonal terms like "Spring" without qualification.
   - Always state timing relative to the last expected frost date, indoor seed starting lead times (weeks before frost), and minimum 4-inch soil temperature (°F / °C) required for germination.
3. Cultivars & Performance:
   - Recommend tested crop cultivars with Days to Maturity (DTM) and known disease resistance packages.
4. Economic Optimization:
   - Include succession planting, relay cropping, and soil management considerations (e.g. pH, drainage, cover cropping).
5. Grounding & Authority:
   - Prioritize high-similarity context sources (score 0.70+). Cite recognized extension bulletins (Land-Grant universities, FAO, USDA NRCS) and encourage verifying with local extension officers.
6. Multilingual Fluency:
   - Always respond fluently in the exact same language used in the question (e.g. Kiswahili, Français, Español, Português, Hausa, Yoruba, Arabic, etc.) with accurate localized agronomic terminology.
7. Formatting & Case Style:
   - Never write entire sentences, section headers, or bullet points in ALL CAPS (block capitals).
   - Use natural sentence case for section headings and list items (e.g., "Key agronomic recommendations", "Field preparation steps").
   - Capitalize only the first letter of sentences and proper nouns/standard abbreviations (e.g. FAO, USDA, pH).
`;

export async function callReasoningWithTimeout(
    contextText: string,
    queryText: string,
    attachments?: KnowledgeAttachment[],
    options?: ReasonOptions
): Promise<ReasoningResult> {
    let reasoningTimeoutId: ReturnType<typeof setTimeout> | undefined;

    return Promise.race([
        AIRouter.routeRequest('reason', {
            context: `${contextText || 'No specific context found in knowledge base.'}\n\n${GROUNDING_DIRECTIVE}`,
            query: queryText,
            attachments,
            options: { temperature: 0.2, maxTokens: 4096, preferredProvider: options?.preferredProvider }
        }),
        new Promise<ReasoningResult>((_, reject) => {
            reasoningTimeoutId = setTimeout(
                () => reject(new Error(`askQuestion reasoning timed out after ${REASONING_TIMEOUT_MS}ms`)),
                REASONING_TIMEOUT_MS
            );
        }),
    ]).finally(() => clearTimeout(reasoningTimeoutId));
}

export async function callReasoningAgentic(
    contextText: string,
    queryText: string,
    attachments: KnowledgeAttachment[] | undefined,
    options: ReasonOptions | undefined,
    queryCategories: string[]
): Promise<ReasoningResult> {
    if (process.env.KNOWLEDGE_AGENTIC_LOOP === 'false') {
        return callReasoningWithTimeout(contextText, queryText, attachments, options);
    }
    const toolDefs = mcpAdapter.convertToMCPTools().map(t => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.inputSchema }
    }));
    if (toolDefs.length === 0) return callReasoningWithTimeout(contextText, queryText, attachments, options);

    const systemPrompt = `You are a Senior Agronomist and Agricultural Extension Research Specialist. You have access to deterministic micro-tools for precise agricultural calculations and live data retrieval. Use tools whenever calculations or live data are required. Cite sourceUrl and state exact numerical results.\nCurrent categories: ${queryCategories.join(', ') || 'general'}.\nContext:\n${contextText || 'No specific context found.'}`;
    const start = Date.now();
    const BUDGET_MS = AGENTIC_BUDGET_MS;

    try {
        // Turn 0: Probe LLM with tool definitions to see if tools are invoked
        const remaining = BUDGET_MS - (Date.now() - start);
        const firstTurnRes = await routeAgenticTurn(systemPrompt, queryText, attachments, options, toolDefs, remaining);
        const toolCalls = (firstTurnRes as unknown as { toolCalls?: AgenticToolCall[] }).toolCalls;

        if (toolCalls && toolCalls.length > 0) {
            const toolSynthesis = await synthesizeWithToolEvidence(
                toolCalls, contextText, queryText, attachments, options, start, BUDGET_MS
            );
            if (toolSynthesis) return toolSynthesis;
        } else if ((firstTurnRes as ReasoningResult).answer && (firstTurnRes as ReasoningResult).answer.length > 50) {
            return firstTurnRes;
        }

        // Fallback to direct synthesis with full grounding directive if answer was short or empty
        return await callReasoningWithTimeout(contextText, queryText, attachments, options);
    } catch (agenticError) {
        const isTimeout = (agenticError as Error)?.message?.includes('agentic turn timeout');
        if (isTimeout) {
            logger.warn('Agentic turn timed out; falling back directly to grounded context fallback without repeating request:', agenticError);
            throw agenticError;
        }
        logger.warn('Agentic reasoning turn failed or rejected tools; smoothly falling back to direct full grounding synthesis:', agenticError);
        return callReasoningWithTimeout(contextText, queryText, attachments, options);
    }
}

/** One agentic turn: route with tools attached under a per-turn timeout. */
export async function routeAgenticTurn(
    systemPrompt: string,
    queryText: string,
    attachments: KnowledgeAttachment[] | undefined,
    options: ReasonOptions | undefined,
    toolDefs: AgenticToolDef[],
    remainingMs: number
): Promise<ReasoningResult> {
    return Promise.race([
        AIRouter.routeRequest('reason', {
            context: systemPrompt,
            query: queryText,
            attachments,
            options: { temperature: 0.2, maxTokens: 4096, preferredProvider: options?.preferredProvider, tools: toolDefs } as unknown as Record<string, unknown>
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('agentic turn timeout')), Math.min(AGENTIC_TURN_TIMEOUT_MS, remainingMs)))
    ]) as unknown as Promise<ReasoningResult>;
}

/** Synthesize final grounded prescription with deterministic micro-tool execution evidence. */
export async function synthesizeWithToolEvidence(
    toolCalls: AgenticToolCall[],
    contextText: string,
    queryText: string,
    attachments: KnowledgeAttachment[] | undefined,
    options: ReasonOptions | undefined,
    start: number,
    budgetMs: number
): Promise<ReasoningResult | null> {
    logger.info(`Agentic reasoning turn 0 invoked ${toolCalls.length} tool(s): ${toolCalls.map(t => t.function.name).join(', ')}`);
    const toolResults = await executeAgenticTools(toolCalls, start, budgetMs);
    const enrichedContext = `${contextText || ''}\n\n### Deterministic micro-tool execution evidence:\n${toolResults.join('\n\n')}`;
    logger.info(`Synthesizing final grounded prescription with tool evidence (${toolResults.length} tool result(s))...`);

    const synthesisRes = await AIRouter.routeRequest('reason', {
        context: enrichedContext,
        query: queryText,
        attachments,
        options: { temperature: 0.2, maxTokens: 4096, preferredProvider: options?.preferredProvider }
    }) as ReasoningResult;

    if (synthesisRes?.answer && synthesisRes.answer.length > 100) {
        return synthesisRes;
    }
    return null;
}

/** Execute requested tools concurrently with an 8s per-tool timeout. */
export async function executeAgenticTools(
    toolCalls: AgenticToolCall[],
    start: number,
    budgetMs: number
): Promise<string[]> {
    if (Date.now() - start > budgetMs) return [];

    const settledResults = await Promise.allSettled(
        toolCalls.map(async (tc) => {
            let parsedArgs: Record<string, unknown> = {};
            try {
                parsedArgs = typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : (tc.function.arguments as Record<string, unknown>) || {};
            } catch {
                parsedArgs = (tc.function.arguments as Record<string, unknown>) || {};
            }

            const result = await Promise.race([
                mcpAdapter.callTool(tc.function.name, parsedArgs),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`tool ${tc.function.name} timeout 8s`)), TOOL_TIMEOUT_MS))
            ]) as { content?: Array<{ text?: string }> };

            return `Tool ${tc.function.name} result: ${result.content?.[0]?.text?.slice(0, 3000) || 'No output'}`;
        })
    );

    return settledResults.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return `Tool ${toolCalls[i]?.function?.name || 'unknown'} error: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`;
    });
}
