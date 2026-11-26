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

interface MockTrack {
  stop: ReturnType<typeof vi.fn>;
}

class MockStream {
  track: MockTrack = { stop: vi.fn() };
  getTracks() {
    return [this.track];
  }
}

class MockMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MockStream) {}
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
  static instances: MockSpeechRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    MockSpeechRecognition.instances.push(this);
  }
  stop() {}
}

/**
 * Installs browser globals for one test and puts the originals back afterwards, so no
 * test leaks a fake microphone or speech service into the next.
 */
function installGlobals(globals: Record<string, unknown>, target: object = window): () => void {
  const saved = Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(target, name)] as const);
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(target, name, { value, configurable: true, writable: true });
  }
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else Reflect.deleteProperty(target, name);
    }
  };
}

function memoryStore(): PendingRecordingStore & { items: PendingRecording[] } {
  const items: PendingRecording[] = [];
  return {
    items,
    save: vi.fn(async (draftKey: string, language: string, audio: Blob, recordedAt = Date.now()) => {
      items.push({ id: `rec-${items.length + 1}`, draftKey, language, audio, savedAt: recordedAt, ownerId: null });
    }),
    list: vi.fn(async (draftKey: string) => items.filter(item => item.draftKey === draftKey)),
    remove: vi.fn(async (id: string) => {
      items.splice(items.findIndex(item => item.id === id), 1);
    }),
  };
}

const serverError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: {} } });

let online = true;
let streams: MockStream[] = [];
let restore: Array<() => void> = [];

beforeEach(() => {
  vi.clearAllMocks();
  online = true;
  streams = [];
  MockSpeechRecognition.instances = [];
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  const getUserMedia = vi.fn(async () => {
    const stream = new MockStream();
    streams.push(stream);
    return stream;
  });
  restore = [
    installGlobals({ webkitSpeechRecognition: MockSpeechRecognition, MediaRecorder: MockMediaRecorder }),
    installGlobals({ mediaDevices: { getUserMedia } }, navigator),
  ];
  vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
    Object.defineProperty(this, 'result', { value: 'data:audio/webm;base64,QQ==' });
    setTimeout(() => this.onloadend?.({} as ProgressEvent<FileReader>), 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  restore.forEach(undo => undo());
});

type Recorder = { current: ReturnType<typeof useFieldVoiceRecorder> };

async function start(result: Recorder) {
  await act(async () => {
    await result.current.toggleRecording();
  });
}

async function recordOnce(result: Recorder) {
  await start(result);
  await act(async () => {
    await result.current.toggleRecording();
  });
}

describe('dictation languages', () => {
  it('uses live browser dictation, in the right locale, for a language the browser knows', async () => {
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'sw', onTranscriptChunk: vi.fn() }));
    await start(result);
    expect(MockSpeechRecognition.instances.map(r => r.lang)).toEqual(['sw-KE']);
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('switches to recording for the server when the browser cannot reach its speech service', async () => {
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn() }));
    await start(result);

    await act(async () => {
      MockSpeechRecognition.instances[0].onerror?.({ error: 'network' });
    });

    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    expect(result.current.isRecording).toBe(true);
  });

  it('records for the server instead of hearing Hausa as US English', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Masara ta bushe', language: 'ha' } });
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'ha', onTranscriptChunk }));

    await recordOnce(result);

    expect(MockSpeechRecognition.instances).toEqual([]);
    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Masara ta bushe', expect.objectContaining({ recordedAt: expect.any(Number) })));
    expect(transcribeAudio).toHaveBeenCalledWith('data:audio/webm;base64,QQ==', 'ha');
  });

  it('warns that the words need checking when the server does not know the language', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Ọka adịghị mma', language: 'unknown', languageSupported: false } });
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'ig', onTranscriptChunk }));

    await recordOnce(result);

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Ọka adịghị mma', expect.anything()));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('not reliable in your language'), expect.objectContaining({ id: 'whisper-stt' }));
    expect(toast.success).not.toHaveBeenCalledWith('Done. Check the words before you save.', expect.anything());
  });
});

