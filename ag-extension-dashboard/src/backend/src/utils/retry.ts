/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from './logger';

export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: ((error: any) => boolean);
}

const defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: (error: any) => {
        // Retry on network errors, timeouts, rate limits (429), and server errors (5xx)
        if (!error.response) return true; // Network error
        const status = error.response?.status;
        return status === 429 || (status >= 500 && status < 600);
    },
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const opts = { ...defaultRetryOptions, ...options };
    let lastError: any;
    let delay = opts.initialDelay;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry
            if (attempt < opts.maxRetries) {
                const shouldRetry = opts.retryableErrors
                    ? opts.retryableErrors(error)
                    : defaultRetryableErrors(error);

                if (shouldRetry) {
                    logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`, {
                        error: (error as Error)?.message || error,
                    });

                    await sleep(delay);
                    delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
                } else {
                    // Non-retryable error
                    throw error;
                }
            }
        }
    }

    throw lastError;
}

function defaultRetryableErrors(error: any): boolean {
    if (!error.response) return true;
    const status = error.response?.status;
    return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// jitter
export function calculateBackoffWithJitter(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number
): number {
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
}

// Circuit breaker pattern
export class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
        private threshold: number = 5,
        private timeout: number = 60000, // 1 minute
        private resetTimeout: number = 30000 // 30 seconds
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'half-open';
                logger.info('Circuit breaker entering half-open state');
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private onSuccess(): void {
        this.failures = 0;
        if (this.state === 'half-open') {
            this.state = 'closed';
            logger.info('Circuit breaker closed');
        }
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.threshold) {
            this.state = 'open';
            logger.warn('Circuit breaker opened');
        }
    }

    getState(): string {
        return this.state;
    }
}

// Rate limiter for external API calls
export class RateLimiter {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private maxTokens: number,
        private refillRate: number, // tokens per second
        private initialTokens?: number
    ) {
        this.tokens = initialTokens ?? maxTokens;
        this.lastRefill = Date.now();
    }

    async acquire(tokens: number = 1): Promise<void> {
        this.refill();

        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return;
        }

        const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
        await sleep(waitTime);
        this.refill();
        this.tokens -= tokens;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const newTokens = elapsed * this.refillRate;

        this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
        this.lastRefill = now;
    }

    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }
}
