/**
 * Map-popup tap policy for farmer markers (Chat & Call actions).
 *
 * Officers/admins/demo users get chat conversation capabilities;
 * other roles get the farmer detail view. Call permissions are granted
 * to officers, managers, and admins, as well as demo users.
 * Pure logic — kept separate for unit testing.
 */

export type MapFarmerAction = 'chat' | 'detail' | 'missing';

export function isMapChatAllowed(role?: string | null, isDemo: boolean = false): boolean {
  if (isDemo && role !== 'farmer') return true;
  return role === 'extension_officer' || role === 'admin' || role === 'superadmin';
}

export function isMapCallAllowed(role?: string | null, isDemo: boolean = false): boolean {
  if (isDemo && role !== 'farmer') return true;
  return (
    role === 'extension_officer' ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'regional_manager'
  );
}

export function resolveMapFarmerAction(canChat: boolean, farmerFound: boolean): MapFarmerAction {
  if (!farmerFound) return 'missing';
  return canChat ? 'chat' : 'detail';
}
