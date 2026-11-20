import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { DiseaseDiagnosis } from './DiseaseDiagnosis';

export function DiagnosisPage() {
  const { t } = useLanguage();

  return (
    <div
      className="dark surface-dark min-h-screen bg-[#0d1a14] text-[#e6eee9] relative overflow-x-hidden flex flex-col"
      role="main"
      aria-label="Crop Disease Diagnosis Clinic"
    >
      {/* ── Top Header Navigation Bar ── */}
      <header className="sticky top-0 start-0 end-0 z-40 px-4 sm:px-6 h-16 bg-[#0d1a14] border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-[#c5d3cb] hover:text-white hover:bg-white/[0.06] text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={t('common_back_to_landing', { defaultValue: 'Back to landing page' })}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to landing page' })}</span>
            <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to home' })}</span>
          </Link>

          <div className="hidden md:flex items-center gap-2.5 ps-2 border-s border-white/10">
            <img src="/logo.png" alt="GPExts Logo" className="w-7 h-7 object-contain rounded-md" />
            <div>
              <span className="text-sm font-medium text-white block leading-none">
                {t('ui_diagnosis_page_gpexts_crop_doctor')}
              </span>
              <span className="text-xs text-[#9db2a6]">
                {t('ui_diagnosis_page_free_smallholder_clinic')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <LanguageSwitcher compact />
          <Link
            to="/demo"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-white/[0.16] text-[#e6eee9] hover:bg-white/[0.06] text-sm transition-colors"
          >
            <span>{t('login_try_demo', { defaultValue: 'Try Demo' })}</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            {t('login_title', { defaultValue: 'Sign In' })}
          </Link>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10 space-y-6">
        {/* What the clinic can and cannot do, before the tool itself. */}
        <p className="text-sm text-[#9db2a6] max-w-3xl">
          {t('diagnosis_public_terms', {
            defaultValue: 'Free for farmers. Sign in to request an analysis. Results are possible causes, not a diagnosis: confirm with an extension officer before you treat.',
          })}
        </p>

        {/* The Diagnostic Component */}
        <DiseaseDiagnosis />
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-white/5 py-6 px-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {t('ui_diagnosis_page_gpexts_decision_support_free_agronom')}</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/" className="hover:text-white transition-colors">
              {t('common_back_to_landing', { defaultValue: 'Landing Page' })}
            </Link>
            <span>•</span>
            <Link to="/demo" className="hover:text-white transition-colors">
              {t('ui_diagnosis_page_live_demo')}
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition-colors">
              {t('ui_diagnosis_page_extension_officer_sign_in')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DiagnosisPage;
