import { describe, it, expect } from 'vitest';
import { isMapChatAllowed, resolveMapFarmerAction } from '@/lib/mapChatPolicy';

describe('isMapChatAllowed', () => {
  it.each(['extension_officer', 'admin'])('grants map chat to %s', role => {
    expect(isMapChatAllowed(role)).toBe(true);
  });

  it.each([['farmer'], ['regional_manager'], [undefined], [null], ['']])(
    'denies map chat to %s',
    role => {
      expect(isMapChatAllowed(role)).toBe(false);
    }
  );
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
