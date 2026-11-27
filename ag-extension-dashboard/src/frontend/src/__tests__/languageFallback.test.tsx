import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext';

function Match() {
  const { t } = useLanguage();
  return (
    <>
      <p>{t('kb_no_such_key_for_this_test', { defaultValue: '{percent}% match to your question', percent: 82 })}</p>
      <p>{t('kb_no_such_key_or_default_{count}', { count: 3 })}</p>
    </>
  );
}

describe('translation fallbacks', () => {
  it('fill in their placeholders like a found translation does', async () => {
    render(<LanguageProvider><Match /></LanguageProvider>);
    expect(await screen.findByText('82% match to your question')).toBeInTheDocument();
    expect(screen.getByText('kb_no_such_key_or_default_3')).toBeInTheDocument();
  });
});
