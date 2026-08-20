/**
 * Triggers subtle physical vibration haptics on mobile devices supporting the Vibration API.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 50, 20]);
        break;
      case 'warning':
        navigator.vibrate([30, 40, 30]);
        break;
      case 'error':
        navigator.vibrate([50, 60, 50, 60]);
        break;
    }
  } catch {
    // Ignore unsupported browser environments
  }
}
