import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFieldVoiceRecorder } from '../hooks/useFieldVoiceRecorder';
import { transcribeAudio } from '@/api/aiService';
import type { PendingRecording, PendingRecordingStore } from '@/lib/pendingRecordings';
import toast from 'react-hot-toast';

vi.mock('@/api/aiService', () => ({ transcribeAudio: vi.fn() }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() });
  return { default: toast, toast };
});

class MockMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: { getTracks: () => { stop: () => void }[] }) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

/** Browser dictation that records which language it was asked for. */
class MockSpeechRecognition {
  static started: string[] = [];
  static instances: MockSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: unknown = null;
  onerror: unknown = null;
  onend: unknown = null;
  start() {
    MockSpeechRecognition.started.push(this.lang);
    MockSpeechRecognition.instances.push(this);
  }
  stop() {}
}

function memoryStore(): PendingRecordingStore & { items: PendingRecording[] } {
  const items: PendingRecording[] = [];
  return {
    items,
    save: vi.fn(async (draftKey: string, language: string, audio: Blob) => {
      items.push({ id: `rec-${items.length + 1}`, draftKey, language, audio, savedAt: Date.now(), ownerId: null });
    }),
    list: vi.fn(async (draftKey: string) => items.filter(item => item.draftKey === draftKey)),
    remove: vi.fn(async (id: string) => {
      items.splice(items.findIndex(item => item.id === id), 1);
    }),
  };
}

let online = true;

beforeEach(() => {
  vi.clearAllMocks();
  online = true;
  MockSpeechRecognition.started = [];
  MockSpeechRecognition.instances = [];
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = MockSpeechRecognition;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
    writable: true,
  });
  (window as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
    Object.defineProperty(this, 'result', { value: 'data:audio/webm;base64,QQ==' });
    setTimeout(() => this.onloadend?.({} as ProgressEvent<FileReader>), 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

async function recordOnce(result: { current: ReturnType<typeof useFieldVoiceRecorder> }) {
  await act(async () => {
    await result.current.toggleRecording();
  });
  await act(async () => {
    await result.current.toggleRecording();
  });
}

describe('dictation languages', () => {
  it('uses live browser dictation, in the right locale, for a language the browser knows', async () => {
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'sw', onTranscriptChunk: vi.fn() }));
    await act(async () => {
      await result.current.toggleRecording();
    });
    expect(MockSpeechRecognition.started).toEqual(['sw-KE']);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('switches to recording for the server when the browser cannot reach its speech service', async () => {
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn() }));
    await act(async () => {
      await result.current.toggleRecording();
    });

    await act(async () => {
      (MockSpeechRecognition.instances[0].onerror as (event: { error: string }) => void)({ error: 'network' });
    });

    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    expect(result.current.isRecording).toBe(true);
  });

  it('records for the server instead of hearing Hausa as US English', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Masara ta bushe', language: 'ha' } });
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'ha', onTranscriptChunk }));

    await recordOnce(result);

    expect(MockSpeechRecognition.started).toEqual([]);
    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Masara ta bushe'));
    expect(transcribeAudio).toHaveBeenCalledWith('data:audio/webm;base64,QQ==', 'ha');
  });

  it('warns that the words need checking when the server does not know the language', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Ọka adịghị mma', language: 'unknown', languageSupported: false } });
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'ig', onTranscriptChunk }));

    await recordOnce(result);

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Ọka adịghị mma'));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('not reliable in your language'), expect.objectContaining({ id: 'whisper-stt' }));
    expect(toast.success).not.toHaveBeenCalledWith('Done. Check the words before you save.', expect.anything());
  });
});

describe('recording with no signal', () => {
  it('records instead of using browser dictation, keeps the recording, and adds its text once back online', async () => {
    online = false;
    const store = memoryStore();
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk, draftKey: 'visit-findings:v1', store })
    );

    await recordOnce(result);

    expect(MockSpeechRecognition.started).toEqual([]);
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(store.save).toHaveBeenCalledWith('visit-findings:v1', 'en', expect.any(Blob));
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('No signal'), expect.anything());

    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Leaves are yellow', language: 'en' } });
    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Leaves are yellow'));
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(store.items).toHaveLength(0);
  });

  it('turns kept recordings into text when the field is opened again with a connection', async () => {
    const store = memoryStore();
    await store.save('visit-findings:v2', 'sw', new Blob(['audio']));
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Mahindi yamekauka', language: 'sw' } });
    const onTranscriptChunk = vi.fn();

    renderHook(() => useFieldVoiceRecorder({ language: 'sw', onTranscriptChunk, draftKey: 'visit-findings:v2', store }));

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Mahindi yamekauka'));
    expect(store.items).toHaveLength(0);
  });

  it('keeps a recording for later when the connection drops during sending', async () => {
    const store = memoryStore();
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('Network Error'));
    const { result } = renderHook(() =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), preferServer: true, draftKey: 'notes', store })
    );

    await recordOnce(result);

    await waitFor(() => expect(store.save).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });
});
