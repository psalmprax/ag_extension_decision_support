import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { synthesizeSpeech } from '@/api/aiService';

export interface AudioReaderButtonProps {
  /** The text content to read aloud */
  text: string;
  /** Language code (e.g. 'sw', 'en', 'fr', 'ha', 'yo', 'zu', 'ny'). Defaults to user's preferredAudioLanguage */
  language?: string;
  /** Optional visible button label (e.g. "Listen") */
  label?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Visual style variant */
  variant?: 'ghost' | 'subtle' | 'pill' | 'filled';
  /** Additional CSS class names */
  className?: string;
  /** Accessible title attribute */
  title?: string;
  /** Callback fired when reading starts */
  onPlayStart?: () => void;
  /** Callback fired when reading ends or is stopped */
  onPlayEnd?: () => void;
}

const LANGUAGE_BCP47_MAP: Record<string, string> = {
  sw: 'sw-KE',
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-BR',
  es: 'es-ES',
  ha: 'ha-NG',
  yo: 'yo-NG',
  ig: 'ig-NG',
  am: 'am-ET',
  om: 'om-ET',
  ti: 'ti-ET',
  so: 'so-SO',
  lg: 'lg-UG',
  rw: 'rw-RW',
  rn: 'rn-BI',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  af: 'af-ZA',
  sn: 'sn-ZW',
  ny: 'ny-MW',
  ar: 'ar-SA',
  hi: 'hi-IN',
  zh: 'zh-CN',
  de: 'de-DE',
};

const LANGUAGE_NAMES: Record<string, string> = {
  sw: 'Kiswahili',
  en: 'English',
  fr: 'Français',
  pt: 'Português',
  es: 'Español',
  ha: 'Hausa',
  yo: 'Yorùbá',
  ig: 'Igbo',
  am: 'Amharic',
  om: 'Oromo',
  zu: 'isiZulu',
  ny: 'Chichewa',
  ar: 'العربية',
};

/** Track currently active utterance/audio globally so two audio readers never speak at once */
let activeAudioElement: HTMLAudioElement | null = null;
let activeStopCallback: (() => void) | null = null;

export function stopAllAudioPlayback(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeAudioElement = null;
  }
  if (activeStopCallback) {
    activeStopCallback();
    activeStopCallback = null;
  }
}

/**
 * Strips markdown formatting, links, and code markup so text sounds natural when read aloud.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    // Strip code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Convert markdown links [text](url) to just text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italics
    .replace(/[*_~]{1,3}(.*?)[*_~]{1,3}/g, '$1')
    // Strip markdown headings #, ##, etc.
    .replace(/^#+\s+/gm, '')
    // Strip blockquotes
    .replace(/^>\s+/gm, '')
    // Strip bullet points
    .replace(/^[-*+]\s+/gm, '')
    // Replace multiple newlines or spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * AudioReaderButton — Accessible Text-to-Speech button allowing low-literacy farmers
 * and extension workers to listen to any reading information in their local language.
 */
export const AudioReaderButton: React.FC<AudioReaderButtonProps> = ({
  text,
  language: propLanguage,
  label,
  size = 'sm',
  variant = 'subtle',
  className = '',
  title,
  onPlayStart,
  onPlayEnd,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const preferredStoreLang = useAppStore(s => s.preferredAudioLanguage);
  const targetLanguage = propLanguage || preferredStoreLang || 'sw';
  const bcp47 = LANGUAGE_BCP47_MAP[targetLanguage] || 'en-US';
  const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage.toUpperCase();

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setIsLoading(false);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    onPlayEnd?.();
  }, [onPlayEnd]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount if this instance was playing
      if (isPlaying) {
        stopAllAudioPlayback();
      }
    };
  }, [isPlaying]);

  const handlePlayToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlaying) {
      stopAllAudioPlayback();
      handleStop();
      return;
    }

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      toast.error('No text available to read.');
      return;
    }

    // Stop any other currently playing reader
    stopAllAudioPlayback();

    activeStopCallback = handleStop;
    setIsPlaying(true);
    onPlayStart?.();

    // Strategy 1: Client-side Browser SpeechSynthesis (free, instant, works offline)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = bcp47;
        utterance.rate = 0.95; // Slightly slower pace for clearer comprehension

        // Look for localized voice
        const voices = window.speechSynthesis.getVoices?.() || [];
        const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetLanguage.toLowerCase()));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.onend = () => {
          setIsPlaying(false);
          activeStopCallback = null;
          onPlayEnd?.();
        };

        utterance.onerror = (err) => {
          // If speech synthesis was aborted intentionally by stopAllAudioPlayback, ignore
          if (err.error === 'canceled' || err.error === 'interrupted') {
            setIsPlaying(false);
            return;
          }
          console.warn('SpeechSynthesis error, falling back to backend TTS:', err);
          // Try backend fallback
          playBackendTts(cleanText);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn('SpeechSynthesis failed, falling back to backend:', err);
      }
    }

    // Strategy 2: Server-side Neural TTS fallback
    await playBackendTts(cleanText);
  };

  const playBackendTts = async (cleanText: string) => {
    setIsLoading(true);
    try {
      const res = await synthesizeSpeech(cleanText.slice(0, 1000), targetLanguage);
      const audioPayload = res?.data?.audioUrl || res?.data?.audioBase64;

      if (!audioPayload) {
        throw new Error('No audio returned from speech synthesis');
      }

      const audioMime = res?.data?.format === 'ogg' ? 'audio/ogg' : 'audio/mp3';
      const audio = new Audio(`data:${audioMime};base64,${audioPayload}`);
      audioElementRef.current = audio;
      activeAudioElement = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setIsLoading(false);
        activeAudioElement = null;
        activeStopCallback = null;
        onPlayEnd?.();
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
        activeAudioElement = null;
        activeStopCallback = null;
        toast.error('Could not play audio readout.');
        onPlayEnd?.();
      };

      await audio.play();
      setIsLoading(false);
    } catch (err) {
      console.error('Audio synthesis playback error:', err);
      setIsPlaying(false);
      setIsLoading(false);
      activeStopCallback = null;
      toast.error(`Audio narration unavailable in ${langName}`);
      onPlayEnd?.();
    }
  };

  // Size styling
  const sizeClasses = {
    xs: 'p-1 text-3xs',
    sm: 'p-1.5 text-xxs',
    md: 'p-2 text-xs',
    lg: 'px-3 py-2 text-sm',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  // Variant styling
  const variantClasses = {
    ghost: isPlaying
      ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
      : 'text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800',
    subtle: isPlaying
      ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    pill: isPlaying
      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm',
    filled: isPlaying
      ? 'bg-amber-600 text-white'
      : 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-700',
  }[variant];

  const defaultTitle = isPlaying
    ? `Stop listening (${langName})`
    : `Listen to this information aloud in ${langName}`;

  return (
    <button
      type="button"
      onClick={handlePlayToggle}
      disabled={isLoading}
      aria-label={title || defaultTitle}
      title={title || defaultTitle}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 shrink-0 ${sizeClasses} ${variantClasses} ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes} animate-spin text-emerald-500`} />
      ) : isPlaying ? (
        <span className="relative flex items-center justify-center">
          <VolumeX className={`${iconSizes}`} />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
        </span>
      ) : (
        <Volume2 className={`${iconSizes}`} />
      )}

      {label && <span>{isPlaying ? 'Stop' : label}</span>}
    </button>
  );
};
