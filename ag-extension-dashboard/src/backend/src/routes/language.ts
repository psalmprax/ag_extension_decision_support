import { Router, Request, Response } from 'express';
import { authorize } from '@/middleware/authorize';

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

// Languages supported by AI chatbot (fewer languages due to LLM capabilities)
const aiSupportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Swahili' },
    { code: 'fr', name: 'French' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'es', name: 'Spanish' },
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

export default router;
