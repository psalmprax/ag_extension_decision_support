import { useState, useRef, useEffect, useCallback } from 'react';
import { transcribeAudio } from '@/api/aiService';
import toast from 'react-hot-toast';

export interface UseFieldVoiceRecorderOptions {
  language: string;
  onTranscriptChunk: (chunk: string) => void;
}

const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  sw: 'sw-KE',
  fr: 'fr-FR',
  pt: 'pt-BR',
  es: 'es-ES',
  ar: 'ar-SA',
  hi: 'hi-IN',
  zh: 'zh-CN',
  ru: 'ru-RU',
  de: 'de-DE',
  it: 'it-IT',
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function stopStreamTracks(stream?: MediaStream): void {
  try {
    stream?.getTracks().forEach(t => t.stop());
  } catch {
    /* ignore */
  }
}

function handleTranscriptionError(err: unknown, toastId: string, defaultMsg: string): void {
  console.error('Audio transcription error:', err);
  const axiosErr = err as {
    response?: {
      status?: number;
      data?: { error?: string; limitReached?: boolean; details?: { message?: string } };
    };
  };
  const backendMsg =
    axiosErr.response?.data?.details?.message ||
    axiosErr.response?.data?.error;

  if (axiosErr.response?.status === 403 && backendMsg) {
    toast.error(backendMsg, { id: toastId, duration: 5000 });
  } else {
    toast.error(backendMsg || defaultMsg, { id: toastId });
  }
}

async function executeTranscription(
  blob: Blob,
  language: string,
  onSuccess: (text: string) => void,
  toastId: string,
  loadingMsg: string,
  successMsg: string,
  fallbackMsg: string
): Promise<void> {
  try {
    const base64Audio = await blobToBase64(blob);
    toast.loading(loadingMsg, { id: toastId });
    const res = await transcribeAudio(base64Audio, language);

    if (res.success && res.data?.text) {
      onSuccess(res.data.text.trim());
      toast.success(successMsg, { id: toastId });
    } else {
      toast.error('Could not transcribe audio.', { id: toastId });
    }
  } catch (err: unknown) {
    handleTranscriptionError(err, toastId, fallbackMsg);
  }
}

export function useFieldVoiceRecorder({ language, onTranscriptChunk }: UseFieldVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [interimText, setInterimText] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onChunkRef = useRef(onTranscriptChunk);

  useEffect(() => {
    onChunkRef.current = onTranscriptChunk;
  }, [onTranscriptChunk]);

  // Duration ticker
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // Stop Web Speech Recognition
  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  // Stop MediaRecorder and transcribe via backend Whisper
  const stopMediaRecorder = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    setIsTranscribing(true);
    setIsRecording(false);

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      stopStreamTracks(recorder.stream as MediaStream | undefined);

      await executeTranscription(
        audioBlob,
        language,
        text => onChunkRef.current(text),
        'whisper-stt',
        'Transcribing field audio with Whisper AI...',
        'Audio memo transcribed!',
        'Failed to transcribe field recording.'
      );

      setIsTranscribing(false);
      setInterimText('');
    };

    recorder.stop();
  }, [language]);

  // Start continuous Web Speech dictation
  const startWebSpeech = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) return false;

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = SPEECH_LANG_MAP[language] || 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            onChunkRef.current(chunk.trim());
          } else {
            interim += chunk;
          }
        }
        setInterimText(interim);
      };

      recognition.onerror = () => {
        stopWebSpeech();
        toast.error('Voice dictation disconnected.');
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText('');
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      toast.success(`Continuous dictation active (${recognition.lang})`);
      return true;
    } catch {
      return false;
    }
  }, [language, stopWebSpeech]);

  // Start MediaRecorder (Whisper AI fallback / mobile mic)
  const startMediaRecorder = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone recording is not supported by your browser.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = e => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250); // Collect in 250ms chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success('Recording audio memo (Whisper AI)...');
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Microphone access was denied or unavailable.');
      return false;
    }
  }, []);

  // Main Toggle: tries WebSpeech continuous, falls back to MediaRecorder
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        await stopMediaRecorder();
      } else {
        stopWebSpeech();
      }
      return;
    }

    const startedWebSpeech = startWebSpeech();
    if (!startedWebSpeech) {
      await startMediaRecorder();
    }
  }, [isRecording, startWebSpeech, startMediaRecorder, stopMediaRecorder, stopWebSpeech]);

  // Upload an existing audio file (.mp3, .wav, .m4a, .ogg, .webm)
  const uploadAudioFile = useCallback(
    async (file: File) => {
      setIsTranscribing(true);
      await executeTranscription(
        file,
        language,
        text => onChunkRef.current(text),
        'upload-stt',
        `Transcribing "${file.name}" with Whisper AI...`,
        `Voice memo transcribed (${file.name})!`,
        'Failed to transcribe audio file.'
      );
      setIsTranscribing(false);
    },
    [language]
  );

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    interimText,
    toggleRecording,
    uploadAudioFile,
  };
}
