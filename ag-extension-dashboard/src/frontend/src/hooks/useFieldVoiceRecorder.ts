import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { browserDictationLocale } from '@/lib/voiceLanguages';
import { pendingRecordings, type PendingRecordingStore } from '@/lib/pendingRecordings';
import { stopStreamTracks, transcribeRecording, type VoiceMessages } from './voiceTranscription';
import { ENGLISH_VOICE_MESSAGES } from './voiceMessages';
import { useKeptRecordings } from './useKeptRecordings';
import { QUIET_SPEECH_ERRORS, RECORD_INSTEAD_ERRORS, speechRecognitionConstructor, type SpeechRecognitionLike } from './browserDictation';

/** When the words were spoken: recordings kept offline are turned into text later. */
export interface DictationMeta {
  recordedAt: number;
}

export interface UseFieldVoiceRecorderOptions {
  language: string;
  onTranscriptChunk: (chunk: string, meta: DictationMeta) => void;
  /**
   * Record and transcribe on the server first, and use the browser's own dictation
   * only if recording is unavailable. Browser dictation is weak for many African
   * languages, so farmers' voice messages go to the server.
   */
  preferServer?: boolean;
  /**
   * The field these words are for, such as `visit-findings:<visitId>`. With a key, a
   * recording that could not be turned into text yet is kept on the phone, and its text
   * goes only into this field. Without one, such a recording is not kept.
   */
  draftKey?: string;
  /** Where kept recordings live; tests pass an in-memory store. */
  store?: PendingRecordingStore;
  /** What the recorder tells the user, in their language (see voiceMessages). English by default. */
  messages?: VoiceMessages;
}

/** Who a recording belongs to: the field on screen when it started, and when. */
interface RecordingOwner {
  key: string | undefined;
  startedAt: number;
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

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const ownerRef = useRef<RecordingOwner>({ key: draftKey, startedAt: Date.now() });
  const mountedRef = useRef(true);
  const onChunkRef = useRef(onTranscriptChunk);
  const messagesRef = useRef(messages);
  const draftKeyRef = useRef(draftKey);
  const languageRef = useRef(language);
  onChunkRef.current = onTranscriptChunk;
  messagesRef.current = messages;
  draftKeyRef.current = draftKey;
  languageRef.current = language;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isRecording) return undefined;
    setRecordingDuration(0);
    const timer = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  /** Text reaches the field only while that same field is on screen. */
  const deliver = useCallback((text: string, ownerKey: string | undefined, recordedAt: number) => {
    if (!mountedRef.current || draftKeyRef.current !== ownerKey) return false;
    onChunkRef.current(text, { recordedAt });
    return true;
  }, []);

  const { pendingCount, keep } = useKeptRecordings({ draftKey, language, store, messagesRef, deliver });

  const transcribe = useCallback(
    async (audio: Blob, toastId: string, owner: RecordingOwner) => {
      setIsTranscribing(true);
      try {
        const outcome = await transcribeRecording(audio, languageRef.current, messagesRef.current, toastId);
        if (outcome.status === 'done' && !deliver(outcome.text, owner.key, owner.startedAt)) {
          // The field was closed or replaced meanwhile: keep the words for the field they belong to.
          await keep(audio, owner.key, owner.startedAt, 'retry', false);
        }
        if (outcome.status === 'offline' || outcome.status === 'retry') {
          await keep(audio, owner.key, owner.startedAt, outcome.status, mountedRef.current);
        }
      } finally {
        setIsTranscribing(false);
      }
    },
    [deliver, keep]
  );

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
      // The field closed while the microphone was being opened: let the microphone go.
      if (!mountedRef.current) {
        stopStreamTracks(stream);
        return false;
      }
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      ownerRef.current = { key: draftKeyRef.current, startedAt: Date.now() };
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

  /** Stops the recorder and hands back what it recorded, releasing the microphone. */
  const finishRecorder = useCallback(async (recorder: MediaRecorder): Promise<Blob> => {
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    const audio = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
    audioChunksRef.current = [];
    stopStreamTracks(recorder.stream);
    if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
    return audio;
  }, []);

  const stopMediaRecorder = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    setIsRecording(false);
    setInterimText('');
    if (!recorder || recorder.state === 'inactive') return;
    const owner = ownerRef.current;
    await transcribe(await finishRecorder(recorder), 'whisper-stt', owner);
  }, [finishRecorder, transcribe]);

  /** Live browser dictation; false when this browser or language cannot do it. */
  const startWebSpeech = useCallback(() => {
    const Recognition = speechRecognitionConstructor();
    const locale = browserDictationLocale(language);
    if (!Recognition || !locale) return false;
    try {
      const recognition = new Recognition();
      const ownerKey = draftKeyRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale;
      recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) deliver(result[0].transcript.trim(), ownerKey, Date.now());
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
  }, [language, deliver, stopWebSpeech, startMediaRecorder]);

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

  // Another field took this control's place (say another farmer was chosen): stop, so the
  // recording stays with the field it was started for.
  const shownKeyRef = useRef(draftKey);
  useEffect(() => {
    if (shownKeyRef.current === draftKey) return;
    shownKeyRef.current = draftKey;
    if (mediaRecorderRef.current?.state === 'recording') void stopMediaRecorder();
    else if (recognitionRef.current) stopWebSpeech();
  }, [draftKey, stopMediaRecorder, stopWebSpeech]);

  // Leaving the screen mid-recording: release the microphone, and keep what was said
  // for its field when it has one.
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.warn('Browser dictation did not stop cleanly:', err);
      }
      recognitionRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') return;
      const owner = ownerRef.current;
      void finishRecorder(recorder).then(audio =>
        owner.key && audio.size > 0
          ? store.save(owner.key, languageRef.current, audio, owner.startedAt).catch(err => console.error('Could not keep the recording:', err))
          : undefined
      );
    },
    [finishRecorder, store]
  );

  /** Turns an existing audio file (.mp3, .wav, .m4a, .ogg, .webm) into text. */
  const uploadAudioFile = useCallback(
    async (file: File) => {
      await transcribe(file, 'upload-stt', { key: draftKeyRef.current, startedAt: Date.now() });
    },
    [transcribe]
  );

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    /** Recordings for this field still waiting to become text. */
    pendingCount,
    toggleRecording,
    uploadAudioFile,
  };
}
