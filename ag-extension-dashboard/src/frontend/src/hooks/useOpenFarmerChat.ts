import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import { isMapChatAllowed, resolveMapFarmerAction } from '@/lib/mapChatPolicy';
import type { Farmer } from '@/types/dashboard';

interface OpenFarmerChatOptions {
  role: string | undefined;
  handleStartConversation: (farmer: Farmer, type: 'ai' | 'farmer') => Promise<boolean>;
  handleOpenFarmerDetail: (farmer: Farmer) => void;
}

/**
 * One path for every "chat with this farmer" control on the dashboard (map
 * popup, activity stream). A click always visibly does something: it opens the
 * farmer chat tab, falls back to the farmer detail view for roles that may not
 * chat, or explains why nothing could be opened.
 */
export function useOpenFarmerChat({ role, handleStartConversation, handleOpenFarmerDetail }: OpenFarmerChatOptions) {
  const setGlobalTab = useAppStore(s => s.setActiveTab);
  const addNotification = useAppStore(s => s.addNotification);
  const { isDemo } = useDemoMode();
  const canChat = isMapChatAllowed(role, isDemo);

  return useCallback(async (farmer: Farmer | undefined): Promise<void> => {
    const action = resolveMapFarmerAction(canChat, farmer !== undefined);
    if (action === 'missing' || farmer === undefined) {
      addNotification({ type: 'warning', message: 'Farmer record not found.' });
      return;
    }
    if (action === 'detail') {
      handleOpenFarmerDetail(farmer);
      return;
    }
    const started = await handleStartConversation(farmer, 'farmer');
    if (started) {
      setGlobalTab('farmerchat');
    } else {
      addNotification({ type: 'error', message: 'Could not start chat. Please try again.' });
    }
  }, [canChat, addNotification, handleOpenFarmerDetail, handleStartConversation, setGlobalTab]);
}
