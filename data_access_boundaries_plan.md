# Demo Data Separation & Data Access Boundaries — Implementation Plan

## Current Architecture

**Well-working:**
- Backend `farmers.ts` already scopes by role: `extension_officer` → `assignedOfficerId`, `farmer` → `userId`
- Backend `visits.ts` already scopes by role via `buildVisitScope()`
- Backend `analytics.ts` already scopes via `buildScopeFilter()`
- `isDemo` flag is cleanly managed: `enterDemoMode()` / `exitDemoMode()` on login/logout

**Gaps to fix:**
1. `resolveEffectiveFarmers()` can surface store-stale data or wrong farmers when `isDemo` is false
2. `FarmerMap.tsx` renders ALL farmers from store regardless of user role
3. No "my officer" endpoint — a farmer can't see their assigned extension officer
4. `exitDemoMode()` and `setIsDemo(false)` don't clear the stale store data
5. Portfolio/Agents/SMS pages show data that may include demo or cross-role records

## Fixes

### 1. Clear store on demo↔real transition

**Files:** `src/frontend/src/store/useAppStore.ts`, `src/frontend/src/demo/demoMode.ts`

- `exitDemoMode()` must clear the farmers/visits/reports arrays from the store so no demo data persists
- The `setIsDemo` action must also clear farmers when transitioning out of demo

### 2. Fix `resolveEffectiveFarmers` to never leak demo data

**Files:** `src/frontend/src/hooks/useAppQueries.ts`

- When `isDemo` is false, never fall back to `DEMO_FARMERS`
- When `isDemo` is false, don't use store farmers as fallback — show empty state
- Only in demo mode should `DEMO_FARMERS` be used

### 3. Add my-officer endpoint for farmers

**Files:** `ag-extension-dashboard/src/backend/src/routes/farmers.ts`

- `GET /api/farmers/my-officer` — returns the assigned extension officer's name, phone, email
- Scoped to farmer role only

### 4. Scope FarmerMap to user's access level

**Files:** `src/frontend/src/components/FarmerMap.tsx`

- Extension officers: filter markers to only show `assignedOfficerId === userId` farmers
- Farmers: show only their own marker and their officer's location
- Admins: show all

### 5. Add role-scoping guard in frontend data hooks

**Files:** `src/frontend/src/hooks/useAppQueries.ts`

- Store the user's role alongside farmers data
- When role is `farmer`, filter effective farmers to only include the user's own farmer record (by matching `userId`)

### 6. Add explicit tenant + role gates in store

**Files:** `src/frontend/src/store/useAppStore.ts`

- Add `userRole` and `userTenantId` getters
- Use them for data filtering in components that render farmer lists

## Verification

After implementation:
- Demo login → farmer list shows DEMO_FARMERS (12 farmers)
- Real login as farmer → farmer list shows only that farmer's own record
- Real login as extension officer → farmer list shows only assigned farmers
- Logout from demo → store clears → login as real → no demo data visible
- `npm run build`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --runInBand` (backend)
- `npm run lint`, `npm run typecheck`, `npm test` (frontend)