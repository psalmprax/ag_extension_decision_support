/**
 * i18n URL Middleware
 * 
 * Handles multilingual URLs with multiple depth levels.
 * Supports URLs like:
 * - /api/v1/en/farmers
 * - /api/v1/es/agricultores
 * - /api/v1/en/portfolio/recommendations
 * - /fr/api/v1/portfolio/recommandations
 * 
 * The middleware:
 * 1. Detects language from URL path
 * 2. Translates localized paths to canonical paths
 * 3. Supports unlimited path depth
 */

import { Request, Response, NextFunction } from 'express';

// Supported languages with their configurations
export interface LanguageConfig {
    code: string;           // ISO code (en, es, fr, etc.)
    name: string;           // Display name
    nativeName: string;     // Native name
    isRTL: boolean;        // Right-to-left language
}

// URL path translations: localized path -> canonical path
export interface PathTranslation {
    canonical: string;      // The actual route path (e.g., '/farmers')
    localized: string;     // The translated path (e.g., '/agricultores')
}

// Language and path configuration
export interface I18nConfig {
    languages: LanguageConfig[];
    pathTranslations: Record<string, PathTranslation[]>; // Key is language code
    defaultLanguage: string;
    detectFromHeader: boolean; // Try to detect from Accept-Language header
    urlPosition: 'prefix' | 'domain'; // Where is language in URL
}

// Default supported languages
const SUPPORTED_LANGUAGES: LanguageConfig[] = [
    { code: 'en', name: 'English', nativeName: 'English', isRTL: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', isRTL: false },
    { code: 'fr', name: 'French', nativeName: 'Français', isRTL: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', isRTL: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', isRTL: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', isRTL: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', isRTL: false },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isRTL: false },
];

