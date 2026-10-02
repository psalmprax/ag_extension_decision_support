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
/**
 * Single opt-in wildcard entry (`*.gpexts.com`) against one origin.
 * Returns true only for https origins whose host is a real subdomain of the
 * suffix (non-empty host, no nested wildcards).
 */
function matchesWildcardSuffix(origin: string, entry: string): boolean {
    if (!entry.startsWith('*.')) return false;
    const suffix = entry.slice(1); // ".gpexts.com"
    if (!origin.toLowerCase().endsWith(suffix.toLowerCase())) return false;
    const rest = origin.slice(0, origin.length - suffix.length);
    const schemeSep = rest.indexOf('://');
    if (schemeSep <= 0) return false;
    const host = rest.slice(schemeSep + 3).split(':')[0];
    if (host.length === 0 || host.includes('*')) return false;
    return /^https:\/\//i.test(origin);
}

/**
 * Match paired apex and www domains over the same scheme and port
 * (e.g., https://www.gpexts.com <-> https://gpexts.com).
 * This ensures that if either the www subdomain or the apex domain is
 * whitelisted, the corresponding counterpart is also trusted.
 */
function matchesApexOrWww(origin: string, allowedOrigin: string): boolean {
    if (!/^https?:\/\//i.test(origin) || !/^https?:\/\//i.test(allowedOrigin)) {
        return false;
    }
    try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowedOrigin);
        if (originUrl.protocol !== allowedUrl.protocol) return false;
        if (originUrl.port !== allowedUrl.port) return false;

        const originHost = originUrl.hostname.toLowerCase();
        const allowedHost = allowedUrl.hostname.toLowerCase();

        // Allowed is www.domain.tld, request is from apex domain.tld
        if (allowedHost.startsWith('www.') && allowedHost.slice(4) === originHost) {
            return true;
        }
        // Allowed is apex domain.tld, request is from www.domain.tld
        if (originHost.startsWith('www.') && originHost.slice(4) === allowedHost) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export const isOriginAllowed = (origin: string | undefined, options: CorsOriginOptions): boolean => {
    if (!origin) return true;
    if (options.nodeEnv !== 'production') return true;
    if (options.allowedOrigins.includes('*')) return true;
    if (options.allowedOrigins.includes(origin)) return true;

    // Direct www <-> apex domain pairing (e.g. www.gpexts.com <-> gpexts.com)
    if (options.allowedOrigins.some(entry => matchesApexOrWww(origin, entry))) return true;

    // Extension wildcard support (e.g. chrome-extension://*)
    if (options.allowedOrigins.includes('chrome-extension://*') && origin.startsWith('chrome-extension://')) return true;

    // Opt-in wildcard suffixes: an entry like `*.gpexts.com` matches any
    // single-label (or deeper) subdomain of gpexts.com over https.
    if (options.allowedOrigins.some(entry => matchesWildcardSuffix(origin, entry))) return true;

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
