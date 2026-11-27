import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

/**
 * The keyboard behaviour a menu (role="menu") promises: opening it moves focus to the
 * first item, the arrow keys (and Home and End) move between items, and Escape closes
 * it and puts focus back on the button that opened it. Tab closes it too, and focus
 * also goes back to the button: the menu stays mounted while it animates away, so
 * letting Tab move on could land focus on one of its leaving items.
 */
export function useMenuKeyboard(open: boolean, close: () => void, triggerRef: RefObject<HTMLElement>) {
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const moveTo = (next: number) => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    const leave = () => {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return moveTo(index + 1);
      case 'ArrowUp':
        return moveTo(index - 1);
      case 'Home':
        return moveTo(0);
      case 'End':
        return moveTo(list.length - 1);
      case 'Escape':
        // Handled here, not by the app-wide Escape, so focus can go back to the button.
        event.stopPropagation();
        return leave();
      case 'Tab':
        return leave();
      default:
        return undefined;
    }
  };

  return { menuRef, onKeyDown };
}
