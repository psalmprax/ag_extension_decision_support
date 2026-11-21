import { useState } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { uploadFile } from '@/api/uploadService';
import { saveVoiceClip } from './voiceClipsApi';

const FIELD =
  'h-9 w-full px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600';
const LABEL = 'text-xs text-slate-600 dark:text-white/70';

/** Upload a person's recording (mp3 or wav) for a voice-line prompt or an advisory. */
export function VoiceClipForm({ prompts, onSaved }: { prompts: Record<string, string>; onSaved: () => void }) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState(Object.keys(prompts)[0] ?? 'line_greeting');
  const [advisoryName, setAdvisoryName] = useState('');
  const [language, setLanguage] = useState('sw');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdvisory = key === 'advisory';
  const promptLabels: Record<string, string> = {
    line_greeting: t('voice_prompt_greeting', { defaultValue: 'Voice line: greeting' }),
    line_thanks: t('voice_prompt_thanks', { defaultValue: 'Voice line: thank you' }),
    line_not_registered: t('voice_prompt_not_registered', { defaultValue: 'Voice line: number not registered' }),
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      if (!uploaded.id) throw new Error('upload');
      const finalKey = isAdvisory ? `advisory:${advisoryName}` : key;
      await saveVoiceClip({ key: finalKey, language, title: isAdvisory ? advisoryName : promptLabels[key] ?? key, transcript: transcript || undefined, uploadId: uploaded.id });
      toast.success(t('voice_saved', { defaultValue: 'Recording saved.' }));
      setFile(null);
      setTranscript('');
      onSaved();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? t('voice_save_failed', { defaultValue: 'Could not save the recording. Use an mp3 or wav file.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2" aria-label={t('voice_add', { defaultValue: 'Add a recording' })}>
      <label className={LABEL}>{t('voice_message', { defaultValue: 'Message' })}
        <select value={key} onChange={event => setKey(event.target.value)} className={`${FIELD} mt-1`}>
          {Object.keys(prompts).map(prompt => <option key={prompt} value={prompt}>{promptLabels[prompt] ?? prompt}</option>)}
          <option value="advisory">{t('voice_prompt_advisory', { defaultValue: 'An advisory to call farmers with' })}</option>
        </select>
      </label>
      <label className={LABEL}>{t('voice_language', { defaultValue: 'Language code (sw, ha, am…)' })}
        <input value={language} onChange={event => setLanguage(event.target.value)} required pattern="[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?" className={`${FIELD} mt-1`} />
      </label>
      {isAdvisory && (
        <label className={`${LABEL} sm:col-span-2`}>{t('voice_advisory_name', { defaultValue: 'Advisory name' })}
          <input value={advisoryName} onChange={event => setAdvisoryName(event.target.value)} required minLength={2} className={`${FIELD} mt-1`} />
        </label>
      )}
      {!isAdvisory && prompts[key] && (
        <p className="sm:col-span-2 text-xs text-slate-500 dark:text-white/60">
          {t('voice_read_this', { defaultValue: 'Have a person read this, in the language:' })} “{prompts[key]}”
        </p>
      )}
      <label className={`${LABEL} sm:col-span-2`}>{t('voice_transcript', { defaultValue: 'What the recording says (for staff who do not speak the language)' })}
        <input value={transcript} onChange={event => setTranscript(event.target.value)} className={`${FIELD} mt-1`} />
      </label>
      <label className={`${LABEL} sm:col-span-2`}>{t('voice_file', { defaultValue: 'Recording (mp3 or wav)' })}
        <input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" required onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={!file || busy} className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
          <Upload className="w-4 h-4" aria-hidden="true" />{t('voice_save', { defaultValue: 'Save recording' })}
        </button>
      </div>
    </form>
  );
}
