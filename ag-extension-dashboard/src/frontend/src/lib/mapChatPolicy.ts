/**
 * Map-popup tap policy for farmer markers.
 *
 * Officers/admins get a chat conversation (and land on the chat tab);
 * every other role gets the farmer detail view. Unknown records resolve to
 * 'missing' so callers can show feedback instead of failing silently.
 * Pure logic — kept separate for unit testing.
 */

export type MapFarmerAction = 'chat' | 'detail' | 'missing';

export function isMapChatAllowed(role?: string | null): boolean {
  return role === 'extension_officer' || role === 'admin';
}

export function resolveMapFarmerAction(canChat: boolean, farmerFound: boolean): MapFarmerAction {
  if (!farmerFound) return 'missing';
  return canChat ? 'chat' : 'detail';
}
