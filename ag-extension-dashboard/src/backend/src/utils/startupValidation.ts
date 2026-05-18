import { config, AppConfig } from '@/config';
import { logger } from './logger';

export interface ValidationWarning {
    type: 'missing' | 'misconfigured' | 'recommended';
    key: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
}

/**
 * Validates that critical configuration is present at startup
 * Logs warnings for missing non-critical configs
 */
export function validateStartupConfiguration(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    // === Critical: Database ===
    if (!config.database.url) {
        warnings.push({
            type: 'missing',
            key: 'DATABASE_URL',
            message: 'Database URL is not configured. The application will not function without a database.',
            severity: 'critical',
        });
    }

    // === Critical: JWT Secret ===
    if (!config.jwt.secret || config.jwt.secret === 'dev-secret-key-for-local-only') {
        if (isProduction) {
            warnings.push({
                type: 'missing',
                key: 'JWT_SECRET',
                message: 'JWT_SECRET is using the default dev key. Set a strong, unique secret in production.',
                severity: 'critical',
            });
        } else {
            logger.warn('JWT_SECRET is using the default development key. This is fine for local dev only.');
        }
    }

    // === Critical: AI Provider ===
    if (!config.openAI.apiKey && !config.azureOpenAI.apiKey && !config.anthropic.apiKey && !config.groq.apiKey) {
        warnings.push({
            type: 'missing',
            key: 'AI_API_KEY',
            message: `No AI provider is configured. Set OPENAI_API_KEY, AZURE_OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY. Current primary provider: ${config.ai.primary.provider}`,
            severity: 'critical',
        });
    }

    if (config.ai.primary.provider === 'openai' && !config.openAI.apiKey) {
        warnings.push({
            type: 'missing',
            key: 'OPENAI_API_KEY',
            message: 'Primary AI provider is set to OpenAI but OPENAI_API_KEY is not configured.',
            severity: isProduction ? 'critical' : 'warning',
        });
    }

    if (config.ai.primary.model?.includes('gpt-4') && isProduction) {
        warnings.push({
            type: 'recommended',
            key: 'AI_MODEL',
            message: `Using ${config.ai.primary.model} as primary model. Consider gpt-4o-mini for cost efficiency in production.`,
            severity: 'info',
        });
    }

    // === Warning: Redis ===
    if (!config.redis.url) {
        warnings.push({
            type: 'missing',
            key: 'REDIS_URL',
            message: 'Redis is not configured. Caching and rate limiting will not work.',
            severity: 'warning',
        });
    }

    // === Warning: External APIs ===
    if (!config.externalApis.weather.apiKey) {
        warnings.push({
            type: 'missing',
            key: 'WEATHER_API_KEY',
            message: 'Weather API key not configured. Weather features will be unavailable.',
            severity: 'warning',
        });
    }

    // === Info: Stripe ===
    if (!config.stripeSecretKey) {
        warnings.push({
            type: 'recommended',
            key: 'STRIPE_SECRET_KEY',
            message: 'Stripe is not configured. Billing and subscription features will be unavailable.',
            severity: 'info',
        });
    }

    // === Info: Deployment ===
    if (isProduction) {
        if (!process.env.CORS_ORIGIN) {
            warnings.push({
                type: 'recommended',
                key: 'CORS_ORIGIN',
                message: 'CORS_ORIGIN not set. Consider setting it to your frontend domain.',
                severity: 'info',
            });
        }

        if (!process.env.SENTRY_DSN) {
            warnings.push({
                type: 'recommended',
                key: 'SENTRY_DSN',
                message: 'Sentry DSN not configured. Error tracking will not be available.',
                severity: 'info',
            });
        }
    }

    return warnings;
}

/**
 * Log all configuration warnings at startup
 */
export function logStartupWarnings(warnings: ValidationWarning[]): void {
    if (warnings.length === 0) {
        logger.info('✓ All configuration checks passed');
        return;
    }

    const critical = warnings.filter(w => w.severity === 'critical');
    const warnings_list = warnings.filter(w => w.severity === 'warning');
    const info = warnings.filter(w => w.severity === 'info');

    if (critical.length > 0) {
        logger.error('=== CRITICAL CONFIGURATION ISSUES ===');
        for (const w of critical) {
            logger.error(`  ✗ ${w.key}: ${w.message}`);
        }
    }

    if (warnings_list.length > 0) {
        logger.warn('=== CONFIGURATION WARNINGS ===');
        for (const w of warnings_list) {
            logger.warn(`  ⚠ ${w.key}: ${w.message}`);
        }
    }

    if (info.length > 0) {
        logger.info('=== RECOMMENDED CONFIGURATIONS ===');
        for (const w of info) {
            logger.info(`  ℹ ${w.key}: ${w.message}`);
        }
    }

    // In production, do not start if critical issues exist
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && critical.length > 0) {
        logger.error(`❌ ${critical.length} critical configuration issue(s) found. Fix them before deploying to production.`);
    }
}

/**
 * Run startup validation and return whether the app should proceed
 */
export function shouldProceedAtStartup(warnings: ValidationWarning[]): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    const critical = warnings.filter(w => w.severity === 'critical');

    if (isProduction && critical.length > 0) {
        return false;
    }

    return true;
}
