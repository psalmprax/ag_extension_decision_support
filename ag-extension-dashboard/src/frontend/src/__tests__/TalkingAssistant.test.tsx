import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TalkingAssistant } from '../pages/landing/sections/TalkingAssistant';
import apiClient from '@/api/client';

vi.mock('@/api/client', () => ({
  default: { post: vi.fn() },
}));

const mockedPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;

let mockSpeak: ReturnType<typeof vi.fn>;
let mockCancel: ReturnType<typeof vi.fn>;
let mockPlay: ReturnType<typeof vi.fn>;

describe('TalkingAssistant Component', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    sessionStorage.clear();

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockPlay = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: vi.fn().mockReturnValue([
          { name: 'Google US English (Natural)', lang: 'en-US' },
          { name: 'Google Swahili', lang: 'sw-KE' },
          { name: 'Microsoft Jenny Online (Natural)', lang: 'en-US' },
          { name: 'Microsoft Guy Online (Natural)', lang: 'en-US' },
        ]),
        onvoiceschanged: null,
      },
      writable: true,
      configurable: true,
    });

    class MockSpeechSynthesisUtterance {
      text: string;
      lang = 'en-US';
      rate = 1.0;
      pitch = 1.0;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: MockSpeechSynthesisUtterance,
      writable: true,
      configurable: true,
    });

    class MockAudio {
      src = '';
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = mockPlay;
      pause = vi.fn();
      currentTime = 0;
      constructor(src?: string) {
        if (src) this.src = src;
      }
    }

    Object.defineProperty(window, 'Audio', {
      value: MockAudio,
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

  it('falls back to MediaRecorder and server-side STT when native SpeechRecognition is unavailable', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    const mockAnalyser = {
      fftSize: 64,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 32,
      getByteFrequencyData: vi.fn(),
    };

    const mockSource = {
      connect: vi.fn(),
    };

    class MockAudioContext {
      state = 'running';
      createMediaStreamSource = vi.fn().mockReturnValue(mockSource);
      createAnalyser = vi.fn().mockReturnValue(mockAnalyser);
      close = vi.fn().mockResolvedValue(undefined);
      resume = vi.fn().mockResolvedValue(undefined);
    }

    Object.defineProperty(window, 'AudioContext', {
      value: MockAudioContext,
      writable: true,
      configurable: true,
    });

    class MockMediaRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['mock-audio'], { type: 'audio/webm' }) });
        }
        if (this.onstop) {
          this.onstop();
        }
      }

      static isTypeSupported() {
        return true;
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      value: MockMediaRecorder,
      writable: true,
      configurable: true,
    });

    mockedPost.mockImplementation(async (url: string) => {
      if (url === '/chatbot/public-demo/stt') {
        return {
          data: {
            success: true,
            data: { text: 'What is the bio-control for Fall Armyworm?' },
          },
        };
      }
      return {
        data: {
          success: true,
          data: {
            text: 'Apply cold-pressed Neem oil at 3ml/L.',
            source: 'FAO Fall Armyworm Guide',
          },
        },
      };
    });

    render(<TalkingAssistant />);

    const orb = screen.getByLabelText(/Start speaking voice inquiry/i);
    fireEvent.click(orb);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    const stopOrbs = screen.getAllByLabelText(/Stop recording voice/i);
    fireEvent.click(stopOrbs[0]!);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/chatbot/public-demo/stt',
        expect.objectContaining({ language: 'en' })
      );
    });
  });

  it('renders voice persona selector with HD Neural badge and allows persona switching', async () => {
    render(<TalkingAssistant />);

    expect(screen.getByText(/Voice Persona/i)).toBeInTheDocument();
    expect(screen.getByText(/HD Neural/i)).toBeInTheDocument();

    const amaniBtn = screen.getByRole('button', { name: /Amani/i });
    const barakaBtn = screen.getByRole('button', { name: /Baraka/i });
    const zawadiBtn = screen.getByRole('button', { name: /Zawadi/i });

    expect(amaniBtn).toHaveAttribute('aria-pressed', 'true');
    expect(barakaBtn).toHaveAttribute('aria-pressed', 'false');
    expect(zawadiBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(barakaBtn);

    await waitFor(() => {
      expect(barakaBtn).toHaveAttribute('aria-pressed', 'true');
      expect(amaniBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('synthesizes humanized speech with expanded units and calibrated prosody on fallback', async () => {
    mockedPost.mockRejectedValue(new Error('Server neural TTS unavailable'));

    render(<TalkingAssistant />);

    const promptBtn = screen.getByText(/Fall Armyworm bio-control/i);
    fireEvent.click(promptBtn);

    await waitFor(() => {
      expect(screen.getByText(/scout leaf whorls at dawn or dusk/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockSpeak).toHaveBeenCalled();
    });

    const speakCalls = mockSpeak.mock.calls;
    const spokenUtterance = speakCalls[speakCalls.length - 1][0];
    expect(spokenUtterance.text).toContain('milliliters per liter');
    expect(spokenUtterance.rate).toBeCloseTo(0.94);
    expect(spokenUtterance.pitch).toBeCloseTo(1.04);
  });

  it('streams server-side studio neural audio when public demo TTS succeeds', async () => {
    mockedPost.mockImplementation(async (url: string) => {
      if (url === '/chatbot/public-demo/tts') {
        return {
          data: {
            success: true,
            data: {
              audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
              format: 'mp3',
              voice: 'nova',
            },
          },
        };
      }
      return { data: { success: true, data: {} } };
    });

    render(<TalkingAssistant />);

    const promptBtn = screen.getByText(/Fall Armyworm bio-control/i);
    fireEvent.click(promptBtn);

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledWith(
        '/chatbot/public-demo/tts',
        expect.objectContaining({
          voice: 'nova',
          language: 'en',
        }),
        expect.any(Object)
      );
    });

    await waitFor(() => {
      expect(mockPlay).toHaveBeenCalled();
    });
  });
});
