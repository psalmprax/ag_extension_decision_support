export class AdvisoryTimeoutError extends Error {
    constructor(stage: string) {
        super(`${stage} timed out`);
        this.name = 'AdvisoryTimeoutError';
    }
}

/** Bounds caller latency; providers retain their own transport-level timeouts. */
export async function withAdvisoryTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    stage: string
): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new AdvisoryTimeoutError(stage);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new AdvisoryTimeoutError(stage)), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}
