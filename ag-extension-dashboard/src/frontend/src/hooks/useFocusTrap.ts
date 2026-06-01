import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook that traps keyboard focus within a container element.
 * Used for modal dialogs to meet WCAG 2.1 SC 2.4.3 (Focus Order).
 */
export function useFocusTrap(isActive: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !containerRef.current) return;

        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, []);

    useEffect(() => {
        if (!isActive) return;

        // Save current focus to restore later
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Focus first focusable element in container
        requestAnimationFrame(() => {
            if (!containerRef.current) return;
            const first = containerRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            first?.focus();
        });

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus to trigger element
            previousFocusRef.current?.focus();
        };
    }, [isActive, handleKeyDown]);

    return containerRef;
}
