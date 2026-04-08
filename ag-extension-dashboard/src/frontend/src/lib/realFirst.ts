/**
 * Utility to handle 'Real-First' data fetching.
 * Tries to fetch data from a real backend promise, but falls back to provided dummy data
 * if the promise fails (e.g., backend is offline, network error).
 */
export async function withRealFallback<T>(
    realPromise: Promise<{ success: boolean; data: T } | any>,
    fallbackData: T
): Promise<T> {
    try {
        const response = await realPromise;
        
        // Handle cases where the response follows { success: true, data: ... } pattern
        if (response && response.success && response.data !== undefined) {
            return response.data;
        }
        
        // Handle direct data return if the service doesn't use the success wrapper
        if (response !== undefined && !response.hasOwnProperty('success')) {
            return response;
        }

        // If success is false but data is present (though unusual), or other cases
        if (response && response.data) {
            return response.data;
        }

        return fallbackData;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.warn('Real-First Fallback Activated:', error);
        }
        return fallbackData;
    }
}
