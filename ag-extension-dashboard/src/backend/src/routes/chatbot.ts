/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { toolRegistry, toolMap } from '@/tools/registry';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { usageService } from '../services/usageService';
import { aegisShield } from '@/services/security/aegisShield';
import { sanitizeToolResult } from '@/middleware/securityGate';
import { agentTelemetry } from '@/services/agentTelemetry';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all chatbot routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

async function getConversationsFromDB(limit = 50): Promise<any[]> {
    try {
        const pool = getPool();
        if (!pool) return [];
        const result = await query(`
            SELECT c.id, c.farmer_id, c.status, c.language, c.started_at, c.ended_at,
                   f.first_name, f.last_name,
                   (SELECT content FROM chat_messages
                    WHERE conversation_id = c.id
                    ORDER BY created_at DESC LIMIT 1) as last_message
            FROM chat_conversations c
            LEFT JOIN farmers f ON f.id = c.farmer_id
            ORDER BY c.started_at DESC
            LIMIT $1
        `, [limit]);
        return result.rows || [];
    } catch (error) {
        logger.error('Error fetching conversations:', error);
        return [];
    }
}

router.get('/conversations', async (_req: AuthRequest, res: Response) => {
    try {
        const conversations = await getConversationsFromDB();
        if (conversations.length === 0) {
            return res.json({ success: true, data: [] });
        }
        res.json({
            success: true,
            data: conversations.map(c => ({
                id: c.id,
                farmerId: c.farmer_id,
                farmerName: `${c.first_name} ${c.last_name}`,
                lastMessage: c.last_message || '',
                language: c.language || 'en',
                status: c.status,
                startedAt: c.started_at,
                unreadCount: 0,
            }))
        });
    } catch (error) {
        logger.error('Get conversations error:', error);
        safeError(res, 500, 'Failed to get conversations');
    }
});

router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
        const result = await query(`
            SELECT id, role, content, language, translated_content, is_voice, created_at
            FROM chat_messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC
        `, [id]);
        res.json({
            success: true,
            data: result.rows.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                language: m.language,
                translatedContent: m.translated_content,
                isVoice: m.is_voice,
                timestamp: m.created_at,
            }))
        });
    } catch (error) {
        logger.error('Get messages error:', error);
        safeError(res, 500, 'Failed to get messages');
    }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId, farmerName, language = 'en' } = req.body;
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
        const result = await query(`
            INSERT INTO chat_conversations (farmer_id, language, status, started_at)
            VALUES ($1, $2, 'active', NOW())
            RETURNING id, farmer_id, language, status, started_at
        `, [farmerId, language]);
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id,
                farmerId: result.rows[0].farmer_id,
                farmerName,
                language: result.rows[0].language,
                status: result.rows[0].status,
                startedAt: result.rows[0].started_at,
                unreadCount: 0,
                lastMessage: '',
            },
        });
    } catch (error) {
        logger.error('Create conversation error:', error);
        safeError(res, 500, 'Failed to create conversation');
    }
});

router.post('/conversations/ai', async (req: AuthRequest, res: Response) => {
    try {
        const { language = 'en' } = req.body;
        const pool = getPool();
        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
        const result = await query(`
            INSERT INTO chat_conversations (farmer_id, language, status, started_at)
            VALUES (NULL, $1, 'active', NOW())
            RETURNING id, farmer_id, language, status, started_at
        `, [language]);
        res.status(201).json({
            success: true,
            data: {
                id: result.rows[0].id,
                farmerId: null,
                farmerName: 'AI Assistant',
                language: result.rows[0].language,
                status: result.rows[0].status,
                startedAt: result.rows[0].started_at,
                unreadCount: 0,
                lastMessage: '',
                isAIOnly: true,
            },
        });
    } catch (error) {
        logger.error('Create AI conversation error:', error);
        safeError(res, 500, 'Failed to create AI conversation');
    }
});

// ── Module-level constants ─────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English', sw: 'Swahili', fr: 'French', es: 'Spanish', de: 'German',
    it: 'Italian', nl: 'Dutch', da: 'Danish', pl: 'Polish', hu: 'Hungarian',
    tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', hi: 'Hindi', ru: 'Russian',
    uk: 'Ukrainian', ro: 'Romanian', cs: 'Czech', sk: 'Slovak', bg: 'Bulgarian',
    el: 'Greek', oro: 'Oromo', lug: 'Luganda', zu: 'Zulu'
};

// ── Custom error class ──────────────────────────────────────────────────────

class AppError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'AppError';
    }
}

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Ensure a conversation exists, creating one if needed.
 * Returns the conversation ID or throws AppError on failure.
 */
