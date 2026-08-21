import { config } from '@/config';
import { logger } from './logger';

export interface ValidationWarning {
    type: 'missing' | 'misconfigured' | 'recommended';
    key: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
}

function validateDatabaseConfig(warnings: ValidationWarning[]): void {
    if (!config.database.url) {
        warnings.push({
            type: 'missing',
            key: 'DATABASE_URL',
            message: 'Database URL is not configured. The application will not function without a database.',
            severity: 'critical',
        });
    }
}

function validateJwtConfig(warnings: ValidationWarning[], isProduction: boolean): void {
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
}

// Maps a configured AI provider to the environment variable(s) that provide its
// credential, so startup validation can warn when the PRIMARY provider is unconfigured.
function getPrimaryAiCredentialStatus(provider: string): { key: string; isConfigured: boolean } {
    switch (provider) {
        case 'openai':
            return { key: 'OPENAI_API_KEY', isConfigured: !!config.openAI.apiKey };
        case 'azure_openai':
            return { key: 'AZURE_OPENAI_API_KEY', isConfigured: !!config.azureOpenAI.apiKey };
        case 'anthropic':
            return { key: 'ANTHROPIC_API_KEY', isConfigured: !!config.anthropic.apiKey };
        case 'groq':
            return { key: 'GROQ_API_KEY', isConfigured: !!config.groq.apiKey };
        case 'google_vertex':
            return { key: 'GOOGLE_VERTEX_PROJECT_ID', isConfigured: !!config.googleVertex.projectId };
        case 'freebuff':
            return { key: 'FREEBUFF_AUTH_TOKEN', isConfigured: !!config.freebuff.authToken };
        case 'ollama':
            // Ollama needs no API key — only a reachable host.
            return { key: 'OLLAMA_HOST', isConfigured: !!config.ollama.host };
        default:
            // Unknown provider — flag it with the provider name so the message is actionable.
            return { key: 'AI_PRIMARY_PROVIDER', isConfigured: false };
    }
}

function validateAiConfig(warnings: ValidationWarning[], isProduction: boolean): void {
    const primary = config.ai.primary.provider;
    const primaryCred = getPrimaryAiCredentialStatus(primary);

    // Warn specifically when the configured PRIMARY provider is missing its key —
    // this is the one that gates every AI request and is the most common cause of
    // the health check reporting "degraded (fallback active)".
    if (!primaryCred.isConfigured) {
        const isUnknownProvider = primaryCred.key === 'AI_PRIMARY_PROVIDER';
        warnings.push({
            type: 'missing',
            key: primaryCred.key,
            message: isUnknownProvider
                ? `Unknown AI primary provider "${primary}". Set AI_PRIMARY_PROVIDER to a supported provider.`
                : `Primary AI provider is set to ${primary} but ${primaryCred.key} is not configured. AI features will fail over to the fallback provider.`,
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
}

function validateExternalServices(warnings: ValidationWarning[]): void {
    if (!config.redis.url) {
        warnings.push({
            type: 'missing',
            key: 'REDIS_URL',
            message: 'Redis is not configured. Caching and rate limiting will not work.',
            severity: 'warning',
        });
    }

    if (!config.externalApis.weather.apiKey) {
        warnings.push({
            type: 'missing',
            key: 'WEATHER_API_KEY',
            message: 'Weather API key not configured. Weather features will be unavailable.',
            severity: 'warning',
        });
    }

    if (!config.stripeSecretKey) {
        warnings.push({
            type: 'recommended',
            key: 'STRIPE_SECRET_KEY',
            message: 'Stripe is not configured. Billing and subscription features will be unavailable.',
            severity: 'info',
        });
    }
}

function validateDeploymentConfig(warnings: ValidationWarning[], isProduction: boolean): void {
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
}

/**
 * Validates that critical configuration is present at startup
 * Logs warnings for missing non-critical configs
 */
export function validateStartupConfiguration(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const isProduction = process.env.NODE_ENV === 'production';

    validateDatabaseConfig(warnings);
    validateJwtConfig(warnings, isProduction);
    validateAiConfig(warnings, isProduction);
    validateExternalServices(warnings);
    validateDeploymentConfig(warnings, isProduction);

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
