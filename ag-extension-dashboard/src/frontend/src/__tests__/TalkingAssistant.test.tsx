import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TalkingAssistant } from '../pages/landing/sections/TalkingAssistant';
import apiClient from '@/api/client';

vi.mock('@/api/client', () => ({
  default: { post: vi.fn() },
}));

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

describe('TalkingAssistant Component', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    sessionStorage.clear();

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  });

  it('renders assistant welcome message and sample question chips', () => {
    render(<TalkingAssistant />);

    expect(screen.getByText(/AI Agronomic Extension Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Fall Armyworm bio-control/i)).toBeInTheDocument();
    expect(screen.getByText(/Acidic Soil Remediation/i)).toBeInTheDocument();
  });

  it('performs multi-turn slot tracking and anaphora dosage resolution', async () => {
    render(<TalkingAssistant />);

    const armywormPrompt = screen.getByText(/Fall Armyworm bio-control/i);
    fireEvent.click(armywormPrompt);

    await waitFor(() => {
      expect(screen.getByText(/scout leaf whorls at dawn or dusk/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Active Context:/i)).toBeInTheDocument();
      expect(screen.getByText(/🌱 Maize/i)).toBeInTheDocument();
      expect(screen.getByText(/🐛 Fall Armyworm/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask about crop diagnosis/i);
    fireEvent.change(input, { target: { value: 'What dosage should I use for 3 acres?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText(
          /For 3 acres of maize, mix 1.2 liters of Neem oil \(at 3ml\/L water rate across 400L total spray volume\) applied directly into the central leaf whorls\./i
        )
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/📐 3 acres/i)).toBeInTheDocument();
  });

  it('resolves lime dosage recommendation correctly even when maize context is active', async () => {
    render(<TalkingAssistant />);

    // Turn 1: Establish maize context
    const armywormPrompt = screen.getByText(/Fall Armyworm bio-control/i);
    fireEvent.click(armywormPrompt);

    await waitFor(() => {
      expect(screen.getByText(/🌱 Maize/i)).toBeInTheDocument();
    });

    // Turn 2: Query lime for acidic soil
    const input = screen.getByPlaceholderText(/Ask about crop diagnosis/i);
    fireEvent.change(input, { target: { value: 'How much lime should I apply for acidic soil?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText(/agricultural calcitic or dolomitic lime/i)
      ).toBeInTheDocument();
    });
  });

  it('dispatches to public demo API when query is outside preset local rules', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          text: 'Intercropping maize with Desmodium repels stem borers and suppresses Striga weed.',
          source: 'GP-Ext RAG Knowledge Base v2',
          citations: [
            {
              sourceId: 'icipe-push-pull',
              title: 'ICIPE Push-Pull Technology Guide',
              category: 'IPM',
              excerpt: 'Desmodium intortum produces volatile chemicals...',
              score: 0.94,
            },
          ],
        },
      },
    });

    render(<TalkingAssistant />);

    const input = screen.getByPlaceholderText(/Ask about crop diagnosis/i);
    fireEvent.change(input, { target: { value: 'Can I use push-pull intercropping with desmodium?' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/chatbot/public-demo',
        expect.objectContaining({
          query: 'Can I use push-pull intercropping with desmodium?',
          language: 'en',
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Intercropping maize with Desmodium repels stem borers/i)
      ).toBeInTheDocument();
    });
  });

  it('handles 429 rate limit response gracefully with informative message', async () => {
    mockedPost.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Demo rate limit exceeded' },
      },
    });

    render(<TalkingAssistant />);

    const input = screen.getByPlaceholderText(/Ask about crop diagnosis/i);
    fireEvent.change(input, { target: { value: 'Novel question exceeding rate limit' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText(/Demo rate limit reached \(10 queries\/hour\)/i)
      ).toBeInTheDocument();
    });
  });

  it('allows clearing active context using the reset button', async () => {
    render(<TalkingAssistant />);

    const armywormPrompt = screen.getByText(/Fall Armyworm bio-control/i);
    fireEvent.click(armywormPrompt);

    await waitFor(() => {
      expect(screen.getByText(/Active Context:/i)).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.queryByText(/Active Context:/i)).not.toBeInTheDocument();
    });
  });
});
