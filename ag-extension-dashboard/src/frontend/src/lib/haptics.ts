/**
 * Triggers subtle physical vibration haptics on mobile devices supporting the Vibration API.
 * Ensures calls only occur after explicit user gesture activation to prevent browser intervention warnings.
 */

let hasUserGesture = false;

if (typeof window !== 'undefined') {
  const markGesture = () => {
    hasUserGesture = true;
    window.removeEventListener('pointerdown', markGesture, true);
    window.removeEventListener('touchstart', markGesture, true);
    window.removeEventListener('keydown', markGesture, true);
    window.removeEventListener('click', markGesture, true);
  };

  window.addEventListener('pointerdown', markGesture, { capture: true, once: true });
  window.addEventListener('touchstart', markGesture, { capture: true, once: true });
  window.addEventListener('keydown', markGesture, { capture: true, once: true });
  window.addEventListener('click', markGesture, { capture: true, once: true });
}

export function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'
): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  // Modern browsers require user activation (tap/click/keypress) before allowing navigator.vibrate()
  const isActivated =
    typeof navigator.userActivation !== 'undefined'
      ? navigator.userActivation.hasBeenActive
      : hasUserGesture;

  if (!isActivated) return;

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
    // Ignore unsupported or restricted browser environments
  }
}
