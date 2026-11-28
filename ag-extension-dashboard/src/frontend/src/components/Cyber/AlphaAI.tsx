import { useState, useRef, useEffect } from 'react';
import { appLocale } from '@/lib/appLocale';
import { scrollListToEnd } from '@/lib/scrollListToEnd';
import { Send, Mic, MicOff, Image as ImageIcon, ShieldCheck, Download, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

import { AgronomicIntakeCard, isAgronomicQueryAmbiguous } from '../AgronomicIntakeCard';
import { nowStamp, drainAlphaOfflineQueue } from './alpha/offlineQueue';
import { type ChatMessageItem, stashQueryOffline, requestAdvisoryMessage, handleAdvisoryFailure, latestAdvisoryText, WELCOME_MESSAGE_ID } from './alpha/response';
import { exportAdvisoryPdf } from './alpha/advisoryExport';
import { isActionEnter } from '@/lib/keyboard';
import { MessageStream } from './alpha/MessageStream';
import { analyzeLeafImage } from './alpha/utils/leafAnalysis';
import { startVoiceCapture } from './alpha/voiceCapture';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { PageHeader } from '@/components/ui/PageHeader';
import { SECONDARY_BUTTON } from '@/components/ui/controlStyles';

const COMPOSER_ICON =
  'h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]';

async function fetchPillarTranscription(base64: string, mimeType: string): Promise<string | null> {
  try {
    const { data } = await apiClient.post('/pillars/voice/transcribe', { audio: base64, mimeType });
    const raw = (data?.data?.transcription || data?.transcription || '').toString().trim();
    if (!raw) return null;
    return raw.replace(/^\[STUB[^\]]*\]\s*/i, '');
  } catch (err) {
    console.warn('[AlphaAI] /pillars/voice/transcribe failed, attempting fallback:', err);
    return null;
  }
}

async function fetchLocalTranscription(base64: string, mimeType: string): Promise<string | null> {
  try {
    const { data } = await apiClient.post('/pillars/voice/transcribe-local', { audio: base64, mimeType });
    const raw = (data?.data?.transcription || data?.transcription || '').toString().trim();
    if (!raw) return null;
    return raw.replace(/^\[STUB[^\]]*\]\s*/i, '');
  } catch (err) {
    console.warn('[AlphaAI] /pillars/voice/transcribe-local failed, attempting fallback:', err);
    return null;
  }
}

async function fetchAiSpeechTranscription(base64: string): Promise<string | null> {
  try {
    const { data } = await apiClient.post<{ success: boolean; data?: { text?: string } }>('/ai/transcribe-audio', {
      audio: base64,
      language: 'sw',
    });
    const text = (data?.data?.text || '').trim();
    return text || null;
  } catch (err) {
    console.warn('[AlphaAI] /ai/transcribe-audio fallback failed:', err);
    return null;
  }
}

/** Transcribe a recorded voice blob via Whisper endpoints with resilient 3-tier fallback; null when unusable. */
async function transcribeVoiceBlob(blob: Blob, mimeType: string): Promise<string | null> {
  if (!blob || blob.size === 0) {
    toast.error('No audio recorded. Please try speaking again.');
    return null;
  }
  const base64 = await new Promise<string | null>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
  if (!base64) {
    toast.error('Could not read audio');
    return null;
  }

  // Tier 1: /pillars/voice/transcribe
  const pillarText = await fetchPillarTranscription(base64, mimeType);
  if (pillarText) return pillarText;

  // Tier 2: /pillars/voice/transcribe-local
  const localText = await fetchLocalTranscription(base64, mimeType);
  if (localText) return localText;

  // Tier 3: /ai/transcribe-audio
  const aiText = await fetchAiSpeechTranscription(base64);
  if (aiText) return aiText;

  toast.error('Voice transcription unavailable — please type your message');
  return null;
}

