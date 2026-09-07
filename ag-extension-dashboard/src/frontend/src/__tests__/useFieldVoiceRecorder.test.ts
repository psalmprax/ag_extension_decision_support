import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFieldVoiceRecorder } from '../hooks/useFieldVoiceRecorder';
import { transcribeAudio } from '@/api/aiService';
import toast from 'react-hot-toast';

vi.mock('@/api/aiService', () => ({
  transcribeAudio: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

class MockMediaStream {
  tracks: Array<{ stop: () => void }> = [{ stop: vi.fn() }];
  getTracks() {
    return this.tracks;
  }
}

class MockMediaRecorder {
  stream: MockMediaStream;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported = vi.fn().mockReturnValue(true);

  constructor(stream: MockMediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['audio-sample-data'], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
}

describe('useFieldVoiceRecorder (Firefox fallback & transcription behavior)', () => {
  let mockStream: MockMediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = new MockMediaStream();

    // Emulate Firefox: Web Speech API is absent
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    // Mock FileReader.prototype.readAsDataURL if needed
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      setTimeout(() => {
        Object.defineProperty(this, 'result', {
          value: 'data:audio/webm;base64,bW9ja2F1ZGlv',
          writable: false,
        });
        if (this.onloadend) {
          this.onloadend({} as ProgressEvent<FileReader>);
        }
      }, 0);
    });

    // Emulate MediaDevices and MediaRecorder
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to MediaRecorder in Firefox and successfully sends audio to backend Whisper STT', async () => {
    const onTranscriptChunk = vi.fn();
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      success: true,
      data: { text: 'Mahindi yameshambuliwa na viwavi', language: 'sw' },
    });

    const { result } = renderHook(() =>
      useFieldVoiceRecorder({
        language: 'sw',
        onTranscriptChunk,
      })
    );

    expect(result.current.isRecording).toBe(false);

    // Start recording
    await act(async () => {
      await result.current.toggleRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Stop recording and trigger transcription pipeline
    await act(async () => {
      await result.current.toggleRecording();
    });

    await waitFor(() => {
      expect(transcribeAudio).toHaveBeenCalledWith('data:audio/webm;base64,bW9ja2F1ZGlv', 'sw');
    });

    expect(onTranscriptChunk).toHaveBeenCalledWith('Mahindi yameshambuliwa na viwavi');
    expect(toast.success).toHaveBeenCalledWith('Audio memo transcribed!', { id: 'whisper-stt' });
    expect(mockStream.tracks[0].stop).toHaveBeenCalled();
  });

  it('displays backend quota / plan limit message in toast when receiving 403', async () => {
    const onTranscriptChunk = vi.fn();
    const quotaError = {
      response: {
        status: 403,
        data: {
          error: 'Usage limit reached for speech',
          limitReached: true,
          details: {
            message: 'You have reached your free tier voice memo limit (15 memos). Please upgrade to Pro.',
          },
        },
      },
    };
    vi.mocked(transcribeAudio).mockRejectedValueOnce(quotaError);

    const { result } = renderHook(() =>
      useFieldVoiceRecorder({
        language: 'en',
        onTranscriptChunk,
      })
    );

    // Start recording
    await act(async () => {
      await result.current.toggleRecording();
    });
    expect(result.current.isRecording).toBe(true);

    // Stop recording
    await act(async () => {
      await result.current.toggleRecording();
    });

    await waitFor(() => {
      expect(transcribeAudio).toHaveBeenCalled();
    });

    expect(toast.error).toHaveBeenCalledWith(
      'You have reached your free tier voice memo limit (15 memos). Please upgrade to Pro.',
      expect.objectContaining({ duration: 5000 })
    );
    expect(onTranscriptChunk).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
  });

  it('allows uploading an audio file directly for Whisper transcription', async () => {
    const onTranscriptChunk = vi.fn();
    vi.mocked(transcribeAudio).mockResolvedValueOnce({
      success: true,
      data: { text: 'Uploaded field voice recording transcript', language: 'en' },
    });

    const { result } = renderHook(() =>
      useFieldVoiceRecorder({
        language: 'en',
        onTranscriptChunk,
      })
    );

    const testFile = new File(['mock-audio'], 'field-memo.m4a', { type: 'audio/m4a' });

    await act(async () => {
      await result.current.uploadAudioFile(testFile);
    });

    expect(transcribeAudio).toHaveBeenCalledWith('data:audio/webm;base64,bW9ja2F1ZGlv', 'en');
    expect(onTranscriptChunk).toHaveBeenCalledWith('Uploaded field voice recording transcript');
    expect(toast.success).toHaveBeenCalledWith('Voice memo transcribed (field-memo.m4a)!', { id: 'upload-stt' });
  });
});
