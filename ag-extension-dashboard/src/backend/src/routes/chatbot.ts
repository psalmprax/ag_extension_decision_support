/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { toolRegistry, toolMap } from '@/tools/registry';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { usageService } from '../services/usageService';

const router = Router();

// Apply authentication to all chatbot routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

// Helper to get conversations from DB
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

// Get all conversations
router.get('/conversations', async (_req: AuthRequest, res: Response) => {
    try {
        const conversations = await getConversationsFromDB();

        if (conversations.length === 0) {
            return res.json({
                success: true,
                data: []
            });
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
        res.status(500).json({ success: false, error: 'Failed to get conversations' });
    }
});

// Get messages for a conversation
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
        res.status(500).json({ success: false, error: 'Failed to get messages' });
    }
});

// Start a new conversation
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
        res.status(500).json({ success: false, error: 'Failed to create conversation' });
    }
});

// Start a new AI-only conversation (no farmer required)
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
        res.status(500).json({ success: false, error: 'Failed to create AI conversation' });
    }
});

// Send a message - supports two modes:
// - mode='ai': message goes to AI provider for agricultural advice
// - mode='farmer': message is stored for direct farmer conversation
// Send a message
router.post('/message', async (req: AuthRequest, res: Response) => {
    const { conversationId, message, farmerId, mode = 'ai', language = 'en', imageData } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message is required' });
    }

    // AI Check
    if (mode === 'ai') {
        const check = await usageService.checkLimit(req.user!.userId, 'ai_chat');
        if (!check.allowed) {
            return res.status(403).json({
                success: false,
                error: 'AI Chat limit exceeded',
                details: check
            });
        }
    }

    // Farmer Chat Mode - store message directly for farmer conversation
    if (mode === 'farmer') {
        let convId = conversationId;

        // Create conversation if not exists
        if (!convId && farmerId) {
            try {
                const pool = getPool();
                if (pool) {
                    const result = await query(`
                        INSERT INTO chat_conversations (farmer_id, language, status, started_at)
                        VALUES ($1, 'en', 'active', NOW())
                        RETURNING id
                    `, [farmerId]);
                    convId = result.rows[0].id;
                } else {
                    return res.status(503).json({ error: 'Database connection unavailable' });
                }
            } catch (error) {
                logger.error('Create conversation error:', error);
                return res.status(500).json({ success: false, error: 'Failed to create conversation' });
            }
        }

        // Store officer message in DB
        try {
            const pool = getPool();
            if (pool && convId) {
                await query(`
                    INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                    VALUES ($1, 'officer', $2, 'en', NOW())
                `, [convId, message]);

                return res.json({
                    success: true,
                    response: 'Message sent to farmer',
                    conversationId: convId
                });
            }
        } catch (error) {
            logger.error('Error saving farmer message:', error);
            return res.status(500).json({ success: false, error: 'Failed to save message' });
        }
    }

    // AI Chat Mode - process through AI provider (original behavior)

    // Handle image analysis if imageData is provided
    if (imageData) {
        // Enforce 5MB limit for base64 imageData
        const sizeInBytes = (imageData.length * 3) / 4;
        if (sizeInBytes > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'Image size exceeds 5MB limit' });
        }

        try {
            const provider = await AIProviderFactory.getProvider();
            if (!provider.capabilities.includes('vision')) {
                return res.status(400).json({ success: false, error: 'Vision capability not available' });
            }

            const analysis = await provider.analyzeImage(imageData, message, { temperature: 0.3, maxTokens: 1000 });

            // Create conversation if not exists
            let convId = conversationId;
            if (!convId && farmerId) {
                try {
                    const pool = getPool();
                    if (pool) {
                        const result = await query(`
                            INSERT INTO chat_conversations (farmer_id, language, status, started_at)
                            VALUES ($1, 'en', 'active', NOW())
                            RETURNING id
                        `, [farmerId]);
                        convId = result.rows[0].id;
                    } else {
                        return res.status(503).json({ error: 'Database connection unavailable' });
                    }
                } catch (error) {
                    convId = `conv_${Date.now()}`;
                }
            }

            // Store user message (image description) in DB
            try {
                const pool = getPool();
                if (pool && convId) {
                    await query(`
                        INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                        VALUES ($1, 'farmer', $2, 'en', NOW())
                    `, [convId, message || 'Image analysis request']);
                }
            } catch (error) {
                logger.error('Error saving image message:', error);
            }

            // Store AI response in DB
            try {
                const pool = getPool();
                if (pool && convId) {
                    await query(`
                        INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                        VALUES ($1, 'assistant', $2, 'en', NOW())
                    `, [convId, analysis.analysis]);
                }
            } catch (error) {
                logger.error('Error saving analysis message:', error);
            }

            await usageService.incrementUsage(req.user!.userId, 'ai_chat');
            return res.json({ response: analysis.analysis });
        } catch (error) {
            logger.error('Image analysis error:', error);
            return res.status(500).json({ error: 'Image analysis failed' });
        }
    }

    // Create conversation if not exists
    let convId = conversationId;
    if (!convId && farmerId) {
        try {
            const pool = getPool();
            if (pool) {
                const result = await query(`
                    INSERT INTO chat_conversations (farmer_id, language, status, started_at)
                    VALUES ($1, 'en', 'active', NOW())
                    RETURNING id
                `, [farmerId]);
                convId = result.rows[0].id;
            } else {
                return res.status(503).json({ error: 'Database connection unavailable' });
            }
        } catch (error) {
            convId = `conv_${Date.now()}`;
        }
    }

    // Store user message in DB
    try {
        const pool = getPool();
        if (pool && convId) {
            await query(`
                INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                VALUES ($1, 'farmer', $2, 'en', NOW())
            `, [convId, message]);
        }
    } catch (error) {
        logger.error('Error saving user message:', error);
    }

    // Get conversation history from DB
    let history: any[] = [];
    try {
        const pool = getPool();
        if (pool && convId) {
            const result = await query(`
                SELECT role, content FROM chat_messages
                WHERE conversation_id = $1
                ORDER BY created_at ASC
                LIMIT 20
            `, [convId]);
            // Map database roles to API roles (farmer -> user, tool -> skip)
            // Groq only supports: system, user, assistant
            history = (result.rows || [])
                .map((row: any) => {
                    // Convert farmer to user, skip tool messages
                    if (row.role === 'farmer' || row.role === 'officer') {
                        return { role: 'user', content: row.content };
                    }
                    if (row.role === 'assistant' || row.role === 'system') {
                        return { role: row.role, content: row.content };
                    }
                    // Skip invalid roles (like 'tool')
                    return null;
                })
                .filter((msg: { role: string; content: string } | null): msg is { role: string; content: string } => msg !== null);
        }
    } catch (error) {
        logger.error('Error fetching history:', error);
    }

    // Add system message and current message to history
    const languageNames: Record<string, string> = {
        en: 'English', sw: 'Swahili', fr: 'French', es: 'Spanish', de: 'German',
        it: 'Italian', nl: 'Dutch', da: 'Danish', pl: 'Polish', hu: 'Hungarian',
        tr: 'Turkish', ar: 'Arabic', zh: 'Chinese', hi: 'Hindi', ru: 'Russian',
        uk: 'Ukrainian', ro: 'Romanian', cs: 'Czech', sk: 'Slovak', bg: 'Bulgarian',
        el: 'Greek', oro: 'Oromo', lug: 'Luganda', zu: 'Zulu'
    };
    const langName = languageNames[language] || 'English';
    const systemMessage = {
        role: 'system',
        content: `You are a "Real-First" AI agricultural assistant helping extension officers and farmers with expert advice.
        
        CRITICAL OPERATING GUIDELINES:
        1. DATA DRIFT: Do NOT rely on your internal training data for volatile information like Market Prices or Weather. ALWAYS use the provided tools (get_market_prices, get_weather_forecast) to get current data.
        2. DISEASE VIGILANCE: Regularly check for regional threats using (get_disease_alerts). If you discover a critical threat through research or alerts, proactively suggest using (register_agricultural_alert) to update the system and warn others.
        3. DEEP RESEARCH: For complex technical questions about crop diseases or new farming methods, use (research_agricultural_data) to fetch the latest scientific findings.
        4. SYSTEM UPDATES: You have the authority to schedule visits (schedule_visit) and register system-wide alerts (register_agricultural_alert). Use these skills when a situation requires human intervention or broad notification.
        
        Provide accurate, practical, and location-specific advice. ALWAYS respond in ${langName} language.`
    };

    // Build messages array with system message first
    const messages = [systemMessage, ...history, { role: 'user', content: message }];

    try {
        // Try Groq first (fastest), fallback to others
        const provider = await AIProviderFactory.getProvider('groq');

        // First call to the model
        const response = await provider.generateText(messages, { tools: toolRegistry });

        const responseMessage = {
            role: 'assistant',
            content: response.text,
            tool_calls: response.toolCalls,
        };

        messages.push(responseMessage);

        // Handle tool calls if any
        if (response.toolCalls) {
            const toolResults = [];

            for (const toolCall of response.toolCalls) {
                const tool = toolMap.get(toolCall.function.name);
                if (tool) {
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        const validatedArgs = tool.schema.parse(args);
                        const result = await tool.execute(validatedArgs);
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: toolCall.function.name,
                            content: result,
                        });
                    } catch (error) {
                        let errorMessage = 'Error executing tool';
                        if (error instanceof z.ZodError) {
                            errorMessage = `Invalid arguments: ${error.message}`;
                        } else if (error instanceof Error) {
                            errorMessage = error.message;
                        }
                        logger.error(errorMessage);
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: toolCall.function.name,
                            content: errorMessage,
                        });
                    }
                }
            }

            messages.push(...toolResults);

            // Second call with tool results
            const finalResponse = await provider.generateText(messages);
            messages.push({ role: 'assistant', content: finalResponse.text });

            // Save assistant message to DB
            try {
                const pool = getPool();
                if (pool && convId) {
                    await query(`
                        INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                        VALUES ($1, 'assistant', $2, 'en', NOW())
                    `, [convId, finalResponse.text]);
                }
            } catch (error) {
                logger.error('Error saving assistant message:', error);
            }

            await usageService.incrementUsage(req.user!.userId, 'ai_chat');
            return res.json({ response: finalResponse.text });
        }

        // Save assistant message to DB
        try {
            const pool = getPool();
            if (pool && convId) {
                await query(`
                    INSERT INTO chat_messages (conversation_id, role, content, language, created_at)
                    VALUES ($1, 'assistant', $2, 'en', NOW())
                `, [convId, response.text]);
            }
        } catch (error) {
            logger.error('Error saving assistant message:', error);
        }

        await usageService.incrementUsage(req.user!.userId, 'ai_chat');
        res.json({ response: response.text });
    } catch (error) {
        logger.error('Error processing chat message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Speech to text
router.post('/speech-to-text', async (req: Request, res: Response) => {
    try {
        const { audio, language = 'en' } = req.body;

        if (!audio) {
            return res.status(400).json({ success: false, error: 'Audio data is required' });
        }

        // Use AI provider for speech recognition
        const provider = await AIProviderFactory.getProvider();
        const result = await provider.speechToText(Buffer.from(audio, 'base64'), { language });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        logger.error('Speech to text error:', error);
        res.status(500).json({ success: false, error: 'Transcription failed' });
    }
});

// Text to speech
router.post('/text-to-speech', async (req: Request, res: Response) => {
    try {
        const { text, language = 'en', voice = 'default' } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'Text is required' });
        }

        const provider = await AIProviderFactory.getProvider();
        const result = await provider.textToSpeech(text, { language, voice });

        res.json({
            success: true,
            data: {
                audioUrl: result.audio.toString('base64'),
                format: result.format,
            },
        });
    } catch (error) {
        logger.error('Text to speech error:', error);
        res.status(500).json({ success: false, error: 'TTS generation failed' });
    }
});

