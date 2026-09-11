import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VoiceNoteTaker } from '../VoiceNoteTaker';
import { useAppStore } from '@/store/useAppStore';

interface RecorderOptions {
  onTranscriptChunk: (chunk: string) => void;
  language?: string;
}

const mockToggleRecording = vi.fn();
let mockUseFieldVoiceRecorder: (opts: RecorderOptions) => {
  isRecording: boolean;
  isTranscribing: boolean;
  recordingDuration: number;
  interimText: string;
  toggleRecording: () => void;
};

vi.mock('@/hooks/useFieldVoiceRecorder', () => ({
  useFieldVoiceRecorder: (opts: RecorderOptions) => mockUseFieldVoiceRecorder(opts),
}));

describe('VoiceNoteTaker', () => {
  beforeEach(() => {
    useAppStore.setState({
      preferredAudioLanguage: 'sw',
    });

    mockToggleRecording.mockClear();
    mockUseFieldVoiceRecorder = vi.fn().mockImplementation((opts: RecorderOptions) => ({
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      interimText: '',
      toggleRecording: () => {
        mockToggleRecording();
        opts.onTranscriptChunk('Nahitaji mbolea ya kupandia mahindi ekari mbili.');
      },
    }));
  });

  it('renders microphone button and active language', () => {
    render(<VoiceNoteTaker />);

    expect(screen.getByText('Audio Note Taker')).toBeInTheDocument();
    expect(screen.getByText('Kiswahili')).toBeInTheDocument();
    expect(screen.getByLabelText(/Start speaking voice note/i)).toBeInTheDocument();
  });

  it('allows switching spoken language in dropdown', () => {
    render(<VoiceNoteTaker />);

    const langBtn = screen.getByLabelText(/Current language: Kiswahili/i);
    fireEvent.click(langBtn);

    expect(screen.getByText('Select Spoken Language')).toBeInTheDocument();

    const hausaOption = screen.getByText('Hausa');
    fireEvent.click(hausaOption);

    expect(useAppStore.getState().preferredAudioLanguage).toBe('ha');
    expect(screen.getByText('Tap mic to speak in Hausa')).toBeInTheDocument();
  });

  it('triggers recording and captures transcript on speech input', () => {
    const onSaveNote = vi.fn();
    render(<VoiceNoteTaker onSaveNote={onSaveNote} />);

    const micBtn = screen.getByLabelText(/Start speaking voice note/i);
    fireEvent.click(micBtn);

    expect(mockToggleRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Nahitaji mbolea ya kupandia mahindi ekari mbili./i)).toBeInTheDocument();

    const saveBtn = screen.getByText('Save Voice Note');
    fireEvent.click(saveBtn);
    expect(onSaveNote).toHaveBeenCalledWith('Nahitaji mbolea ya kupandia mahindi ekari mbili.');
  });
});
