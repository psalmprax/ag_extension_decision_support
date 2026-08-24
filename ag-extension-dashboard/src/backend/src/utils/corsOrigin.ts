const GPExTSubdomainPattern = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gpexts\.com(?::\d+)?$/i;
const LocalhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export interface CorsOriginOptions {
    nodeEnv: string;
    allowedOrigins: string[];
}

/**
 * Pure CORS origin policy. Local development origins (localhost/127.0.0.1)
 * are only honoured outside production so leaked dev tooling cannot call prod APIs.
 */
export const isOriginAllowed = (origin: string | undefined, options: CorsOriginOptions): boolean => {
    if (!origin) return true;
    if (options.nodeEnv !== 'production') return true;
    if (options.allowedOrigins.includes('*')) return true;
    if (options.allowedOrigins.includes(origin)) return true;
    if (GPExTSubdomainPattern.test(origin)) return true;
    if (LocalhostPattern.test(origin)) return false;
    return false;
};

export const resolveCorsOrigin = (
    allowedOrigins: string[],
    nodeEnv: string = process.env.NODE_ENV || 'development'
): ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) => {
    return (origin, callback) => {
        if (isOriginAllowed(origin, { nodeEnv, allowedOrigins })) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    };
};