// Default path translations for common routes
const DEFAULT_PATH_TRANSLATIONS: Record<string, PathTranslation[]> = {
    en: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/knowledge' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/reporting' },
        { canonical: '/analytics', localized: '/analytics' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/users' },
        { canonical: '/farmers', localized: '/farmers' },
        { canonical: '/visits', localized: '/visits' },
        { canonical: '/external', localized: '/external' },
        { canonical: '/language', localized: '/language' },
        { canonical: '/ai', localized: '/ai' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/billing' },
        // Nested paths
        { canonical: '/portfolio/recommendations', localized: '/portfolio/recommendations' },
        { canonical: '/knowledge/search', localized: '/knowledge/search' },
        { canonical: '/knowledge/history', localized: '/knowledge/history' },
        { canonical: '/knowledge/stats', localized: '/knowledge/stats' },
        { canonical: '/knowledge/ask', localized: '/knowledge/ask' },
        { canonical: '/knowledge/meta/categories', localized: '/knowledge/meta/categories' },
        { canonical: '/knowledge/meta/crops', localized: '/knowledge/meta/crops' },
        { canonical: '/knowledge/:id', localized: '/knowledge/:id' },
        { canonical: '/chatbot/conversations', localized: '/chatbot/conversations' },
    ],
    es: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/conocimiento' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/informes' },
        { canonical: '/analytics', localized: '/analitica' },
        { canonical: '/portfolio', localized: '/portafolio' },
        { canonical: '/users', localized: '/usuarios' },
        { canonical: '/farmers', localized: '/agricultores' },
        { canonical: '/visits', localized: '/visitas' },
        { canonical: '/external', localized: '/externo' },
        { canonical: '/language', localized: '/idioma' },
        { canonical: '/ai', localized: '/ia' },
        { canonical: '/upload', localized: '/carga' },
        { canonical: '/notifications', localized: '/notificaciones' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/facturacion' },
        // Nested paths
        { canonical: '/portfolio/recommendations', localized: '/portafolio/recomendaciones' },
        { canonical: '/knowledge/search', localized: '/conocimiento/buscar' },
        { canonical: '/knowledge/meta/categories', localized: '/conocimiento/meta/categorias' },
        { canonical: '/knowledge/meta/crops', localized: '/conocimiento/meta/cultivos' },
        { canonical: '/chatbot/conversations', localized: '/chatbot/conversaciones' },
    ],
    fr: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/connaissances' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/rapports' },
        { canonical: '/analytics', localized: '/analytique' },
        { canonical: '/portfolio', localized: '/portefeuille' },
        { canonical: '/users', localized: '/utilisateurs' },
        { canonical: '/farmers', localized: '/agriculteurs' },
        { canonical: '/visits', localized: '/visites' },
        { canonical: '/external', localized: '/externe' },
        { canonical: '/language', localized: '/langue' },
        { canonical: '/ai', localized: '/ia' },
        { canonical: '/upload', localized: '/telecharger' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/facturation' },
        // Nested paths
        { canonical: '/portfolio/recommendations', localized: '/portefeuille/recommandations' },
        { canonical: '/knowledge/search', localized: '/connaissances/recherche' },
        { canonical: '/knowledge/meta/categories', localized: '/connaissances/meta/categories' },
        { canonical: '/knowledge/meta/crops', localized: '/connaissances/meta/cultures' },
        { canonical: '/chatbot/conversations', localized: '/chatbot/conversations' },
    ],
    de: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/wissen' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/berichte' },
        { canonical: '/analytics', localized: '/analytik' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/benutzer' },
        { canonical: '/farmers', localized: '/bauern' },
        { canonical: '/visits', localized: '/besuche' },
        { canonical: '/external', localized: '/extern' },
        { canonical: '/language', localized: '/sprache' },
        { canonical: '/ai', localized: '/ki' },
        { canonical: '/upload', localized: '/hochladen' },
        { canonical: '/notifications', localized: '/benachrichtigungen' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/abrechnung' },
        // Nested paths
        { canonical: '/portfolio/recommendations', localized: '/portfolio/empfehlungen' },
        { canonical: '/knowledge/search', localized: '/wissen/suche' },
        { canonical: '/knowledge/meta/categories', localized: '/wissen/meta/kategorien' },
        { canonical: '/knowledge/meta/crops', localized: '/wissen/meta/pflanzen' },
        { canonical: '/chatbot/conversations', localized: '/chatbot/unterhaltungen' },
    ],
    ar: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/knowledge' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/reporting' },
        { canonical: '/analytics', localized: '/analytics' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/users' },
        { canonical: '/farmers', localized: '/farmers' },
        { canonical: '/visits', localized: '/visits' },
        { canonical: '/external', localized: '/external' },
        { canonical: '/language', localized: '/language' },
        { canonical: '/ai', localized: '/ai' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/billing' },
    ],
    sw: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/elimu' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/ripoti' },
        { canonical: '/analytics', localized: '/analytics' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/watumiaji' },
        { canonical: '/farmers', localized: '/wakulima' },
        { canonical: '/visits', localized: '/ziara' },
        { canonical: '/external', localized: '/external' },
        { canonical: '/language', localized: '/lugha' },
        { canonical: '/ai', localized: '/ai' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/billing' },
        // Nested paths
        { canonical: '/portfolio/recommendations', localized: '/portfolio/mapendekezo' },
    ],
    pt: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/conhecimento' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/relatorios' },
        { canonical: '/analytics', localized: '/analitica' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/usuarios' },
        { canonical: '/farmers', localized: '/agricultores' },
        { canonical: '/visits', localized: '/visitas' },
        { canonical: '/external', localized: '/externo' },
        { canonical: '/language', localized: '/idioma' },
        { canonical: '/ai', localized: '/ia' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notificacoes' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/faturamento' },
    ],
    zh: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/knowledge' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/reporting' },
        { canonical: '/analytics', localized: '/analytics' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/users' },
        { canonical: '/farmers', localized: '/farmers' },
        { canonical: '/visits', localized: '/visits' },
        { canonical: '/external', localized: '/external' },
        { canonical: '/language', localized: '/language' },
        { canonical: '/ai', localized: '/ai' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/billing' },
    ],
    hi: [
        { canonical: '/auth', localized: '/auth' },
        { canonical: '/knowledge', localized: '/knowledge' },
        { canonical: '/chatbot', localized: '/chatbot' },
        { canonical: '/reporting', localized: '/reporting' },
        { canonical: '/analytics', localized: '/analytics' },
        { canonical: '/portfolio', localized: '/portfolio' },
        { canonical: '/users', localized: '/users' },
        { canonical: '/farmers', localized: '/farmers' },
        { canonical: '/visits', localized: '/visits' },
        { canonical: '/external', localized: '/external' },
        { canonical: '/language', localized: '/language' },
        { canonical: '/ai', localized: '/ai' },
        { canonical: '/upload', localized: '/upload' },
        { canonical: '/notifications', localized: '/notifications' },
        { canonical: '/sms', localized: '/sms' },
        { canonical: '/billing', localized: '/billing' },
    ],
};

