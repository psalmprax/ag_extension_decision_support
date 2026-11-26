import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { browserDictationLocale } from '@/lib/voiceLanguages';
import { pendingRecordings, type PendingRecordingStore } from '@/lib/pendingRecordings';
import { stopStreamTracks, transcribeRecording, type TranscriptionOutcome, type VoiceMessages } from './voiceTranscription';
import { ENGLISH_VOICE_MESSAGES } from './voiceMessages';

export interface UseFieldVoiceRecorderOptions {
  language: string;
  onTranscriptChunk: (chunk: string) => void;
  /**
   * Record and transcribe on the server first, and use the browser's own dictation
   * only if recording is unavailable. Browser dictation is weak for many African
   * languages, so farmers' voice messages go to the server.
   */
  preferServer?: boolean;
  /**
   * The field these words are for, such as `visit-findings:<farmerId>`. With a key, a
   * recording made with no signal is kept on the phone and its text is added to this
   * field once there is a connection. Without one, an offline recording is not kept.
   */
  draftKey?: string;
  /** Where kept recordings live; tests pass an in-memory store. */
  store?: PendingRecordingStore;
  /** What the recorder tells the user, in their language (see voiceMessages). English by default. */
  messages?: VoiceMessages;
}

/** Browser dictation errors that just mean "nothing was said" or "the user stopped". */
const QUIET_SPEECH_ERRORS = new Set(['no-speech', 'aborted']);
/** The browser cannot dictate this language, or cannot reach its speech service: record for the server instead. */
const RECORD_INSTEAD_ERRORS = new Set(['language-not-supported', 'network']);

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function speechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  const win = window as unknown as Record<string, unknown>;
  return (win.SpeechRecognition || win.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export function useFieldVoiceRecorder({
  language,
  onTranscriptChunk,
  preferServer = false,
  draftKey,
  store = pendingRecordings,
  messages = ENGLISH_VOICE_MESSAGES,
}: UseFieldVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [interimText, setInterimText] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const onChunkRef = useRef(onTranscriptChunk);
  const messagesRef = useRef(messages);
  onChunkRef.current = onTranscriptChunk;
  messagesRef.current = messages;

  useEffect(() => {
    if (!isRecording) return undefined;
    setRecordingDuration(0);
    const timer = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  /** Keeps a recording that could not be sent, when this field has a draft key. */
  const keepForLater = useCallback(
    async (audio: Blob) => {
      if (!draftKey) {
        toast.error(messagesRef.current.failed);
        return;
      }
      try {
        await store.save(draftKey, language, audio);
        setPendingCount(count => count + 1);
        toast(messagesRef.current.savedOffline, { duration: 6000 });
      } catch (err) {
        console.error('Could not keep the recording offline:', err);
        toast.error(messagesRef.current.failed);
      }
    },
    [draftKey, language, store]
  );

  const transcribe = useCallback(
    async (audio: Blob, toastId: string, successMessage?: string): Promise<TranscriptionOutcome> => {
      setIsTranscribing(true);
      try {
        const outcome = await transcribeRecording(audio, language, messagesRef.current, toastId, successMessage);
        if (outcome.status === 'done') onChunkRef.current(outcome.text);
        if (outcome.status === 'offline') await keepForLater(audio);
        return outcome;
      } finally {
        setIsTranscribing(false);
      }
    },
    [language, keepForLater]
  );

  /** Turns recordings kept offline for this field into text, once there is a connection. */
  const sendKept = useCallback(async () => {
    if (!draftKey || !navigator.onLine) return;
    try {
      const kept = await store.list(draftKey);
      setPendingCount(kept.length);
      for (const item of kept) {
        const outcome = await transcribeRecording(item.audio, item.language, messagesRef.current, `kept-${item.id}`);
        if (outcome.status === 'offline') return;
        if (outcome.status === 'done') onChunkRef.current(outcome.text);
        // A recording the server refused is dropped: it would fail again on every retry.
        await store.remove(item.id);
        setPendingCount(count => Math.max(0, count - 1));
      }
    } catch (err) {
      console.error('Could not send recordings kept offline:', err);
    }
  }, [draftKey, store]);

  useEffect(() => {
    void sendKept();
    window.addEventListener('online', sendKept);
    return () => window.removeEventListener('online', sendKept);
  }, [sendKept]);

  const stopWebSpeech = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.warn('Browser dictation did not stop cleanly:', err);
    }
    recognitionRef.current = null;
    setIsRecording(false);
    setInterimText('');
  }, []);

  const startMediaRecorder = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(messagesRef.current.notSupported);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success(messagesRef.current.recording, { id: 'voice-status' });
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error(messagesRef.current.micDenied);
      return false;
    }
  }, []);

  const stopMediaRecorder = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    setIsRecording(false);
    if (!recorder || recorder.state === 'inactive') return;
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    audioChunksRef.current = [];
    stopStreamTracks(recorder.stream);
    mediaRecorderRef.current = null;
    setInterimText('');
    await transcribe(audio, 'whisper-stt');
  }, [transcribe]);

  /** Live browser dictation; false when this browser or language cannot do it. */
  const startWebSpeech = useCallback(() => {
    const Recognition = speechRecognitionConstructor();
    const locale = browserDictationLocale(language);
    if (!Recognition || !locale) return false;
    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale;
      recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) onChunkRef.current(result[0].transcript.trim());
          else interim += result[0].transcript;
        }
        setInterimText(interim);
      };
      recognition.onerror = event => {
        stopWebSpeech();
        if (RECORD_INSTEAD_ERRORS.has(event.error ?? '')) void startMediaRecorder();
        else if (!QUIET_SPEECH_ERRORS.has(event.error ?? '')) toast.error(messagesRef.current.stopped);
      };
      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
      };
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      toast.success(messagesRef.current.listening, { id: 'voice-status' });
      return true;
    } catch (err) {
      console.warn('Browser dictation could not start:', err);
      return false;
    }
  }, [language, stopWebSpeech, startMediaRecorder]);

  /** Tap to start, tap again to stop. Browser dictation needs a connection, so offline it records instead. */
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') await stopMediaRecorder();
      else stopWebSpeech();
      return;
    }
    if (preferServer || !navigator.onLine || !startWebSpeech()) {
      if (!(await startMediaRecorder()) && preferServer) startWebSpeech();
    }
  }, [isRecording, preferServer, startWebSpeech, startMediaRecorder, stopMediaRecorder, stopWebSpeech]);

  /** Turns an existing audio file (.mp3, .wav, .m4a, .ogg, .webm) into text. */
  const uploadAudioFile = useCallback(
    async (file: File) => {
      await transcribe(file, 'upload-stt');
    },
    [transcribe]
  );

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    /** Recordings for this field still waiting for a connection. */
    pendingCount,
    toggleRecording,
    uploadAudioFile,
  };
}
