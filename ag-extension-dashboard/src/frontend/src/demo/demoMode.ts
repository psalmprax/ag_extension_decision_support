/**
 * Centralized demo-mode service.
 *
 * This is the single entry point for demo mode: it owns the mode state
 * transitions (enter/exit), exposes the demo datasets, and re-exports the
 * demo-id guards used across the app. UI code should read demo data and the
 * demo guard from here (`@/demo`) instead of scattering `isDemo` checks and
 * `DEMO_*` imports.
 *
 * The `isDemo` boolean itself lives in the zustand store (so it persists and
 * stays reactive); everything else about demo mode lives here.
 */
import { useAppStore, type User } from '@/store/useAppStore';
import {
  DEMO_FARMERS,
  DEMO_VISITS,
  DEMO_REPORTS,
  buildDemoFields,
  buildDemoDashboardData,
  buildDemoPerformanceData,
  buildCropDistribution,
  buildRegionBreakdown,
  type DemoFarmerExtended,
} from './demoData';
import { isDemoId, isDemoFarmerId, containsDemoId } from './demoIds';

export type { DemoFarmerExtended };

/** Non-reactive demo-mode check — safe to call from non-React code. */

/** Enter demo mode: set the demo user + flip the mode flag. */
export function enterDemoMode(user: User): void {
  const store = useAppStore.getState();
  store.setUser(user);
  store.setIsDemo(true);
  localStorage.setItem('user', JSON.stringify(user));
}

/** Exit demo mode (e.g. after a real login). */
export function exitDemoMode(): void {
  useAppStore.getState().setIsDemo(false);
}

// --- Dataset accessors -------------------------------------------------------





// --- Re-exports --------------------------------------------------------------

export {
  DEMO_FARMERS,
  DEMO_VISITS,
  DEMO_REPORTS,
  buildDemoFields,
  buildDemoDashboardData,
  buildDemoPerformanceData,
  buildCropDistribution,
  buildRegionBreakdown,
  isDemoId,
  isDemoFarmerId,
  containsDemoId,
};
