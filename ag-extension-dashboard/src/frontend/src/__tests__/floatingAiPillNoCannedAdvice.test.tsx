import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FloatingAIPill } from '../components/FloatingAIPill';
import { getChatCompletion } from '@/api/aiService';

vi.mock('@/api/aiService', () => ({
  getChatCompletion: vi.fn(),
  analyzeImage: vi.fn(),
}));

const NO_ANSWER = /No answer came back for this question, so none is shown/;

async function ask(question: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /AI agronomist/i }));
  const input = await screen.findByPlaceholderText(/Ask agronomist/i);
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(input.closest('form') as HTMLFormElement);
}

describe('FloatingAIPill when the assistant gives no answer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getChatCompletion).mockReset();
  });

  it('says no answer came back instead of inventing crop advice when the request fails', async () => {
    vi.mocked(getChatCompletion).mockRejectedValue(new Error('provider down'));
    render(<FloatingAIPill />);
    await ask('When should I plant maize in Kenya?');

    expect(await screen.findByText(NO_ANSWER)).toBeInTheDocument();
    expect(screen.queryByText(/DAP|Mancozeb|Long Rains|Push-Pull/)).not.toBeInTheDocument();
  });

  it('treats an empty or error reply the same way', async () => {
    vi.mocked(getChatCompletion).mockResolvedValue({
      success: true,
      data: { messages: [{ role: 'assistant', content: 'Internal error while answering' }] },
    } as Awaited<ReturnType<typeof getChatCompletion>>);
    render(<FloatingAIPill />);
    await ask('Potato blight spray?');

    await waitFor(() => expect(screen.getByText(NO_ANSWER)).toBeInTheDocument());
    expect(screen.queryByText(/Internal error/)).not.toBeInTheDocument();
  });

  it('shows a real answer unchanged', async () => {
    vi.mocked(getChatCompletion).mockResolvedValue({
      success: true,
      data: { messages: [{ role: 'assistant', content: 'Ask your officer to confirm the variety first.' }] },
    } as Awaited<ReturnType<typeof getChatCompletion>>);
    render(<FloatingAIPill />);
    await ask('Which maize variety?');

    expect(await screen.findByText('Ask your officer to confirm the variety first.')).toBeInTheDocument();
    expect(screen.queryByText(NO_ANSWER)).not.toBeInTheDocument();
  });
});