// Update conversation title (stores in status field as workaround)
router.put('/conversations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        const pool = getPool();
        if (!pool) {
            return res.status(500).json({ success: false, error: 'Database not available' });
        }

        // Check if conversation exists
        const checkResult = await query('SELECT id FROM chat_conversations WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Store title using a metadata approach - try the table, if it fails continue anyway
        try {
            await query(`
                INSERT INTO conversation_metadata (conversation_id, key, value)
                VALUES ($1, 'title', $2)
                ON CONFLICT (conversation_id, key) 
                DO UPDATE SET value = $2
            `, [id, title]);
        } catch (metaError) {
            logger.warn('Could not store title in metadata, continuing anyway');
        }

        res.json({ success: true, data: { id, title } });
    } catch (error) {
        logger.error('Update conversation error:', error);
        res.status(500).json({ success: false, error: 'Failed to update conversation' });
    }
});

// Delete conversation
router.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const pool = getPool();
        if (!pool) {
            return res.status(500).json({ success: false, error: 'Database not available' });
        }

        // Delete messages first
        await query('DELETE FROM chat_messages WHERE conversation_id = $1', [id]);

        // Try to delete metadata, but don't fail if table doesn't exist
        try {
            await query('DELETE FROM conversation_metadata WHERE conversation_id = $1', [id]);
        } catch (e) {
            // Table might not exist, continue anyway
        }

        // Delete the conversation
        await query('DELETE FROM chat_conversations WHERE id = $1', [id]);

        res.json({ success: true, data: { id } });
    } catch (error) {
        logger.error('Delete conversation error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete conversation' });
    }
});

// Generate visit synthesis / summary
router.post('/synthesis', async (req: AuthRequest, res: Response) => {
    try {
        const { farmerId, notes, visitDate } = req.body;

        if (!farmerId || !notes) {
            return res.status(400).json({ success: false, error: 'farmerId and notes are required' });
        }

        const check = await usageService.checkLimit(req.user!.userId, 'ai_chat');
        if (!check.allowed) {
            return res.status(403).json({ success: false, error: 'AI Synthesis limit exceeded', details: check });
        }

        // Use AI provider to generate a summary
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
        res.status(500).json({ success: false, error: 'Failed to generate synthesis' });
    }
});

export default router;
