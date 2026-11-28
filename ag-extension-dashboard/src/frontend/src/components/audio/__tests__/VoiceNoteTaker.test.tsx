import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VoiceNoteTaker } from '../VoiceNoteTaker';
import { useAppStore } from '@/store/useAppStore';
import { englishT } from '@/test/englishT';

// The app language, as the language context reports it.
let appLang = 'en';
vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: () => ({ language: appLang, setLanguage: () => undefined, t: englishT, isRTL: false }),
}));

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

    appLang = 'en';
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

  it('listens in the app language until a dictation language is chosen', () => {
    useAppStore.setState({ preferredAudioLanguage: '' });
    appLang = 'fr';
    render(<VoiceNoteTaker />);
    expect(mockUseFieldVoiceRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'fr' }));
  });

  it('falls back to English when dictation does not support the app language', () => {
    useAppStore.setState({ preferredAudioLanguage: '' });
    appLang = 'de';
    render(<VoiceNoteTaker />);
    expect(mockUseFieldVoiceRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('follows a change of app language while idle, unless a language was chosen or a recording is running', () => {
    useAppStore.setState({ preferredAudioLanguage: '' });
    const { rerender, unmount } = render(<VoiceNoteTaker />);
    appLang = 'sw';
    rerender(<VoiceNoteTaker />);
    expect(mockUseFieldVoiceRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'sw' }));
    unmount();

    // A language chosen for dictation stays.
    useAppStore.setState({ preferredAudioLanguage: 'ha' });
    appLang = 'en';
    const chosen = render(<VoiceNoteTaker />);
    appLang = 'fr';
    chosen.rerender(<VoiceNoteTaker />);
    expect(mockUseFieldVoiceRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'ha' }));
    chosen.unmount();

    // A recording keeps the language it started in.
    useAppStore.setState({ preferredAudioLanguage: '' });
    appLang = 'en';
    vi.mocked(mockUseFieldVoiceRecorder).mockImplementation(() => ({
      isRecording: true, isTranscribing: false, recordingDuration: 3, interimText: '', toggleRecording: mockToggleRecording,
    }));
    const recording = render(<VoiceNoteTaker />);
    appLang = 'fr';
    recording.rerender(<VoiceNoteTaker />);
    expect(mockUseFieldVoiceRecorder).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('renders microphone button and active language', () => {
    render(<VoiceNoteTaker />);

    expect(screen.getByText('Audio note taker')).toBeInTheDocument();
    expect(screen.getByText('Kiswahili')).toBeInTheDocument();
    expect(screen.getByLabelText(/Start speaking voice note/i)).toBeInTheDocument();
  });

  it('allows switching spoken language in dropdown', () => {
    render(<VoiceNoteTaker />);

    const langBtn = screen.getByLabelText(/Current language: Kiswahili/i);
    fireEvent.click(langBtn);

    expect(screen.getByText('Select spoken language')).toBeInTheDocument();

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

    const saveBtn = screen.getByText('Save voice note');
    fireEvent.click(saveBtn);
    expect(onSaveNote).toHaveBeenCalledWith('Nahitaji mbolea ya kupandia mahindi ekari mbili.');
  });
});
