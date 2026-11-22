/**
 * Officer replies record who wrote them, and every reply, whichever way it was written,
 * gets the same follow-through: live update, channel delivery and the pilot follow-up.
 */
const mockQuery = jest.fn();
const mockDeliver = jest.fn();
const mockFollowUp = jest.fn();
const mockEmit = jest.fn();
jest.mock('@/services/databaseService', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/services/chat/channelThread', () => ({ deliverToFarmerChannel: (...args: unknown[]) => mockDeliver(...args) }));
jest.mock('@/services/pilots/followups', () => ({ queueAdviceFollowUp: (...args: unknown[]) => mockFollowUp(...args) }));
jest.mock('@/services/realtimeHub', () => ({ getRealtimeServer: () => ({ to: () => ({ emit: mockEmit }) }) }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { isMessageAuthor, postOfficerReply, senderMetadata } from '@/services/chat/threadPost';
import type { ChatMessageRow } from '@/types/rowTypes';

const message = (role: string, metadata: Record<string, unknown> | null) => ({ id: 'm1', role, metadata } as unknown as ChatMessageRow);
const officerA = { userId: 'officer-a', role: 'extension_officer' };
const managerB = { userId: 'manager-b', role: 'regional_manager' };

describe('isMessageAuthor', () => {
  it('lets only the recorded sender, or an administrator, change a message', () => {
    const reply = message('officer', { senderId: 'officer-a' });
    expect(isMessageAuthor(reply, officerA)).toBe(true);
    expect(isMessageAuthor(reply, managerB)).toBe(false);
    expect(isMessageAuthor(reply, { userId: 'admin-1', role: 'admin' })).toBe(true);
  });

  it('falls back to the side of the thread for messages from before senders were recorded', () => {
    expect(isMessageAuthor(message('officer', null), managerB)).toBe(true);
    expect(isMessageAuthor(message('user', null), managerB)).toBe(false);
    expect(isMessageAuthor(message('user', null), { userId: 'farmer-1', role: 'farmer' })).toBe(true);
  });
});

describe('postOfficerReply', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockDeliver.mockReset().mockResolvedValue(undefined);
    mockFollowUp.mockReset().mockResolvedValue(true);
  });

  it('records the sender and queues delivery and the pilot follow-up', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'm9', conversation_id: 'c1', role: 'officer', content: 'Spray in the evening.', metadata: { senderId: 'officer-a' } }] })
      .mockResolvedValueOnce({ rows: [] });
    await postOfficerReply('c1', 'Spray in the evening.', 'officer-a');
    expect(mockQuery.mock.calls[0][1]).toEqual(['c1', 'Spray in the evening.', senderMetadata('officer-a')]);
    await new Promise(resolve => setImmediate(resolve));
    expect(mockDeliver).toHaveBeenCalledWith('c1', 'm9', 'Spray in the evening.', { askAiButton: true });
    expect(mockFollowUp).toHaveBeenCalledWith('c1', 'm9');
    expect(mockEmit).toHaveBeenCalledWith('new_message', expect.objectContaining({ id: 'm9' }));
  });
});
