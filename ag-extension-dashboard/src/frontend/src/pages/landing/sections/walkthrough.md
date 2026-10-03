# Floating Assistant Verification

The landing assistant now starts as a lower-right launcher rather than an
inline page section. Desktop uses a 420px conversation panel; mobile uses a
viewport-constrained sheet. Chat and voice modes retain the existing advisory,
language, persona, and playback functionality.

Opening focuses the composer. Escape and close restore launcher focus, preserve
messages, stop playback, and cancel recording without submitting partial audio.
Existing assistant hash links open the panel. Pending microphone permission and
transcription cannot restart recording or submit after dismissal.

## Passed Checks

- Assistant and page-readiness suites: 23 tests passed.
- Frontend `npm run typecheck`: passed.
- ESLint for touched TypeScript files: passed with zero warnings.
- Headless Playwright using installed Chromium: passed at 1440x900, 390x844,
  320x568, and 844x390. Panel and composer fit; chat and voice have no horizontal
  overflow. Composer icon controls have 44px touch targets.
- Browser checks confirmed animated panel visibility, reduced-motion rendering,
  Escape dismissal, focus restoration, conversation persistence, and unchanged
  page scroll when replies arrive. Desktop/mobile screenshots were inspected.

## Repository Gate Limitation

`scripts/agent-helper.sh test-all` stops at the backend suite because the `jest`
executable is unavailable. The helper therefore does not run the full frontend
suite. No backend dependencies or unrelated files were changed to address this.

Preview: http://127.0.0.1:5173/