import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/api/client';
import { generateSynthesis } from '@/api/chatbotService';

vi.mock('@/api/client', () => ({
  default: { post: vi.fn() },
}));

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedPost.mockReset();
});

describe('generateSynthesis', () => {
  it('posts farmer notes to the visit-synthesis pipeline (not a chatbot route)', async () => {
    mockedPost.mockResolvedValueOnce({ data: { success: true, data: {} } });
    await generateSynthesis({
      farmerId: 'f-1',
      notes: 'Farmer: Ama. Region: Ashanti. Crops: maize.',
    });
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost.mock.calls[0][0]).toBe('/ai/synthesize-visit');
    expect(mockedPost.mock.calls[0][1]).toMatchObject({
      farmerId: 'f-1',
      notes: expect.stringContaining('Ama'),
    });
  });
});
