import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const TAB_TO_PATH: Record<string, string> = {
  dashboard: '/dashboard',
  portfolio: '/portfolio',
  register_farmer: '/register-farmer',
  visits: '/visits',
  reports: '/reports',
  analytics: '/analytics',
  billing: '/billing',
  knowledge: '/knowledge',
  aiassistant: '/ai-assistant',
  farmerchat: '/farmer-chat',
  officerchat: '/my-officer',
  worldmonitor: '/world-monitor',
  sms: '/sms',
  telemetry: '/telemetry',
  agents: '/agents',
  system_health: '/system-health',
  disease_diagnosis: '/disease-diagnosis',
  fields: '/fields',
  memory: '/memory',
  email_workflows: '/email-workflows',
  mcp_tools: '/mcp-tools',
  user_management: '/user-management',
  advisory_studio: '/advisory-studio',
};

export const PATH_TO_TAB: Record<string, string> = {
  ...Object.fromEntries(Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab])),
  '/diagnosis': 'disease_diagnosis',
};

/** Paths that belong to the public site or sign-in, where a signed-in person may still land. */
export const SIGNED_OUT_PATHS = /^\/(?:$|login|register|signin|signup|forgot-password|reset-password|verify-email|demo(?:\/|$))/;

interface TabUrlSyncOptions {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  signedIn: boolean;
  /** Tells the person an address matched no screen; receives the address. */
  onUnknownPath: (path: string) => void;
}

/**
 * Keeps the active tab and the URL in step, one direction per render.
 *
 * Two independent effects used to fight each other on deep links: a reload on
 * /fields with a persisted active tab of 'dashboard' flipped both values for
 * ever, each effect re-triggering the other. Tracking the previous values makes
 * the side that changed the source of truth, so one pass settles it.
 */
export function useTabUrlSync({ activeTab, setActiveTab, signedIn, onUnknownPath }: TabUrlSyncOptions) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const prevTabRef = useRef(activeTab);
  const onUnknownPathRef = useRef(onUnknownPath);
  onUnknownPathRef.current = onUnknownPath;

  useEffect(() => {
    const pathChanged = prevPathRef.current === null || prevPathRef.current !== pathname;
    const tabChanged = prevTabRef.current !== activeTab;
    prevPathRef.current = pathname;
    prevTabRef.current = activeTab;

    if (!signedIn) return;

    if (pathChanged && !tabChanged) {
      // Deep link or direct navigation: the URL is the source of truth.
      const tab = PATH_TO_TAB[pathname];
      if (tab && tab !== activeTab) setActiveTab(tab);
      // An address no screen answers used to keep showing the previous screen under it.
      if (!tab && !SIGNED_OUT_PATHS.test(pathname)) {
        onUnknownPathRef.current(pathname);
        navigate(TAB_TO_PATH[activeTab] ?? '/dashboard', { replace: true });
      }
    } else if (tabChanged && !pathChanged) {
      // Tab click: mirror the active tab in the URL.
      const targetPath = TAB_TO_PATH[activeTab];
      if (targetPath && pathname !== targetPath) navigate(targetPath);
    }
  }, [pathname, activeTab, signedIn, navigate, setActiveTab]);
}
