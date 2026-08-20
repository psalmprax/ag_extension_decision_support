# Walkthrough: Frontend Type and Bundle Fixes

## Change

- Exported `CampaignStepTrace` from the frontend campaign API service.
- Imported it as a type in `GoalModeCampaignModal`, resolving the TS2304 build failure.
- Removed the stale `heroRef` and duplicate hero mouse handler from the pre-existing `LandingPage` global spotlight edit.
- Rendered the existing regional-skills loading state to eliminate the frontend lint warning.
- Converted closed modal and panel trees in `AppModals` to conditional lazy imports with a local `Suspense` boundary.
- Reduced the largest initial entry chunk from 855.64 kB to 469.81 kB, below the 650 kB warning threshold.
- Added `renderWithLanguage` and updated the aesthetic suites to await locale initialization inside `act`, eliminating the React test warnings.

## Verification

- `npm run typecheck` — passed.
- `npm test` — passed: 26 files, 123 tests.
- `npm run lint` — passed with no warnings.
- Affected aesthetic tests — passed: 18 tests with no React `act()` warnings.
- `npm run build` — passed, including locale audit and production Vite/PWA build.
- Locale audit — 0 missing keys, 0 extra keys, 0 interpolation mismatches, 0 protected-term losses.

The production build no longer reports the oversized-chunk warning. Existing React `act(...)` warnings remain in the test output but do not fail the suite.