export const AlphaAI: React.FC = () => {
  const { t } = useLanguage();
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [activeReasoningStep, setActiveReasoningStep] = useState<string | null>(null);
  const [intakeDismissed, setIntakeDismissed] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const handleSendRef = useRef<
    (overrideQuery?: string, opts?: { fromQueue?: boolean }) => Promise<boolean>
  >(async () => false);

  const role = useAppStore(state => state.user?.role);
  const isStaff = role !== 'farmer';

  // A plain greeting (never exported or sent as advice).
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: WELCOME_MESSAGE_ID,
      sender: 'assistant',
      text: t('ai_agronomist_welcome', {
        defaultValue: 'Ask about a crop, a pest, your soil or the weather. Add a photo of the leaf if you have one. Answers list their sources.',
      }),
      timestamp: new Date().toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const { data: kbStats } = useQuery({
    queryKey: ['kb-stats-copilot'],
    queryFn: async () => {
      const { data } = await apiClient.get('/knowledge/stats');
      return data as { data?: { totalDocuments?: number; total?: number } };
    },
    staleTime: 5 * 60_000,
  });
  const guides = kbStats?.data?.totalDocuments ?? kbStats?.data?.total;

  useEffect(() => {
    scrollListToEnd(messagesEndRef.current);
  }, [messages, isProcessing]);

  // Drain offline queue when back online — the sender is read through a ref so the
  // subscription survives re-renders without re-binding the listener.
  useEffect(() => {
    const drain = () => {
      void drainAlphaOfflineQueue(queued => handleSendRef.current(queued, { fromQueue: true }));
    };
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, []);

  /** Returns true when an advisory was delivered, false when it failed/was queued. */
  const handleSendMessage = async (
    overrideQuery?: string,
    opts: { fromQueue?: boolean } = {}
  ): Promise<boolean> => {
    const query = (overrideQuery || inputPrompt).trim();
    if (!query || isProcessing) return false;

    if (isOffline()) {
      if (!opts.fromQueue) stashQueryOffline(query, setMessages);
      setInputPrompt('');
      return false;
    }

    await processMessage(query, opts);
    return true;
  };
  handleSendRef.current = handleSendMessage;

  function isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

  async function processMessage(query: string, opts: { fromQueue?: boolean }): Promise<void> {
    setInputPrompt('');
    appendUserMessage(query);
    setIsProcessing(true);
    setActiveReasoningStep(t('ai_agronomist_thinking', { defaultValue: 'Looking through the guides…' }));

    try {
      const assistantMsg = await requestAdvisoryMessage(query);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      handleSendFailure(err, query, opts);
    } finally {
      setActiveReasoningStep(null);
      setIsProcessing(false);
    }
  }

  function appendUserMessage(text: string): void {
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text, timestamp: nowStamp() } as ChatMessageItem,
    ]);
  }

  function handleSendFailure(err: unknown, query: string, opts: { fromQueue?: boolean }): void {
    if (opts.fromQueue) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'Still unable to reach the advisory service — your queued question will be retried when the connection recovers.',
          timestamp: nowStamp(),
        } as ChatMessageItem,
      ]);
    } else {
      handleAdvisoryFailure(err, query, setMessages);
    }
  }

  const handleVoiceToggle = async () => {
    if (isRecordingVoice) {
      voiceRecorderRef.current?.stop();
      setIsRecordingVoice(false);
      return;
    }
    try {
      const recorder = await startVoiceCapture(async (blob, mimeType) => {
        setActiveReasoningStep(t('ai_agronomist_transcribing', { defaultValue: 'Turning your recording into text…' }));
        try {
          const text = await transcribeVoiceBlob(blob, mimeType);
          if (text) {
            setInputPrompt(text);
            toast.success(`Transcribed: ${text.slice(0, 60)}…`);
          }
        } finally {
          setActiveReasoningStep(null);
        }
      });
      if (!recorder) return;
      voiceRecorderRef.current = recorder;
      setIsRecordingVoice(true);
      toast(t('ai_agronomist_recording_toast', { defaultValue: 'Recording. Tap the microphone again to stop.' }));
    } catch (e) {
      toast.error((e as Error).message || 'Microphone access denied');
    }
  };

  const handleImageUploadSim = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setActiveReasoningStep(t('ai_agronomist_reading_photo', { defaultValue: 'Looking at the photo…' }));
      try {
        const { summary } = await analyzeLeafImage(file);
        setMessages(prev => [
          ...prev,
          { id: `img-${Date.now()}`, sender: 'assistant', text: `**${t('ai_agronomist_photo_result', { defaultValue: 'From the photo' })}:** ${summary}`, timestamp: nowStamp() },
        ]);
      } catch (e) {
        toast.error(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            (e as Error)?.message ||
            'Image analysis failed'
        );
      } finally {
        setActiveReasoningStep(null);
      }
    };
    input.click();
  };


  const handleDispatchSms = async () => {
    const lastAnswer = latestAdvisoryText(messages);
    if (!lastAnswer) {
      toast.error('Ask a question first');
      return;
    }
    try {
      const { useAppStore } = await import('@/store/useAppStore');
      // SMS body limit: 160 GSM-7 chars per segment; keep to ~2 segments and mark truncation.
      const body = lastAnswer.replace(/\*\*/g, '').trim();
      const truncated = body.length > 300 ? `${body.slice(0, 297)}…` : body;
      useAppStore.getState().setPendingSMS({ phone: '', message: truncated });
      const storeTab = (useAppStore.getState() as { setActiveTab?: (t: string) => void })
        .setActiveTab;
      storeTab?.('sms');
      toast(
        truncated.length < body.length
          ? 'Opening the SMS page (the answer was shortened to 300 characters)'
          : 'Opening the SMS page with the last answer'
      );
    } catch {
      toast.error('SMS dispatch requires SMS page');
    }
  };

  const handleExportPdf = () => exportAdvisoryPdf(messages);

  const lastCitations = messages.findLast(m => m.sender === 'assistant' && m.citations?.length)?.citations ?? [];
  const hasAnswer = Boolean(latestAdvisoryText(messages));

  return (
    <div className="space-y-6 pb-20">
      <PageHeader photo="officerScanning"
        title={t('nav_aiassistant', { defaultValue: 'AI agronomist' })}
        description={t('ai_agronomist_description', {
          defaultValue: 'Ask about crops, pests, soil and weather. Check any product dose on its label before use.',
        })}
        meta={
          typeof guides === 'number'
            ? t('ai_agronomist_guides', { count: guides, defaultValue: 'Answers draw on {count} extension guides' })
            : undefined
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section
          aria-label={t('ai_agronomist_conversation', { defaultValue: 'Conversation' })}
          className="lg:col-span-8 bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-4 flex flex-col min-h-[360px] lg:min-h-[520px] max-h-[72dvh]"
        >
          <MessageStream
            messages={messages}
            isProcessing={isProcessing}
            activeReasoningStep={activeReasoningStep}
            messagesEndRef={messagesEndRef}
            youLabel={t('chat_you', { defaultValue: 'You' })}
            assistantLabel={t('nav_aiassistant', { defaultValue: 'AI agronomist' })}
          />
          <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
            {isAgronomicQueryAmbiguous(inputPrompt) && !intakeDismissed && !isProcessing && (
              <AgronomicIntakeCard
                initialQuery={inputPrompt}
                compact={true}
                onApplyIntake={enrichedQuery => {
                  setInputPrompt('');
                  handleSendMessage(enrichedQuery);
                }}
                onBypass={() => {
                  setIntakeDismissed(true);
                  handleSendMessage();
                }}
              />
            )}
            {isRecordingVoice && (
              <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                {t('ai_agronomist_recording', { defaultValue: 'Recording. Tap the microphone again to stop.' })}
              </p>
            )}
            <div className="flex items-end gap-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-900/[0.1] dark:border-white/[0.1] rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-emerald-600">
              <button type="button" onClick={handleImageUploadSim} aria-label={t('ai_agronomist_add_photo', { defaultValue: 'Add a leaf photo' })} className={COMPOSER_ICON}>
                <ImageIcon className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleVoiceToggle}
                aria-pressed={isRecordingVoice}
                aria-label={isRecordingVoice ? t('ai_agronomist_stop_recording', { defaultValue: 'Stop recording' }) : t('ai_agronomist_record', { defaultValue: 'Ask by voice' })}
                className={COMPOSER_ICON}
              >
                {isRecordingVoice ? <MicOff className="w-[18px] h-[18px]" aria-hidden="true" /> : <Mic className="w-[18px] h-[18px]" aria-hidden="true" />}
              </button>
              <textarea
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                onKeyDown={e => {
                  if (isActionEnter(e) && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                aria-label={t('ai_agronomist_question', { defaultValue: 'Your question' })}
                placeholder={t('ai_agronomist_placeholder', { defaultValue: 'For example: lower maize leaves turning yellow after rain' })}
                rows={1}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 outline-none resize-none px-1 py-2 max-h-28"
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputPrompt.trim() || isProcessing}
                aria-label={t('ai_agronomist_send', { defaultValue: 'Send question' })}
                className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-4" aria-label={t('ai_agronomist_sources', { defaultValue: 'Sources' })}>
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-4">
            <h2 className="text-sm font-medium text-slate-900 dark:text-white">{t('ai_agronomist_sources', { defaultValue: 'Sources' })}</h2>
            {lastCitations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
                {t('ai_agronomist_no_sources', { defaultValue: 'The guides behind each answer are listed here.' })}
              </p>
            ) : (
              <ol className="mt-2 space-y-2 text-sm list-decimal list-inside text-slate-700 dark:text-white/80">
                {lastCitations.map((citation, index) => (
                  <li key={`${citation.title}-${index}`}>{citation.title}</li>
                ))}
              </ol>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleExportPdf} disabled={!hasAnswer} className={SECONDARY_BUTTON}>
              <Download className="w-4 h-4" aria-hidden="true" />
              {t('ai_agronomist_export', { defaultValue: 'Save as PDF' })}
            </button>
            {isStaff && (
              <button type="button" onClick={handleDispatchSms} disabled={!hasAnswer} className={SECONDARY_BUTTON}>
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {t('ai_agronomist_send_sms', { defaultValue: 'Send by SMS' })}
              </button>
            )}
          </div>
          <p className="flex gap-2 text-xs text-slate-500 dark:text-white/60">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t('ai_agronomist_safety', {
              defaultValue: 'Answers are checked for unsafe doses and mixtures. A diagnosis from a photo needs confirmation by your officer.',
            })}
          </p>
        </aside>
      </div>
    </div>
  );
};

export default AlphaAI;
