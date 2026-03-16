/**
 * Privacy Utility
 * Masks sensitive information in logs and API responses
 */

// Patterns for sensitive data that should be masked
const SENSITIVE_PATTERNS = {
    // Email addresses
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Phone numbers (various formats)
    phone: /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/g,
    // Credit card numbers
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    // Social Security Numbers (various formats)
    ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    // API keys (generic patterns)
    apiKey: /(api[_-]?key|apikey|secret[_-]?key|auth[_-]?token)['":\s=]+['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    // JWT tokens
    jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    // Bank account numbers
    bankAccount: /\b\d{8,17}\b/g,
    // Passwords in URLs
    passwordInUrl: /[?&](password|pwd|pass)=([^&]+)/gi,
};

/**
 * Mask sensitive data in a string
 */
export function maskSensitiveData(input: string): string {
    if (typeof input !== 'string') {
        return input;
    }

    let masked = input;

    // Mask emails
    masked = masked.replace(SENSITIVE_PATTERNS.email, '[EMAIL_REDACTED]');

    // Mask phone numbers (be more selective to avoid false positives)
    masked = masked.replace(/(\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4})/g, '[PHONE_REDACTED]');

    // Mask credit cards
    masked = masked.replace(SENSITIVE_PATTERNS.creditCard, '****-****-****-****');

    // Mask SSN
    masked = masked.replace(SENSITIVE_PATTERNS.ssn, '***-**-****');

    // Mask API keys
    masked = masked.replace(SENSITIVE_PATTERNS.apiKey, '$1=[REDACTED]');

    // Mask JWT
    masked = masked.replace(SENSITIVE_PATTERNS.jwt, '[JWT_REDACTED]');

    // Mask passwords in URLs
    masked = masked.replace(SENSITIVE_PATTERNS.passwordInUrl, '$1=[REDACTED]');

    return masked;
}

/**
 * Mask sensitive data in an object (recursive)
 */
export function maskObject(obj: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 10 || obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return maskSensitiveData(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => maskObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
        const masked: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            // Check if this key is sensitive
            const lowerKey = key.toLowerCase();
            const sensitiveKeys = [
                'password', 'pwd', 'pass', 'secret', 'token', 'auth', 'api_key',
                'apikey', 'ssn', 'social_security', 'credit_card', 'card_number',
                'cvv', 'bank_account', 'iban', 'phone', 'mobile', 'email',
                'address', 'location', 'gps', 'latitude', 'longitude'
            ];

            const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

            if (isSensitive && value !== null && value !== undefined) {
                // Mask sensitive fields
                if (typeof value === 'string') {
                    if (lowerKey.includes('email')) {
                        masked[key] = '[EMAIL_REDACTED]';
                    } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
                        masked[key] = '[PHONE_REDACTED]';
                    } else if (lowerKey.includes('lat') || lowerKey.includes('lng') || lowerKey.includes('gps')) {
                        masked[key] = '[COORDINATES_REDACTED]';
                    } else {
                        masked[key] = '[REDACTED]';
                    }
                } else {
                    masked[key] = '[REDACTED]';
                }
            } else {
                masked[key] = maskObject(value, depth + 1);
            }
        }

        return masked;
    }

    return obj;
}

/**
 * Create a safe log message that masks sensitive data
 */
export function safeLog(message: string, ...args: unknown[]): void {
    const maskedArgs = args.map(arg => {
        if (typeof arg === 'string') {
            return maskSensitiveData(arg);
        }
        return maskObject(arg);
    });

    console.log(message, ...maskedArgs);
}

/**
 * Check if a user has access to view sensitive field data
 */
export function canViewSensitiveData(userRole: string, dataOwnerId: string, userId: string): boolean {
    // Admin can see everything
    if (userRole === 'admin' || userRole === 'regional_manager') {
        return true;
    }

    // Users can see their own data
    if (dataOwnerId === userId) {
        return true;
    }

    // Extension officers can see data for their assigned farmers
    if (userRole === 'extension_officer') {
        // This would need to check if the officer is assigned to this farmer
        // For now, return false - would need database check
        return false;
    }

    // Farmers can only see their own data
    return false;
}