// Default i18n configuration
const DEFAULT_I18N_CONFIG: I18nConfig = {
    languages: SUPPORTED_LANGUAGES,
    pathTranslations: DEFAULT_PATH_TRANSLATIONS,
    defaultLanguage: 'en',
    detectFromHeader: true,
    urlPosition: 'prefix',
};

// Current configuration (can be customized)
let i18nConfig: I18nConfig = { ...DEFAULT_I18N_CONFIG };

/**
 * Set custom i18n configuration
 */
function setI18nConfig(config: Partial<I18nConfig>): void {
    i18nConfig = { ...DEFAULT_I18N_CONFIG, ...config };
}

/**
 * Get current i18n configuration
 */
function getI18nConfig(): I18nConfig {
    return i18nConfig;
}

/**
 * Get supported languages
 */
function getSupportedLanguages(): LanguageConfig[] {
    return i18nConfig.languages;
}

/**
 * Get language config by code
 */
function getLanguageConfig(code: string): LanguageConfig | undefined {
    return i18nConfig.languages.find(lang => lang.code === code);
}

/**
 * Check if a language is supported
 */
function isSupportedLanguage(code: string): boolean {
    return i18nConfig.languages.some(lang => lang.code === code);
}

/**
 * Detect language from Accept-Language header
 */
function detectFromHeader(acceptLanguage: string | undefined): string | null {
    if (!acceptLanguage) return null;

    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
    const languages = acceptLanguage
        .split(',')
        .map(lang => {
            const parts = lang.trim().split(';');
            const code = parts[0].split('-')[0].toLowerCase();
            const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1;
            return { code, quality };
        })
        .sort((a, b) => b.quality - a.quality);

    // Find first supported language
    for (const lang of languages) {
        if (isSupportedLanguage(lang.code)) {
            return lang.code;
        }
    }

    return null;
}

/**
 * Translate a localized URL path to canonical path
 */
function translateToCanonical(localizedPath: string, language: string): string {
    const translations = i18nConfig.pathTranslations[language];
    if (!translations) return localizedPath;

    // Try exact match first
    for (const trans of translations) {
        if (trans.localized === localizedPath) {
            return trans.canonical;
        }
    }

    // Try matching path segments
    // Handle paths like /es/portfolio/recommendations -> /portfolio/recommendations
    const pathParts = localizedPath.split('/').filter(Boolean);

    for (const trans of translations) {
        const canonicalParts = trans.canonical.split('/').filter(Boolean);
        const localizedParts = trans.localized.split('/').filter(Boolean);

        // Check if the last parts match
        if (localizedParts.length > 0 && pathParts.length >= localizedParts.length) {
            const pathLastParts = pathParts.slice(-localizedParts.length);

            // Compare last N parts
            if (JSON.stringify(pathLastParts) === JSON.stringify(localizedParts)) {
                // Reconstruct path with canonical prefix
                const prefixParts = pathParts.slice(0, pathParts.length - localizedParts.length);
                return '/' + [...prefixParts, ...canonicalParts].join('/');
            }
        }
    }

    return localizedPath;
}

/**
 * i18n URL Middleware
 * 
 * This middleware:
 * 1. Extracts language from URL path (e.g., /api/v1/es/...)
 * 2. Translates localized paths to canonical paths
 * 3. Attaches language info to request object
 */