describe('recordings that cannot become text yet', () => {
  it('records instead of using browser dictation offline, keeps the recording, and adds its text once back online', async () => {
    online = false;
    const store = memoryStore();
    const onTranscriptChunk = vi.fn();
    const { result } = renderHook(() =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk, draftKey: 'visit-findings:v1', store })
    );

    await recordOnce(result);

    expect(MockSpeechRecognition.instances).toEqual([]);
    await waitFor(() => expect(result.current.pendingCount).toBe(1));
    expect(store.save).toHaveBeenCalledWith('visit-findings:v1', 'en', expect.any(Blob), expect.any(Number));
    expect(transcribeAudio).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('No signal'), expect.anything());

    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Leaves are yellow', language: 'en' } });
    online = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Leaves are yellow', expect.anything()));
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(store.items).toHaveLength(0);
  });

  it('shows how many recordings are waiting even when the field opens with no signal', async () => {
    online = false;
    const store = memoryStore();
    await store.save('visit-findings:v3', 'en', new Blob(['audio']));
    await store.save('visit-findings:v3', 'en', new Blob(['audio']));

    const { result } = renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), draftKey: 'visit-findings:v3', store }));

    await waitFor(() => expect(result.current.pendingCount).toBe(2));
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it('turns kept recordings into text when the field is opened again, with the time they were recorded', async () => {
    const store = memoryStore();
    const recordedAt = new Date('2026-11-20T10:00:00').getTime();
    await store.save('visit-findings:v2', 'sw', new Blob(['audio']), recordedAt);
    vi.mocked(transcribeAudio).mockResolvedValue({ success: true, data: { text: 'Mahindi yamekauka', language: 'sw' } });
    const onTranscriptChunk = vi.fn();

    renderHook(() => useFieldVoiceRecorder({ language: 'sw', onTranscriptChunk, draftKey: 'visit-findings:v2', store }));

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledWith('Mahindi yamekauka', { recordedAt }));
    expect(store.items).toHaveLength(0);
  });

  it('sends each kept recording once, however often the connection comes back', async () => {
    const store = memoryStore();
    await store.save('notes', 'en', new Blob(['audio']));
    let finish: (value: Awaited<ReturnType<typeof transcribeAudio>>) => void = () => undefined;
    vi.mocked(transcribeAudio).mockImplementation(() => new Promise(resolve => (finish = resolve)));
    const onTranscriptChunk = vi.fn();
    renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk, draftKey: 'notes', store }));
    await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1));

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    await act(async () => finish({ success: true, data: { text: 'Soil is dry', language: 'en' } }));

    await waitFor(() => expect(onTranscriptChunk).toHaveBeenCalledTimes(1));
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
  });

  it('keeps a kept recording when the service fails for now, and drops it only when refused for good', async () => {
    const store = memoryStore();
    await store.save('notes', 'en', new Blob(['audio']));
    vi.mocked(transcribeAudio).mockRejectedValueOnce(serverError(503));
    const { unmount } = renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), draftKey: 'notes', store }));

    await waitFor(() => expect(transcribeAudio).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.items).toHaveLength(1));
    expect(store.remove).not.toHaveBeenCalled();
    unmount();

    vi.mocked(transcribeAudio).mockRejectedValueOnce(serverError(413));
    renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), draftKey: 'notes', store }));

    await waitFor(() => expect(store.items).toHaveLength(0));
  });

  it('keeps a new recording when the connection drops or the service fails while sending it', async () => {
    const store = memoryStore();
    vi.mocked(transcribeAudio).mockRejectedValueOnce(new Error('Network Error')).mockRejectedValueOnce(serverError(502));
    const { result } = renderHook(() =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), preferServer: true, draftKey: 'notes', store })
    );

    await recordOnce(result);
    await waitFor(() => expect(store.save).toHaveBeenCalledTimes(1));
    await recordOnce(result);
    await waitFor(() => expect(store.save).toHaveBeenCalledTimes(2));

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('will be tried again'), expect.anything());
  });
});

describe('words stay with the field they were spoken for', () => {
  it('does not put words into another field that took this one\'s place, and keeps them for their own', async () => {
    const store = memoryStore();
    let finish: (value: Awaited<ReturnType<typeof transcribeAudio>>) => void = () => undefined;
    vi.mocked(transcribeAudio).mockImplementation(() => new Promise(resolve => (finish = resolve)));
    const onTranscriptChunk = vi.fn();
    const { result, rerender } = renderHook(({ draftKey }) =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk, preferServer: true, draftKey, store }), { initialProps: { draftKey: 'visit-plan-notes:farmer-a' } });

    await start(result);
    let stopping: Promise<void> = Promise.resolve();
    act(() => {
      stopping = result.current.toggleRecording();
    });
    await waitFor(() => expect(transcribeAudio).toHaveBeenCalled());
    rerender({ draftKey: 'visit-plan-notes:farmer-b' });
    await act(async () => {
      finish({ success: true, data: { text: 'Farmer A has blight', language: 'en' } });
      await stopping;
    });

    await waitFor(() => expect(store.save).toHaveBeenCalledWith('visit-plan-notes:farmer-a', 'en', expect.any(Blob), expect.any(Number)));
    expect(onTranscriptChunk).not.toHaveBeenCalled();
  });

  it('releases the microphone and keeps what was said when the form closes mid-recording', async () => {
    const store = memoryStore();
    const { result, unmount } = renderHook(() =>
      useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), preferServer: true, draftKey: 'cycle-notes:field-1', store })
    );
    await start(result);

    unmount();

    await waitFor(() => expect(store.save).toHaveBeenCalledWith('cycle-notes:field-1', 'en', expect.any(Blob), expect.any(Number)));
    expect(streams[0].track.stop).toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it('lets the microphone go when it opens only after the form has closed', async () => {
    let grant: (stream: MockStream) => void = () => undefined;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() => new Promise(resolve => (grant = resolve as (stream: MockStream) => void)));
    const { result, unmount } = renderHook(() => useFieldVoiceRecorder({ language: 'en', onTranscriptChunk: vi.fn(), preferServer: true }));
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = result.current.toggleRecording();
    });

    unmount();
    const late = new MockStream();
    await act(async () => {
      grant(late);
      await starting;
    });

    expect(late.track.stop).toHaveBeenCalled();
  });
});
