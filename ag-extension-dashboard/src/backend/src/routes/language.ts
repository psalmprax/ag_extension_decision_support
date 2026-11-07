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
        if (typeof text !== 'string' || !text.trim() || typeof targetLanguage !== 'string' ||
            typeof sourceLanguage !== 'string') {
            return res.status(400).json({ success: false, error: 'text and targetLanguage are required' });
        }
        if (text.length > 8000) {
            return res.status(400).json({ success: false, error: 'Translation text exceeds 8000 characters' });
        }

        const cacheKey = `trans:v2:${crypto.createHash('sha256').update(JSON.stringify([sourceLanguage, targetLanguage, text])).digest('hex')}`;
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
        const sourceLangName = supportedLanguages.find(l => l.code === sourceLanguage)?.nativeName || sourceLanguage;
        const prompt = `You are an expert human-level translator specializing in agriculture.
Translate the following text from ${sourceLangName} (${sourceLanguage}) into ${langName} (${targetLanguage}).
CRITICAL RULES:
1. Preserve the full meaning; never summarize, add, omit, or invent information.
2. Maintain all Markdown formatting, headings, bullet points, and table structures.
3. Keep cultivar names, chemical formulas, measurements, and scientific terms accurate.
4. Use natural, locally appropriate agricultural terminology, not word-for-word translation.
5. If a technical term has no reliable equivalent, retain it and briefly explain it in the target language.
6. Output only the translation; do not add a preamble, notes, or introductions.

Text to translate:
"""
${text}
"""`;

        const result = await AIRouter.routeRequest('generate', {
            prompt,
            options: { temperature: 0.1, maxTokens: 8192, preferredProvider: 'aihubmix' }
        });

        const translatedText = (result.text || '').trim();
        if (!translatedText) throw new Error('The translation provider returned an empty translation');
        if (result.finishReason === 'length') throw new Error('The translation provider truncated its answer');
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
