# Floating Landing Assistant Implementation Plan

## Scope

Replace the inline landing-page assistant with a lower-right launcher and an
on-demand floating conversation panel. Preserve existing assistant API calls,
conversation state, citations, language selection, voice personas, and speech
controls. Do not change other landing-page sections, global styles, dependencies,
backend code, or deployment configuration.

## Files

- `src/pages/LandingPage.tsx`: remove the inline assistant placement and existing
  scroll-only shortcut; mount the floating assistant outside the main content.
- `src/pages/landing/sections/TalkingAssistant.tsx`: connect the existing open
  state to a collapsed launcher and responsive panel. Default to closed. Keep
  messages central and voice settings compact. Extract an assistant-only shell
  beside this file if needed to keep new presentation code below 300 lines.
- `src/__tests__/TalkingAssistant.test.tsx`: extend the existing suite for
  launcher, close, focus restoration, preserved messages, and hash navigation;
  explicitly open the assistant in existing conversation tests where needed.

## Interaction And Layout

- Desktop: approximately 420px-wide panel above a lower-right launcher, with
  viewport-constrained height and an independently scrolling message thread.
- Mobile: nearly full-screen sheet with safe-area spacing and constrained height.
- Match the landing page's existing visual language without global style changes.
- Provide named icon controls, input focus on open, Escape dismissal, focus
  restoration, and reduced-motion-aware transitions.
- Keep microphone activation explicit. Stop active speech/recording when closed
  without clearing the conversation or submitting a partial recording.
- Preserve `#talking-assistant` links by opening the panel when requested.

## Hypothesis And Verification

The existing `isOpen` state is not used by the rendered section. Using it to
control an assistant-only shell should make the assistant available throughout
the page without changing advisory behavior.

1. Run the existing assistant tests after the first substantive code edit.
2. Run updated assistant interaction tests and the landing-page readiness test.
3. Run frontend typecheck and lint for touched TypeScript files.
4. Check desktop/mobile browser rendering, keyboard dismissal, panel bounds,
   scrolling, and conversation persistence when reopened.
5. Review the diff for scope and report any unavailable or failing checks.

## Risks And Open Questions

- Repositioning must not scroll the landing page when messages arrive.
- Closing must not leave the microphone or audio playback active.
- Controls and the composer must remain usable on narrow or short viewports.
- No product-design questions remain; implementation awaits approval of this
  written plan as required by the repository engineering lifecycle.