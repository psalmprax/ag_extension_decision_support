import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { PartnerAdmin } from './PartnerAdmin';
import { RecordingReviewList } from './RecordingReviewList';
import { RecordingLibraryList } from './RecordingLibraryList';

const CARD = 'bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4';
const H3 = 'text-sm font-medium text-slate-900 dark:text-white';

/**
 * Recordings by partners' agronomists. The administrator imports them; administrators and
 * regional managers check each transcript before it is used; officers send approved ones.
 */
export function PartnerLibraryPanel() {
  const role = useAppStore(state => state.user?.role);
  const [refreshKey, setRefreshKey] = useState(0);
  if (role !== 'admin' && role !== 'regional_manager' && role !== 'extension_officer') return null;
  const reviewer = role === 'admin' || role === 'regional_manager';
  const refresh = () => setRefreshKey(key => key + 1);

  return (
    <section className={CARD} aria-labelledby="partner-library-heading">
      <div>
        <h2 id="partner-library-heading" className="text-base font-medium text-slate-900 dark:text-white">Partner recordings</h2>
        <p className="text-sm text-slate-600 dark:text-white/70">
          Advice recorded by agronomists of partner organisations, credited to them. A recording is used in answers and can be
          sent to farmers only after its transcript has been checked.
        </p>
      </div>
      {role === 'admin' && (
        <details>
          <summary className={`${H3} cursor-pointer`}>Content partners and imports</summary>
          <div className="pt-3"><PartnerAdmin onChanged={refresh} /></div>
        </details>
      )}
      {reviewer && (
        <div className="space-y-2">
          <h3 className={H3}>Waiting for review</h3>
          <RecordingReviewList refreshKey={refreshKey} />
        </div>
      )}
      <div className="space-y-2">
        <h3 className={H3}>Approved recordings</h3>
        <RecordingLibraryList refreshKey={refreshKey} />
      </div>
    </section>
  );
}
