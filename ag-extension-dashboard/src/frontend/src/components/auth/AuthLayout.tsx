import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';

interface AuthLayoutProps {
  /** Accessible name of the page region, e.g. "Login page". */
  label: string;
  /** Large line on the photo panel (desktop only). */
  headline: string;
  /** One supporting sentence under the headline. */
  body: string;
  /** Wider form column for longer forms (registration). */
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * Shared frame for sign-in and registration: the dark field-green page, a
 * back link and language switcher, a field photo with one plain sentence on
 * who the product serves (desktop), and the form beside it.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ label, headline, body, wide, children }) => {
  const { t } = useLanguage();
  return (
    <div
      className="dark surface-dark min-h-[100dvh] bg-[#0d1a14] text-[#e6eee9] flex items-center justify-center p-4 sm:p-6 relative overflow-y-auto overflow-x-hidden"
      role="main"
      aria-label={label}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <img
          src="/images/landing/maize-field-sunrise.webp"
          alt=""
          width={1319}
          height={860}
          className="w-full h-full object-cover object-center opacity-40"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[#0d1a14]/85" />
      </div>

      <header className="absolute top-0 start-0 end-0 z-30 p-4 sm:p-6 flex items-center justify-between pointer-events-none">
        <Link
          to="/"
          className="pointer-events-auto inline-flex items-center gap-2 h-9 px-3 rounded-md text-[#c5d3cb] hover:text-white hover:bg-white/[0.06] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={t('common_back_to_landing', { defaultValue: 'Back to landing page' })}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to landing page' })}</span>
          <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to home' })}</span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <LanguageSwitcher compact />
        </div>
      </header>

      <div
        className={`w-full ${wide ? 'max-w-xl lg:max-w-6xl' : 'max-w-md lg:max-w-5xl'} grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10 my-auto pt-16 pb-8 sm:py-6`}
      >
        <div
          className={`hidden lg:flex ${wide ? 'lg:col-span-5' : 'lg:col-span-6'} flex-col justify-between rounded-lg overflow-hidden relative self-stretch min-h-[520px] border border-white/[0.08]`}
        >
          <img
            src="/images/landing/officer-farmer-hero-1024.webp"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a14] via-[#0d1a14]/50 to-[#0d1a14]/30" />
          <div className="relative flex items-center gap-2.5 p-7">
            <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
            <span className="text-base font-medium text-white">{t('app_title')}</span>
          </div>
          <div className="relative p-7">
            <p className="text-2xl font-medium leading-snug text-white max-w-sm">{headline}</p>
            <p className="text-sm text-[#c5d3cb] mt-3 max-w-sm">{body}</p>
          </div>
        </div>

        <div className={`${wide ? 'lg:col-span-7' : 'lg:col-span-6'} self-stretch flex`}>{children}</div>
      </div>
    </div>
  );
};