async function ensureConversationId(
    farmerId: string | undefined,
    conversationId: string | undefined,
    language = 'en'
): Promise<string> {
    if (conversationId) return conversationId;
    if (!farmerId) throw new AppError(400, 'Either conversationId or farmerId is required');

    const pool = getPool();
    if (!pool) throw new AppError(503, 'Database connection unavailable');

    const result = await query(
        `INSERT INTO chat_conversations (farmer_id, language, status, started_at)
         VALUES ($1, $2, 'active', NOW()) RETURNING id`,
        [farmerId, language]
    );
    return result.rows[0].id;
}

/**
 * Save a chat message to the database. Errors are logged but not thrown —
 * message delivery shouldn't fail because of logging.
 */
async function saveChatMessage(convId: string, role: string, content: string): Promise<void> {
    try {
        const pool = getPool();
        if (pool) {
            await query(
                `INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                 VALUES ($1, $2, $3, 'en', NOW())`,
                [convId, role, content]
            );
        }
    } catch (error) {
        logger.error(`Error saving ${role} message:`, error);
    }
}

/**
 * Fetch and normalize conversation history from the database.
 * Maps 'farmer'/'officer' roles → 'user', keeps 'assistant'/'system' as-is.
 */
async function buildConversationHistory(convId: string): Promise<Array<{ role: string; content: string }>> {
    try {
        const pool = getPool();
        if (!pool) return [];

        const result = await query(
            `SELECT role, content FROM chat_messages
             WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20`,
            [convId]
        );
        return (result.rows || [])
            .map((row: any) => {
                if (row.role === 'farmer' || row.role === 'officer') return { role: 'user', content: row.content };
                if (row.role === 'assistant' || row.role === 'system') return { role: row.role, content: row.content };
                return null;
            })
            .filter((msg: any): msg is { role: string; content: string } => msg !== null);
    } catch (error) {
        logger.error('Error fetching history:', error);
        return [];
    }
}

/**
 * Build the protected system prompt for the given language.
 */
function buildSystemPrompt(language: string): string {
    const langName = LANGUAGE_NAMES[language] || 'English';
    const basePrompt = [
        'You are a "Real-First" AI agricultural assistant helping extension officers and farmers with expert advice.',
        '',
        'CRITICAL OPERATING GUIDELINES:',
        '1. DATA DRIFT: Do NOT rely on your internal training data for volatile information like Market Prices or Weather. ALWAYS use the provided tools (get_market_prices, get_weather_forecast) to get current data.',
        '2. DISEASE VIGILANCE: Regularly check for regional threats using (get_disease_alerts). If you discover a critical threat through research or alerts, proactively suggest using (register_agricultural_alert) to update the system and warn others.',
        '3. PLANT DISEASE: Use (diagnose_plant_disease) when farmers describe symptoms, (analyze_plant_image) when they upload photos, and (get_disease_information) to learn about specific diseases.',
        '4. DEEP RESEARCH: For complex technical questions about crop diseases or new farming methods, use (deep_agricultural_research) for multi-source analysis or (research_agricultural_data) for quick web search.',
        '5. YIELD FORECASTING: Use (crop_yield_forecast) when asked about expected harvest volumes, production estimates, or agricultural output planning.',
        '6. SATELLITE ANALYSIS: Use (satellite_ndvi_analysis) when asked about crop health from space, vegetation monitoring, or field condition assessment via satellite imagery.',
        '7. TRANSLATION: Use (translate_text) to communicate with farmers in their preferred language. Supports Swahili, Luganda, Oromo, Zulu, Arabic, Hindi, French, Spanish, and more.',
        '8. MEMORY: Use (memory_store) to save important context across sessions, (memory_recall) to retrieve past information, and (memory_forget) to remove outdated data.',
        '9. MULTI-AGENT: Use (dispatch_agent_task) to delegate specialized work to other AI agents, (handoff_agent_task) to transfer tasks between agents, and (check_task_status) to monitor progress.',
        '10. BUDGET: Use (check_api_budget) to monitor API costs and provider status.',
        '11. SYSTEM UPDATES: You have the authority to schedule visits (schedule_visit) and register system-wide alerts (register_agricultural_alert). Use these skills when a situation requires human intervention or broad notification.',
        '',
        `Provide accurate, practical, and location-specific advice. ALWAYS respond in ${langName} language.`,
    ].join('\n');
    return aegisShield.buildProtectedSystemPrompt(basePrompt);
}

/**
 * Execute a batch of AI-requested tool calls.
 * Each tool call is validated (Zod), executed, sanitized, and telemetry is recorded.
 * Returns formatted tool result messages.
 */
