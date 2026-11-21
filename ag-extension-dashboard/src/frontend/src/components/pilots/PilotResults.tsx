import { useLanguage } from '@/lib/LanguageContext';
import type { ArmResult, PilotDetail } from './pilotsApi';

const number = (value: number | null, unit = '') => (value === null ? '—' : `${value.toLocaleString()}${unit}`);
const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

/** The two groups side by side, and the difference with its range, said plainly. */
export function PilotResults({ detail }: { detail: PilotDetail }) {
  const { t } = useLanguage();
  const { service, comparison, difference, tooEarly } = detail.results;
  const rows: Array<{ label: string; value: (arm: ArmResult) => string }> = [
    { label: t('pilot_row_farmers', { defaultValue: 'Farmers' }), value: arm => number(arm.farmers) },
    { label: t('pilot_row_both', { defaultValue: 'Reported both harvests' }), value: arm => number(arm.withBothHarvests) },
    { label: t('pilot_row_before', { defaultValue: 'Last season, kg/ha' }), value: arm => number(arm.baselineKgPerHa) },
    { label: t('pilot_row_after', { defaultValue: 'This season, kg/ha' }), value: arm => number(arm.endlineKgPerHa) },
    { label: t('pilot_row_change', { defaultValue: 'Average change, kg/ha' }), value: arm => number(arm.meanChangeKgPerHa) },
    { label: t('pilot_row_reply', { defaultValue: 'Median time to an answer' }), value: arm => number(arm.medianReplyMinutes, ' min') },
    {
      label: t('pilot_row_followed', { defaultValue: 'Said they followed the advice (fully / partly)' }),
      value: arm => (arm.followups.asked ? `${share(arm.followups.yes, arm.followups.asked)} / ${share(arm.followups.partly, arm.followups.asked)} of ${arm.followups.asked}` : '—'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500 dark:text-white/60">
            <tr>
              <th className="py-2 pe-4 text-start font-normal" />
              <th className="py-2 pe-4 text-end font-normal">{t('pilot_group_service', { defaultValue: 'Service group' })}</th>
              <th className="py-2 text-end font-normal">{t('pilot_group_comparison', { defaultValue: 'Comparison group' })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">
            {rows.map(row => (
              <tr key={row.label}>
                <th scope="row" className="py-2 pe-4 text-start font-normal text-slate-700 dark:text-white/80">{row.label}</th>
                <td className="py-2 pe-4 text-end tabular-nums">{row.value(service)}</td>
                <td className="py-2 text-end tabular-nums">{row.value(comparison)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-700 dark:text-white/80" role="status">
        {difference
          ? t('pilot_difference', {
            diff: difference.kgPerHa.toLocaleString(), low: difference.low.toLocaleString(), high: difference.high.toLocaleString(),
            defaultValue: 'The service group’s harvest changed by {diff} kg/ha more than the comparison group’s (95% range {low} to {high}).',
          })
          : t('pilot_no_difference', { defaultValue: 'No difference to show yet: both groups need farmers who reported both harvests.' })}
        {tooEarly && ` ${t('pilot_too_early', { count: detail.minPerGroup, defaultValue: 'Too early to draw a conclusion: each group needs at least {count} farmers with both harvests.' })}`}
      </p>
      <p className="text-xs text-slate-500 dark:text-white/60">
        {t('pilot_method_note', { defaultValue: 'Harvests are what farmers report by SMS; yields leave out farms without a recorded size. Have an independent evaluator check the method and the final numbers before you publish them.' })}
      </p>
    </div>
  );
}
