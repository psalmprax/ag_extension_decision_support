import type { PartnerRecording } from './partnersApi';
import { appLocale } from '@/lib/appLocale';

/** Who made a recording and on what terms; shown wherever the recording is. */
export function RecordingCredit({ recording }: { recording: PartnerRecording }) {
  const expires = recording.licenceExpiresAt ? new Date(recording.licenceExpiresAt).toLocaleDateString(appLocale()) : null;
  return (
    <p className="text-xs text-slate-600 dark:text-white/60">
      {recording.speaker}, {recording.partner} · {recording.language.toUpperCase()}
      {recording.crops.length > 0 && ` · ${recording.crops.join(', ')}`}
      {` · ${recording.licence}`}
      {expires && ` (until ${expires})`}
    </p>
  );
}