async function executeToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
    userId: string
): Promise<Array<{ tool_call_id: string; role: string; name: string; content: string }>> {
    const results: Array<{ tool_call_id: string; role: string; name: string; content: string }> = [];

    for (const toolCall of toolCalls) {
        const tool = toolMap.get(toolCall.function.name);
        if (!tool) continue;

        try {
            const args = JSON.parse(toolCall.function.arguments);
            const validatedArgs = tool.schema.parse(args);
            const startTime = Date.now();
            const result = await tool.execute(validatedArgs);
            const duration = Date.now() - startTime;
            const sanitized = sanitizeToolResult(result);

            results.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: sanitized.sanitized,
            });

            await agentTelemetry.recordToolCall(toolCall.function.name, userId, duration, 'success');
            if (!sanitized.clean) {
                logger.warn(`Tool result sanitized for ${toolCall.function.name}: ${sanitized.threats.join('; ')}`);
            }
        } catch (error) {
            let errorMessage = 'Error executing tool';
            if (error instanceof z.ZodError) {
                errorMessage = `Invalid arguments: ${error.message}`;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            logger.error(errorMessage);
            await agentTelemetry.recordError(toolCall.function.name, userId, errorMessage);
            results.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolCall.function.name,
                content: errorMessage,
            });
        }
    }

    return results;
}

/**
 * Handle farmer-to-farmer direct messaging mode (no AI involved).
 */
async function handleFarmerMode(
    message: string,
    conversationId: string | undefined,
    farmerId: string | undefined
): Promise<{ conversationId: string }> {
    const convId = await ensureConversationId(farmerId, conversationId);
    const pool = getPool();
    if (pool) {
        await query(
            `INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
             VALUES ($1, 'officer', $2, 'en', NOW())`,
            [convId, message]
        );
    }
    return { conversationId: convId };
}

/**
 * Handle image analysis with AI vision capabilities.
 * Validates image size, checks vision support, calls AI, persists messages.
 */
async function handleImageAnalysis(
    imageData: string,
    message: string,
    conversationId: string | undefined,
    farmerId: string | undefined,
    userId: string
): Promise<{ analysis: string }> {
    try {
        const sizeInBytes = (imageData.length * 3) / 4;
        if (sizeInBytes > 5 * 1024 * 1024) {
            throw new AppError(400, 'Image size exceeds 5MB limit');
        }

        const provider = await AIProviderFactory.getProvider();
        if (!provider.capabilities.includes('vision')) {
            throw new AppError(400, 'Vision capability not available');
        }

        const analysis = await provider.analyzeImage(imageData, message, { temperature: 0.3, maxTokens: 1000 });
        const convId = await ensureConversationId(farmerId, conversationId);

        await saveChatMessage(convId, 'farmer', message || 'Image analysis request');
        await saveChatMessage(convId, 'assistant', analysis.analysis);
        await usageService.incrementUsage(userId, 'ai_chat');

        return { analysis: analysis.analysis };
    } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error('Image analysis error:', error);
        throw new AppError(500, 'Image analysis failed');
    }
}

/**
 * Main AI chat flow: build prompt with history, call provider, handle any tool calls.
 * Returns the final response text.
 */
async function processAIChat(
    sanitizedMessage: string,
    convId: string,
    language: string,
    userId: string
): Promise<string> {
    const history = await buildConversationHistory(convId);
    const systemMessage = { role: 'system', content: buildSystemPrompt(language) };
    const messages: any[] = [systemMessage, ...history, { role: 'user', content: sanitizedMessage }];

    const provider = await AIProviderFactory.getProvider('groq');
    const aiStartTime = Date.now();
    const response = await provider.generateText(messages, { tools: toolRegistry });
    const aiDuration = Date.now() - aiStartTime;

    if (response.usage) {
        await agentTelemetry.recordAgentRequest('groq', userId, response.usage.totalTokens, 0, aiDuration);
    }

    // If the AI requested tool calls, execute them and get a final response
    if (response.toolCalls) {
        messages.push({ role: 'assistant', content: response.text ?? '', tool_calls: response.toolCalls });
        const toolResults = await executeToolCalls(response.toolCalls, userId);
        messages.push(...toolResults);

        const finalResponse = await provider.generateText(messages);
        const finalText = finalResponse.text ?? '';
        await saveChatMessage(convId, 'assistant', finalText);
        await usageService.incrementUsage(userId, 'ai_chat');
        return finalText;
    }

    // No tool calls — direct response
    const responseText = response.text ?? '';
    await saveChatMessage(convId, 'assistant', responseText);
    await usageService.incrementUsage(userId, 'ai_chat');
    return responseText;
}