export function i18nUrlMiddleware(req: Request, res: Response, next: NextFunction): void {
    const path = req.path;
    // url variable removed as it was unused

    // Skip if not API route
    if (!path.startsWith('/api/')) {
        return next();
    }

    // Try to detect language from URL path
    // Patterns: /api/v1/en/... or /en/api/v1/... or /api/v1/es/...
    let detectedLanguage: string | null = null;
    let remainingPath = path;

    // Pattern 1: /api/v1/{lang}/...
    const apiV1Match = path.match(/^\/api\/v1\/([a-z]{2})(\/.*)?$/i);
    if (apiV1Match) {
        detectedLanguage = apiV1Match[1];
        remainingPath = apiV1Match[2] || '/';
    }

    // Pattern 2: /{lang}/api/...
    if (!detectedLanguage) {
        const langApiMatch = path.match(/^\/([a-z]{2})\/api\/.*$/i);
        if (langApiMatch) {
            detectedLanguage = langApiMatch[1];
        }
    }

    // Validate detected language
    if (detectedLanguage && !isSupportedLanguage(detectedLanguage)) {
        detectedLanguage = null;
    }

    // Fall back to header detection if enabled
    if (!detectedLanguage && i18nConfig.detectFromHeader) {
        detectedLanguage = detectFromHeader(req.headers['accept-language']);
    }

    // Use default language if none detected
    const language = detectedLanguage || i18nConfig.defaultLanguage;

    // Translate localized path to canonical
    const canonicalPath = translateToCanonical(remainingPath, language);

    // Attach language info to request
    req.language = language;
    const langConfig = getLanguageConfig(language);
    req.i18n = {
        language,
        isRTL: langConfig?.isRTL || false,
        originalPath: path,
        canonicalPath,
    };

    // If path was translated, store the translated path for later route matching
    // Use a custom property since req.path is read-only
    if (canonicalPath !== remainingPath) {
        const newPath = path.replace(remainingPath, canonicalPath);
        // Store for use in route matching middleware
        req._i18nTranslatedPath = newPath;
    }

    next();
}

/**
 * Create response transformer for localized URLs
 * Use this to transform outgoing response URLs to localized versions
 */
export function createUrlLocalizer(language: string) {
    return {
        /**
         * Transform a canonical path to localized path
         */
        localizePath(canonicalPath: string): string {
            const translations = i18nConfig.pathTranslations[language];
            if (!translations) return canonicalPath;

            // Try exact match
            for (const trans of translations) {
                if (trans.canonical === canonicalPath) {
                    return trans.localized;
                }
            }

            // Try partial match (for nested paths)
            const pathParts = canonicalPath.split('/').filter(Boolean);

            for (const trans of translations) {
                const canonicalParts = trans.canonical.split('/').filter(Boolean);

                if (canonicalParts.length > 0 && pathParts.length >= canonicalParts.length) {
                    const pathLastParts = pathParts.slice(-canonicalParts.length);

                    if (JSON.stringify(pathLastParts) === JSON.stringify(canonicalParts)) {
                        const prefixParts = pathParts.slice(0, pathParts.length - canonicalParts.length);
                        return '/' + [...prefixParts, ...trans.localized.split('/').filter(Boolean)].join('/');
                    }
                }
            }

            return canonicalPath;
        },

        /**
         * Transform API URL to include language prefix
         */
        localizeUrl(canonicalUrl: string): string {
            // Add language to URL
            if (canonicalUrl.startsWith('/api/')) {
                return `/api/v1/${language}${canonicalUrl.replace('/api/v1', '')}`;
            }
            return canonicalUrl;
        },

        /**
         * Get language-specific route
         */
        getLocalizedRoute(canonicalRoute: string): string {
            return this.localizePath(canonicalRoute);
        },
    };
}

/**
 * Route handler that uses translated i18n path
 * This middleware should be used BEFORE route handlers to support localized URLs
 * It temporarily modifies req.path for route matching
 */
export function i18nRouteHandler(req: Request, _res: Response, next: NextFunction): void {
    const translatedPath = req._i18nTranslatedPath;

    if (translatedPath) {
        // Temporarily override path for route matching (cast to any to bypass read-only)
        const originalPath = req.path;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).path = translatedPath;

        // Store original for restoration after request
        req._originalPath = originalPath;
    }

    next();
}

/**
 * Middleware to restore original path after routing
 * Should be placed AFTER all routes
 */
export function restoreOriginalPath(req: Request, _res: Response, next: NextFunction): void {
    const originalPath = req._originalPath;

    if (originalPath) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).path = originalPath;
    }

    next();
}

export default i18nUrlMiddleware;
