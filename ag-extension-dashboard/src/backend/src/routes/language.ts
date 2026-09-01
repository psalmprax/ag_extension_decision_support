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
    // Major Global Languages
    { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
    { code: 'sw', name: 'Swahili', flag: '🇰🇪', nativeName: 'Kiswahili' },
    { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
    { code: 'zh', name: 'Chinese (Simplified)', flag: '🇨🇳', nativeName: '中文 (简体)' },
    { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
    { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
    { code: 'uk', name: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
    { code: 'id', name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
    { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
    { code: 'th', name: 'Thai', flag: '🇹🇭', nativeName: 'ไทย' },
    { code: 'fil', name: 'Filipino', flag: '🇵🇭', nativeName: 'Wikang Filipino' },
    { code: 'fa', name: 'Persian', flag: '🇮🇷', nativeName: 'فارسی' },
    { code: 'ur', name: 'Urdu', flag: '🇵🇰', nativeName: 'اردو' },
    { code: 'bn', name: 'Bengali', flag: '🇧🇩', nativeName: 'বাংলা' },
    { code: 'pa', name: 'Punjabi', flag: '🇮🇳', nativeName: 'ਪੰਜਾਬੀ' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳', nativeName: 'தமிழ்' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳', nativeName: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', flag: '🇮🇳', nativeName: 'मराठी' },

    // African Regional & Indigenous Languages
    { code: 'ha', name: 'Hausa', flag: '🇳🇬', nativeName: 'Harshen Hausa' },
    { code: 'yo', name: 'Yoruba', flag: '🇳🇬', nativeName: 'Èdè Yorùbá' },
    { code: 'ig', name: 'Igbo', flag: '🇳🇬', nativeName: 'Asụsụ Igbo' },
    { code: 'am', name: 'Amharic', flag: '🇪🇹', nativeName: 'አማርኛ' },
    { code: 'om', name: 'Oromo', flag: '🇪🇹', nativeName: 'Afaan Oromoo' },
    { code: 'ti', name: 'Tigrinya', flag: '🇪🇷', nativeName: 'ትግርኛ' },
    { code: 'so', name: 'Somali', flag: '🇸🇴', nativeName: 'Af-Soomaali' },
    { code: 'lg', name: 'Luganda', flag: '🇺🇬', nativeName: 'Oluganda' },
    { code: 'rw', name: 'Kinyarwanda', flag: '🇷🇼', nativeName: 'Ikinyarwanda' },
    { code: 'rn', name: 'Kirundi', flag: '🇧🇮', nativeName: 'Ikirundi' },
    { code: 'zu', name: 'Zulu', flag: '🇿🇦', nativeName: 'isiZulu' },
    { code: 'xh', name: 'Xhosa', flag: '🇿🇦', nativeName: 'isiXhosa' },
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦', nativeName: 'Afrikaans' },
    { code: 'sn', name: 'Shona', flag: '🇿🇼', nativeName: 'chiShona' },
    { code: 'ny', name: 'Chichewa', flag: '🇲🇼', nativeName: 'Chichewa' },
    { code: 'wo', name: 'Wolof', flag: '🇸🇳', nativeName: 'Wolof' },
    { code: 'bm', name: 'Bambara', flag: '🇲🇱', nativeName: 'Bamanankan' },
    { code: 'ff', name: 'Fula', flag: '🇬🇳', nativeName: 'Fulfulde' },
    { code: 'ln', name: 'Lingala', flag: '🇨🇩', nativeName: 'Lingála' },
    { code: 'mg', name: 'Malagasy', flag: '🇲🇬', nativeName: 'Fiteny Malagasy' },
];

// Languages supported by AI chatbot and translation engine
const aiSupportedLanguages = supportedLanguages.map(l => ({ code: l.code, name: l.name }));

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
