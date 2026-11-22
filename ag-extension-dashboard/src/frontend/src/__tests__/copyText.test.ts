import { afterEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';
import { copyText, copyWithToast } from '@/lib/copyText';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe('copyText', () => {
  it('says copied only when the browser copied', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await expect(copyWithToast('https://app.example/tele-call/room-1', 'Invite link copied.')).resolves.toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Invite link copied.');
  });

  it('falls back to the selection copy, and reports a refusal instead of claiming success', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')) } });
    const execCommand = vi.fn().mockReturnValue(false);
    Object.assign(document, { execCommand });
    await expect(copyWithToast('secret-free text', 'Copied.')).resolves.toBe(false);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('uses the fallback when the Clipboard API is missing', async () => {
    Object.assign(navigator, { clipboard: undefined });
    Object.assign(document, { execCommand: vi.fn().mockReturnValue(true) });
    await expect(copyText('Planting guide')).resolves.toBe(true);
  });
});
