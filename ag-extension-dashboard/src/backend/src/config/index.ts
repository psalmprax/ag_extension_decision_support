import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });


export interface AppConfig {
    port: number;
    nodeEnv: string;
    database: { url: string };
    redis: { url: string };
    jwt: { secret: string; expiresIn: string };
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
    ai: {
        primary: { provider: string; model: string; region: string };
        fallback: { provider: string; model: string; region: string };
        embeddings: { provider: string; model: string };
        speech: { provider: string; voice: string };
    };
    azureOpenAI: { apiKey: string; endpoint: string; deploymentName: string };
    googleVertex: { projectId: string; location: string };
    openAI: { apiKey: string };
    anthropic: { apiKey: string };
    groq: { apiKey: string };
    externalApis: {
        weather: { apiKey: string; url: string };
        fao: { url: string };
        tavily: { apiKey: string };
    };
    cors: { origin: string };
    demo: { password: string; enabled: boolean };
    ollama: { host: string; model: string };
    ingestion: {
        enabled: boolean;
        schedule: 'daily' | 'weekly';
    };
}

const isProduction = process.env.NODE_ENV === 'production';

// Helper to get environment variables with validation
function getEnv(key: string, defaultValue?: string, requiredInProd = false): string {
    const value = process.env[key];
    if (value) return value;
    if (isProduction && requiredInProd) {
        throw new Error(`Environment variable ${key} is required in production`);
    }
    return defaultValue || '';
}


export const config: AppConfig = {
    port: parseInt(getEnv('PORT', '3000'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),

    database: {
        url: getEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/ag_extension', false),
    },

    redis: {
        url: getEnv('REDIS_URL', 'redis://localhost:6379', false),
    },

    jwt: {
        secret: getEnv('JWT_SECRET', isProduction ? undefined : 'dev-secret-key-for-local-only', true),
        expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    },

    stripeSecretKey: getEnv('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),

    ai: {
        primary: {
            provider: getEnv('AI_PRIMARY_PROVIDER', 'azure_openai'),
            model: getEnv('AI_PRIMARY_MODEL', 'gpt-4'),
            region: getEnv('AI_PRIMARY_REGION', 'eastus'),
        },
        fallback: {
            provider: getEnv('AI_FALLBACK_PROVIDER', 'google_vertex'),
            model: getEnv('AI_FALLBACK_MODEL', 'gemini-pro'),
            region: getEnv('AI_FALLBACK_REGION', 'us-central1'),
        },
        embeddings: {
            provider: getEnv('AI_EMBEDDINGS_PROVIDER', 'openai'),
            model: getEnv('AI_EMBEDDINGS_MODEL', 'text-embedding-3-large'),
        },
        speech: {
            provider: getEnv('AI_SPEECH_PROVIDER', 'azure_speech'),
            voice: getEnv('AI_SPEECH_VOICE', 'standard'),
        },
    },

    azureOpenAI: {
        apiKey: getEnv('AZURE_OPENAI_API_KEY'),
        endpoint: getEnv('AZURE_OPENAI_ENDPOINT'),
        deploymentName: getEnv('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4'),
    },

    googleVertex: {
        projectId: getEnv('GOOGLE_VERTEX_PROJECT_ID'),
        location: getEnv('GOOGLE_VERTEX_LOCATION', 'us-central1'),
    },

    openAI: {
        apiKey: getEnv('OPENAI_API_KEY'),
    },

    anthropic: {
        apiKey: getEnv('ANTHROPIC_API_KEY'),
    },

    groq: {
        apiKey: getEnv('GROQ_API_KEY'),
    },

    externalApis: {
        weather: {
            apiKey: getEnv('WEATHER_API_KEY'),
            url: getEnv('WEATHER_API_URL', 'https://api.weatherapi.com/v1'),
        },
        fao: {
            url: getEnv('FAO_API_URL', 'https://fenixservices.fao.org/fao/v1'),
        },
        tavily: {
            apiKey: getEnv('TAVILY_API_KEY'),
        },
    },

    cors: {
        origin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),
    },

    demo: {
        password: getEnv('DEMO_PASSWORD', 'demo-trial-2024'),
        enabled: getEnv('DEMO_ENABLED', 'false') === 'true',
    },
    ollama: {
        host: getEnv('OLLAMA_HOST', 'http://localhost:11434'),
        model: getEnv('OLLAMA_MODEL', 'llama3'),
    },
    ingestion: {
        enabled: getEnv('INGESTION_ENABLED', 'true') === 'true',
        schedule: getEnv('INGESTION_SCHEDULE', 'weekly') as 'daily' | 'weekly',
    },
};
