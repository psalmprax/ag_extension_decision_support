import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Layers,
  ShieldCheck,
  Radio,
  Cpu,
  BookOpen,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';
import { DiseaseDiagnosis } from './DiseaseDiagnosis';

export function DiagnosisPage() {
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden flex flex-col"
      role="main"
      aria-label="Crop Disease Diagnosis Clinic"
    >
      {/* ── Top Header Navigation Bar ── */}
      <header className="sticky top-0 left-0 right-0 z-40 px-4 sm:px-6 py-3.5 bg-slate-950/85 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 hover:text-white text-xs font-medium transition-colors group focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label={t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">{t('common_back_to_landing', { defaultValue: 'Back to Landing Page' })}</span>
            <span className="sm:hidden">{t('common_back_to_home', { defaultValue: 'Back to Home' })}</span>
          </Link>

          <div className="hidden md:flex items-center gap-2.5 pl-2 border-l border-white/10">
            <img src="/logo.png" alt="GPExts Logo" className="w-7 h-7 object-contain rounded-md" />
            <div>
              <span className="font-semibold text-sm tracking-tight text-white block leading-none">
                GPExts Crop Doctor
              </span>
              <span className="text-xxs font-mono text-emerald-400 font-medium">
                Free Smallholder Clinic
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <LiquidToggleSwitch compact />
          <LanguageSwitcher compact />
          <Link
            to="/demo"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('login_try_demo', { defaultValue: 'Try Demo' })}</span>
          </Link>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-white text-xs font-medium transition-colors"
          >
            {t('login_title', { defaultValue: 'Sign In' })}
          </Link>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10 space-y-6">
        {/* Welcome & Farmer Assurance Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="p-5 sm:p-6 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm backdrop-blur-xl"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                  <Radio className="w-3 h-3 text-emerald-400" />
                  Crop observations
                </span>
                <span className="text-xxs sm:text-xs text-slate-400 font-mono">
                  Sign in to request an analysis
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Instant Crop Disease &amp; Leaf Pathology Doctor
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                Upload a photo or video, or describe symptoms. Results are suggestions, not confirmed diagnoses; consult a qualified local expert.
              </p>
            </div>

            {/* Quick Guarantees */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full lg:w-auto shrink-0 text-left">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-0.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Online analysis</span>
                </div>
                <div className="text-[10px] text-slate-400">Requires a configured service</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-bold mb-0.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Reference library</span>
                </div>
                <div className="text-[10px] text-slate-400">Not a verified diagnosis</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Expert review</span>
                </div>
                <div className="text-[10px] text-slate-400">Confirm before treatment</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* The Diagnostic Component */}
        <DiseaseDiagnosis />
      </main>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-white/5 py-6 px-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} GPExts Decision Support. Free agronomic diagnostics for smallholder farmers.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/" className="hover:text-white transition-colors">
              {t('common_back_to_landing', { defaultValue: 'Landing Page' })}
            </Link>
            <span>•</span>
            <Link to="/demo" className="hover:text-white transition-colors">
              Live Demo
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition-colors">
              Extension Officer Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DiagnosisPage;
