import type React from 'react';

/**
 * True for an Enter keypress that should act (submit, add a chip, run a search).
 *
 * While an IME is composing (Chinese, Japanese or Korean input), Enter confirms the
 * candidate the user picked; acting on it would submit half-typed text. Every Enter
 * handler should go through this check instead of testing `e.key` directly.
 */
export function isActionEnter(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing;
}
