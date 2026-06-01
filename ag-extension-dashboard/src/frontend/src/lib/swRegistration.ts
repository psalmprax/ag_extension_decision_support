import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker for PWA capabilities.
 * Errors are handled gracefully via the onRegisterError callback
 * so the app continues to work without PWA features.
 *
 * Returns the update function that can be called to check for SW updates.
 */
export const registerServiceWorker = () => {
    return registerSW({
        immediate: true,
        onRegisterError() {
            // Service worker registration errors are non-critical
        },
        onRegistered() {
            // Service worker registered successfully
        },
    });
};