// ── Route: POST /message (main chatbot endpoint) ───────────────────────────

router.post('/message', async (req: AuthRequest, res: Response) => {
    try {
        const { conversationId, message, farmerId, mode = 'ai', language = 'en', imageData } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        // Security: sanitize input
        const inputCheck = aegisShield.sanitizeInput(message);
        if (inputCheck.severity === 'critical') {
            logger.warn(`Critical injection attempt in chatbot message: ${inputCheck.threats.join('; ')}`);
            return res.status(403).json({
                success: false,
                error: 'Request blocked: potential security threat detected',
            });
        }
        const rawSanitized = inputCheck.sanitizedInput;
        if (!rawSanitized) {
            return res.status(400).json({ success: false, error: 'Message content could not be processed' });
        }
        const sanitizedMessage: string = rawSanitized;

        // Usage limits for AI modes
        if (mode === 'ai') {
            const check = await usageService.checkLimit(req.user!.userId, 'ai_chat');
            if (!check.allowed) {
                return res.status(403).json({ success: false, error: 'AI Chat limit exceeded', details: check });
            }
        }

        // Farmer direct messaging mode (no AI)
        if (mode === 'farmer') {
            const result = await handleFarmerMode(sanitizedMessage, conversationId, farmerId);
            return res.json({ success: true, response: 'Message sent to farmer', conversationId: result.conversationId });
        }

        // Image analysis mode
        if (imageData) {
            const result = await handleImageAnalysis(imageData, sanitizedMessage, conversationId, farmerId, req.user!.userId);
            return res.json({ response: result.analysis });
        }

        // Default: AI chat mode
        if (mode !== 'ai') {
            return res.status(400).json({ success: false, error: `Unsupported mode: ${mode}` });
        }

        const convId = await ensureConversationId(farmerId, conversationId, language);
        await saveChatMessage(convId, 'farmer', sanitizedMessage);

        const aiResponse = await processAIChat(sanitizedMessage, convId, language, req.user!.userId);
        res.json({ response: aiResponse });

    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.status).json({ success: false, error: error.message });
        }
        logger.error('Error processing chat message:', error);
        safeError(res, 500, 'Internal server error');
    }
});

router.put('/conversations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        if (!title) return res.status(400).json({ success: false, error: 'Title is required' });
        const pool = getPool();
        if (!pool) return safeError(res, 500, 'Database not available');

        const checkResult = await query('SELECT id FROM chat_conversations WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Conversation not found' });

        try {
            await query(`
                INSERT INTO conversation_metadata (conversation_id, key, value)
                VALUES ($1, 'title', $2)
                ON CONFLICT (conversation_id, key) DO UPDATE SET value = $2
            `, [id, title]);
        } catch (metaError) {
            logger.warn('Could not store title in metadata, continuing anyway');
        }
        res.json({ success: true, data: { id, title } });
    } catch (error) {
        logger.error('Update conversation error:', error);
        safeError(res, 500, 'Failed to update conversation');
    }
});

router.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();
        if (!pool) return safeError(res, 500, 'Database not available');

        await query('DELETE FROM chat_messages WHERE conversation_id = $1', [id]);
        try {
            await query('DELETE FROM conversation_metadata WHERE conversation_id = $1', [id]);
        } catch (e) { /* table might not exist */ }
        await query('DELETE FROM chat_conversations WHERE id = $1', [id]);
        res.json({ success: true, data: { id } });
    } catch (error) {
        logger.error('Delete conversation error:', error);
        safeError(res, 500, 'Failed to delete conversation');
    }
});

router.post('/synthesis', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId, notes, visitDate } = req.body;
        if (!farmerId || !notes) return res.status(400).json({ success: false, error: 'farmerId and notes are required' });

        const check = await usageService.checkLimit(req.user!.userId, 'ai_chat');
        if (!check.allowed) return res.status(403).json({ success: false, error: 'AI Synthesis limit exceeded', details: check });

        const provider = await AIProviderFactory.getProvider('groq');
        const systemPrompt = "You are an agricultural expert. Summarize the following farm visit notes into a professional, concise assessment report with clear recommendations.";
        const userPrompt = `Farmer ID: ${farmerId}\nVisit Date: ${visitDate || 'Today'}\nNotes: ${notes}`;

        const response = await provider.generateText([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        await usageService.incrementUsage(req.user!.userId, 'ai_chat');
        res.json({
            success: true,
            data: {
                summary: response.text,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Synthesis generation error:', error);
        safeError(res, 500, 'Failed to generate synthesis');
    }
});

export default router;
