import { describe, it, expect } from 'vitest';
import { isMapChatAllowed, isMapCallAllowed, resolveMapFarmerAction } from '@/lib/mapChatPolicy';

describe('isMapChatAllowed', () => {
  it.each(['extension_officer', 'admin', 'superadmin'])('grants map chat to %s', role => {
    expect(isMapChatAllowed(role)).toBe(true);
  });

  it.each([['farmer'], ['regional_manager'], [undefined], [null], ['']])(
    'denies map chat to %s',
    role => {
      expect(isMapChatAllowed(role)).toBe(false);
    }
  );

  it('handles demo mode correctly', () => {
    expect(isMapChatAllowed('admin', true)).toBe(true);
    expect(isMapChatAllowed('extension_officer', true)).toBe(true);
    expect(isMapChatAllowed(undefined, true)).toBe(true);
    // Demo farmer role is denied to simulate farmer restriction
    expect(isMapChatAllowed('farmer', true)).toBe(false);
  });
});

describe('isMapCallAllowed', () => {
  it.each(['extension_officer', 'admin', 'superadmin', 'regional_manager'])('grants map call to %s', role => {
    expect(isMapCallAllowed(role)).toBe(true);
  });

  it.each([['farmer'], [undefined], [null], ['']])('denies map call to %s', role => {
    expect(isMapCallAllowed(role)).toBe(false);
  });

  it('handles demo mode correctly', () => {
    expect(isMapCallAllowed('admin', true)).toBe(true);
    expect(isMapCallAllowed(undefined, true)).toBe(true);
    expect(isMapCallAllowed('farmer', true)).toBe(false);
  });
});

describe('resolveMapFarmerAction', () => {
  it('returns missing when the record is not found, regardless of role', () => {
    expect(resolveMapFarmerAction(true, false)).toBe('missing');
    expect(resolveMapFarmerAction(false, false)).toBe('missing');
  });

  it('returns chat for chat-allowed roles with a matched record', () => {
    expect(resolveMapFarmerAction(true, true)).toBe('chat');
  });

  it('returns detail for other roles so the tap still does something visible', () => {
    expect(resolveMapFarmerAction(false, true)).toBe('detail');
  });
});
