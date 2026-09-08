import { describe, it, expect } from 'vitest';
import { formatChatTime } from '@/lib/chatTime';

describe('formatChatTime', () => {
  it('prefers timestamp when present', () => {
    const label = formatChatTime({
      timestamp: '2026-09-08T10:15:00.000Z',
      createdAt: '2026-09-08T11:45:00.000Z',
    });
    expect(label).not.toBe('');
    expect(label).not.toContain('Invalid');
  });

  it('falls back to the backend createdAt field', () => {
    // Regression: ChatMessageDTO carries createdAt, not timestamp — every
    // message rendered "Invalid Date" before the fallback existed.
    const label = formatChatTime({ createdAt: '2026-09-08T10:15:00.000Z' });
    expect(label).not.toBe('');
    expect(label).not.toContain('Invalid');
  });

  it('returns empty string instead of "Invalid Date" for missing values', () => {
    expect(formatChatTime({})).toBe('');
    expect(formatChatTime({ createdAt: null })).toBe('');
  });

  it('returns empty string for unparseable values', () => {
    expect(formatChatTime({ timestamp: 'not-a-date' })).toBe('');
  });
});
