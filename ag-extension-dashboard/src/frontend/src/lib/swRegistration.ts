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
    onRegisterError(err) {
      if (import.meta.env.DEV) {
        console.warn(
          '[SW] Service worker registration failed — continuing without PWA features:',
          err.message
        );
      }
    },
    onRegistered(registration) {
      if (registration && import.meta.env.DEV) {
        console.log('[SW] Service worker registered successfully');
      }
    },
  });
};
