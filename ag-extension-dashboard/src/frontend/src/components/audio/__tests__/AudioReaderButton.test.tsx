import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AudioReaderButton } from '../AudioReaderButton';
import { cleanTextForSpeech, stopAllAudioPlayback } from '../audioHelpers';
import { useAppStore } from '@/store/useAppStore';
import * as aiService from '@/api/aiService';

describe('AudioReaderButton', () => {
  let mockSpeak: (utterance: unknown) => void;
  let mockCancel: () => void;

  beforeEach(() => {
    useAppStore.setState({
      preferredAudioLanguage: 'sw',
    });

    mockSpeak = vi.fn();
    mockCancel = vi.fn();

    // Mock window.speechSynthesis
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: () => [
          { lang: 'sw-KE', name: 'Swahili Kenya' },
          { lang: 'en-US', name: 'English US' },
        ],
      },
      writable: true,
      configurable: true,
    });

    // Mock SpeechSynthesisUtterance
    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: unknown = null;
      onend: ((ev: unknown) => void) | null = null;
      onerror: ((ev: unknown) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;
  });

  afterEach(() => {
    stopAllAudioPlayback();
    vi.restoreAllMocks();
  });

  it('cleans markdown markup and formatting for natural speech readout', () => {
    const rawMarkdown = '### Shamba Alert!\nUse **NPK 17-17-17** fertilizer. See [guidelines](https://example.com) & `irrigate` early.';
    const cleaned = cleanTextForSpeech(rawMarkdown);
    expect(cleaned).toBe('Shamba Alert! Use NPK 17-17-17 fertilizer. See guidelines & irrigate early.');
  });

  it('renders button with accessible title indicating language', () => {
    render(
      <AudioReaderButton
        text="Habari mkulima, zao la mahindi liko salama."
        language="sw"
      />
    );

    const button = screen.getByRole('button', { name: /Listen to this information aloud in Kiswahili/i });
    expect(button).toBeInTheDocument();
  });

  it('initiates SpeechSynthesis utterance when clicked', () => {
    render(
      <AudioReaderButton
        text="Ndio, mvua inatarajiwa kesho kutwa."
        language="sw"
      />
    );

    const button = screen.getByRole('button', { name: /Listen to this information aloud/i });
    fireEvent.click(button);

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    const calledUtterance = mockSpeak.mock.calls[0][0];
    expect(calledUtterance.text).toBe('Ndio, mvua inatarajiwa kesho kutwa.');
    expect(calledUtterance.lang).toBe('sw-KE');
    expect(calledUtterance.voice?.lang).toBe('sw-KE');
  });

  it('stops playback when clicked while active', () => {
    render(
      <AudioReaderButton
        text="Taarifa ya hali ya hewa."
        language="sw"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button); // Start
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    fireEvent.click(button); // Stop
    expect(mockCancel).toHaveBeenCalled();
  });

  it('falls back to backend synthesizeSpeech when SpeechSynthesis is unavailable', async () => {
    // Remove speechSynthesis to trigger backend fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).speechSynthesis;

    const synthesizeSpy = vi.spyOn(aiService, 'synthesizeSpeech').mockResolvedValue({
      success: true,
      data: {
        audioBase64: 'fake-base64-audio',
        format: 'audio/mp3',
      },
    });

    const mockPlay = vi.fn().mockResolvedValue(undefined);
    const mockPause = vi.fn();
    class MockAudio {
      play = mockPlay;
      pause = mockPause;
      currentTime = 0;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
    (window as unknown as { Audio: unknown }).Audio = MockAudio;

    render(
      <AudioReaderButton
        text="Taarifa ya dharura ya wadudu shambani."
        language="sw"
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(synthesizeSpy).toHaveBeenCalledWith(
        'Taarifa ya dharura ya wadudu shambani.',
        'sw'
      );
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  it('renders optional label when specified', () => {
    render(
      <AudioReaderButton
        text="Read this"
        label="Sikiliza"
        language="sw"
      />
    );

    expect(screen.getByText('Sikiliza')).toBeInTheDocument();
  });
});
