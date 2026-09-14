const LocalhostPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export interface CorsOriginOptions {
    nodeEnv: string;
    allowedOrigins: string[];
}

/**
 * Pure CORS origin policy. Local development origins (localhost/127.0.0.1)
 * are only honoured outside production so leaked dev tooling cannot call prod APIs.
 *
 * Subdomain trust is opt-in per suffix via allowedOrigins entries of the form
 * `*.gpexts.com` — a blanket `*.gpexts.com` default previously granted
 * credentialed CORS to ANY subdomain (subdomain takeover or a compromised
 * sibling = full credentialed API access). Exact origins still match exactly.
 */
export const isOriginAllowed = (origin: string | undefined, options: CorsOriginOptions): boolean => {
    if (!origin) return true;
    if (options.nodeEnv !== 'production') return true;
    if (options.allowedOrigins.includes('*')) return true;
    if (options.allowedOrigins.includes(origin)) return true;

    // Opt-in wildcard suffixes: an entry like `*.gpexts.com` matches any
    // single-label (or deeper) subdomain of gpexts.com over https.
    for (const entry of options.allowedOrigins) {
        if (!entry.startsWith('*.')) continue;
        const suffix = entry.slice(1); // ".gpexts.com"
        if (origin.toLowerCase().endsWith(suffix.toLowerCase())) {
            const rest = origin.slice(0, origin.length - suffix.length);
            const schemeSep = rest.indexOf('://');
            if (schemeSep > 0) {
                const host = rest.slice(schemeSep + 3).split(':')[0];
                if (host.length > 0 && !host.includes('*')) return /^https:\/\//i.test(origin);
            }
        }
    }

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
