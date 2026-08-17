# Accessibility and Release Gates

The dashboard and browser extension use an accessibility baseline aimed at keyboard and low-bandwidth field use.

## Automated gates

- Frontend Vitest checks page landmarks, accessible form names, and icon-only button labels.
- Playwright release smoke tests cover the public landing page and login keyboard flow.
- The extension CI job runs TypeScript validation and a production WXT build.
- Frontend production builds retain route/vendor chunk budgets through Vite's configured `chunkSizeWarningLimit`.

Run the checks locally:

```bash
cd ag-extension-dashboard/src/frontend
npm run lint
npm run typecheck
npm run test -- --run
npm run test:e2e -- --grep @release
npm run build

cd ../../../ag-extension-browser-ext
npm run typecheck
npm run build
```

## Component requirements

- Every form control has a visible label, an `aria-label`, or an explicit labelled-by relationship.
- Icon-only controls expose an accessible name.
- Status and error messages use live-region semantics where the state changes asynchronously.
- Keyboard focus must remain visible and must not be trapped outside an intentional modal.
- Decorative imagery uses empty alternative text; informative imagery describes its purpose.

## Manual review before release

Automated checks do not replace a keyboard and screen-reader pass. Before release, verify login, farmer selection, visit logging, diagnosis tabs, report viewing, and extension sidepanel flows with keyboard-only navigation and a screen reader. Confirm reduced-motion behavior and at least one narrow/mobile viewport.

The extension build requires a complete WXT installation. A missing registry connection or partial `node_modules` tree is an environment failure and must not be treated as a successful release gate.
