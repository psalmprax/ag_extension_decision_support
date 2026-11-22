import { useCallback, useEffect, useState } from 'react';
import { PhoneCall, Trash2, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { fetchPilots, type Pilot } from '@/components/pilots/pilotsApi';
import { VoiceClipForm } from './VoiceClipForm';
import { callWithClip, deleteVoiceClip, fetchVoiceLibrary, type VoiceLibrary } from './voiceClipsApi';

const ICON_BUTTON = 'h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.08]';

/**
 * Recordings in farmers' languages: the voice line's prompts, and advisories that can be
 * played to a pilot's farmers by phone. Without a recording, callers hear English.
 */
export function VoiceLibrarySection({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const role = useAppStore(state => state.user?.role);
  const allowed = role === 'admin' || role === 'regional_manager';
  const [library, setLibrary] = useState<VoiceLibrary | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);

  const load = useCallback(async () => {
    try {
      const [voice, pilotList] = await Promise.all([fetchVoiceLibrary(), fetchPilots()]);
      setLibrary(voice);
      setPilots(pilotList.filter(pilot => pilot.status === 'running'));
    } catch {
      toast.error(t('voice_load_failed', { defaultValue: 'Could not load the recordings.' }));
    }
  }, [t]);

  useEffect(() => { if (active && allowed) void load(); }, [active, allowed, load]);
  if (!allowed) return null;

  const call = async (clipId: string, pilotId: string) => {
    try {
      const result = await callWithClip(clipId, pilotId);
      toast.success(t('voice_called', { queued: result.queued, skipped: result.skipped, defaultValue: 'Calling {queued} farmers. {skipped} calls could not be placed.' }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('voice_call_failed', { defaultValue: 'Could not place the calls.' })));
    }
  };

  const remove = async (clipId: string) => {
    try {
      await deleteVoiceClip(clipId);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('voice_delete_failed', { defaultValue: 'Could not delete the recording.' })));
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="voice-library-heading">
      <h3 id="voice-library-heading" className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
        {t('voice_heading', { defaultValue: 'Recordings in farmers’ languages' })}
      </h3>
      <div className="p-4 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] space-y-4">
        <p className="text-sm text-slate-600 dark:text-white/70">
          {t('voice_intro', { defaultValue: 'Callers to the voice line hear these instead of the provider’s English voice. Advisories can be played to a running pilot’s service group by phone.' })}
          {library && !library.callingConfigured && ` ${t('voice_calling_off', { defaultValue: 'Calling farmers is not set up on this server yet.' })}`}
        </p>
        {library && (
          <>
            {library.clips.length > 0 && (
              <ul className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
                {library.clips.map(clip => (
                  <li key={clip.id} className="py-2 flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 dark:text-white">{clip.title} <span className="text-slate-500">({clip.language})</span></p>
                      {clip.transcript && <p className="text-xs text-slate-500 dark:text-white/60 truncate">{clip.transcript}</p>}
                    </div>
                    <audio src={clip.url} controls preload="none" className="h-8 max-w-[14rem]" aria-label={`${clip.title}, ${clip.language}`} />
                    {clip.key.startsWith('advisory:') && library.callingConfigured && pilots.map(pilot => (
                      <button key={pilot.id} type="button" className="h-8 px-2 inline-flex items-center gap-1 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] text-xs"
                        onClick={() => { void call(clip.id, pilot.id); }}>
                        <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />{t('voice_call_pilot', { name: pilot.name, defaultValue: 'Call {name}' })}
                      </button>
                    ))}
                    {clip.canChange && (
                      <button type="button" className={ICON_BUTTON} aria-label={t('voice_delete', { title: clip.title, defaultValue: 'Delete {title}' })}
                        onClick={() => { void remove(clip.id); }}>
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <VoiceClipForm prompts={library.prompts} onSaved={() => { void load(); }} />
          </>
        )}
      </div>
    </section>
  );
}
