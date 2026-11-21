import { useCountryCoverage } from '@/hooks/useCountryCoverage';
import { useLanguage } from '@/lib/LanguageContext';

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', sw: 'Kiswahili' };

/** One plain sentence on what works in the chosen country, so nobody signs up expecting more. */
export function CountryCoverageNote({ country }: { country: string }) {
  const { t } = useLanguage();
  const { data } = useCountryCoverage();
  const coverage = data?.find(entry => entry.name === country);
  if (!coverage || !coverage.iso2) return null;
  const sms = coverage.smsLanguages.map(code => LANGUAGE_NAMES[code] ?? code).join(' and ');
  const prices = {
    local_markets: t('coverage_prices_local', { defaultValue: 'local market prices' }),
    national_yearly: t('coverage_prices_national', { defaultValue: 'national yearly producer prices (no local markets yet)' }),
    none: t('coverage_prices_none', { defaultValue: 'no market prices yet' }),
  }[coverage.prices];
  return (
    <p className="text-xs text-white/60 mt-1.5" aria-live="polite">
      {t('coverage_note', {
        country: coverage.name,
        prices,
        sms,
        defaultValue: 'In {country}: weather, soil, satellite crop health and the AI agronomist; {prices}; SMS in {sms}.',
      })}
    </p>
  );
}
