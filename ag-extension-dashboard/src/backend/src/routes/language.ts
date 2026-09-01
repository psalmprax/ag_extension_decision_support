import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import crypto from 'crypto';

const router = Router();

// Apply authentication to all language routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Supported languages configuration
const supportedLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
    { code: 'sw', name: 'Swahili', flag: '🇰🇪', nativeName: 'Kiswahili' },
    { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { code: 'ha', name: 'Hausa', flag: '🇳🇬', nativeName: 'Harshen Hausa' },
    { code: 'yo', name: 'Yoruba', flag: '🇳🇬', nativeName: 'Èdè Yorùbá' },
    { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    { code: 'oro', name: 'Oromo', flag: '🇪🇹', nativeName: 'Oromoo' },
    { code: 'lug', name: 'Luganda', flag: '🇺🇬', nativeName: 'Luganda' },
    { code: 'zu', name: 'Zulu', flag: '🇿🇦', nativeName: 'isiZulu' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
];

// Languages supported by AI chatbot and translation engine
const aiSupportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Swahili' },
    { code: 'fr', name: 'French' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'es', name: 'Spanish' },
    { code: 'ha', name: 'Hausa' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'de', name: 'German' },
];

// Get all supported languages
router.get('/', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            languages: supportedLanguages,
            defaultLanguage: 'en',
            total: supportedLanguages.length,
        },
    });
});

// Get languages supported by AI chatbot
router.get('/ai-supported', (req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            languages: aiSupportedLanguages,
            defaultLanguage: 'en',
        },
    });
});

// Get language by code
router.get('/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const language = supportedLanguages.find(l => l.code === code);

    if (!language) {
        return res.status(404).json({
            success: false,
            error: 'Language not found',
        });
    }

    res.json({
        success: true,
        data: language,
    });
});

// Translate agronomic text or advisory into target language
router.post('/translate', async (req: Request, res: Response) => {
    try {
        const { text, targetLanguage, sourceLanguage = 'en' } = req.body;
        if (!text || !targetLanguage) {
            return res.status(400).json({ success: false, error: 'text and targetLanguage are required' });
        }

        const cacheKey = `trans:${crypto.createHash('md5').update(`${targetLanguage}:${text.slice(0, 500)}`).digest('hex')}`;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: {
                    translatedText: cached,
                    cached: true,
                    targetLanguage,
                    sourceLanguage
                }
            });
        }

        const langName = supportedLanguages.find(l => l.code === targetLanguage)?.nativeName || targetLanguage;
        const prompt = `You are a professional agricultural translator and expert agronomist.
Translate the following agronomic advice and scientific findings into ${langName} (${targetLanguage}).
CRITICAL RULES:
1. Maintain all Markdown formatting, headings (###, ####), bullet points, and table structures exactly.
2. Keep cultivar names, chemical formulas, and scientific terms accurate.
3. Localize agricultural terminology appropriately for farmers and extension officers.
4. Output ONLY the translated markdown. Do not add any conversational preamble, notes, or introductions.

Text to translate:
"""
${text}
"""`;

        const result = await AIRouter.routeRequest('generate', {
            prompt,
            options: { temperature: 0.1, maxTokens: 2500 }
        });

        const translatedText = (result.text || text).trim();
        await cacheSet(cacheKey, translatedText, 86400); // 24-hour cache

        return res.json({
            success: true,
            data: {
                translatedText,
                targetLanguage,
                sourceLanguage,
                cached: false
            }
        });
    } catch (error) {
        logger.error('Translation error:', error);
        safeError(res, 500, 'Failed to translate content');
    }
});

export default router;
