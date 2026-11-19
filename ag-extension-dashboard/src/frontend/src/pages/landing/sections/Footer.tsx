import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Shield, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export function Footer() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
        <footer id="contact" className="border-t border-white/10 pt-12 sm:pt-16 pb-8 bg-slate-950/70 backdrop-blur-sm relative z-10">
          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 sm:gap-10 pb-8 sm:pb-10">
            <div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-3 mb-4 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
              >
                <img
                  src="/logo.png"
                  alt="GPExts Logo"
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform"
                />
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">{t('app_title')}</span>
              </button>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs mb-4 font-normal break-words">
                {t('ui_footer_empowering_agricultural_extension_of')}
              </p>
              <a
                href="mailto:info@gpfed.com"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200 active:scale-[0.98] transition-colors bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 rounded-xl"
              >
                <Mail className="w-4 h-4" />
                {t('ui_demo_page_info_gpfed_com')}
              </a>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 mb-4 sm:mb-5">
                {t('ui_footer_product_features')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <a
                    href="#features"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('billing_features')}
                  </a>
                </li>
                <li>
                  <a
                    href="#agent-os"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_goal_mode_campaign_modal_agent_os')}
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_how_it_works')}
                  </a>
                </li>
                <li>
                  <a
                    href="#capabilities"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_ecosystem_soil')}
                  </a>
                </li>
                <li>
                  <a
                    href="#architecture"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_architecture')}
                  </a>
                </li>
                <li>
                  <a
                    href="#roi"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_impact_roi')}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-slate-300 hover:text-emerald-300 font-medium transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 mb-4 sm:mb-5">
                {t('ui_footer_overview_contact')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <a
                    href="#problem"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_why_us')}
                  </a>
                </li>
                <li>
                  <a
                    href="#mission"
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors"
                  >
                    {t('ui_footer_our_mission')}
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/demo')}
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors text-left"
                  >
                    {t('ui_footer_live_interactive_demo')}
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:info@gpfed.com"
                    className="text-emerald-300 hover:text-emerald-200 transition-colors font-semibold"
                  >
                    {t('ui_demo_page_info_gpfed_com')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 mb-4 sm:mb-5">
                {t('ui_demo_page_get_started')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors text-left"
                  >
                    {t('register_button')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-slate-300 hover:text-emerald-300 font-medium transition-colors text-left"
                  >
                    {t('login_sign_in')}
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-center sm:text-left">
            <span className="text-xs sm:text-sm text-slate-300 font-normal">
              {t('ui_footer_copy')} {new Date().getFullYear()} {t('ui_footer_gpexts_all_rights_reserved')}
            </span>
            <div className="flex flex-wrap justify-center sm:justify-end gap-4 sm:gap-5 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
              >
                {t('ui_footer_privacy_policy')}
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-slate-300 hover:text-emerald-300 transition-colors cursor-pointer font-medium"
              >
                {t('ui_footer_terms_of_service')}
              </button>
            </div>
          </div>
        </footer>

        {/* ── Legal Policy Modal ── */}
        <AnimatePresence>
          {legalModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLegalModal(null)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] bg-slate-900 border border-white/10 rounded-xl p-4 sm:p-8 shadow-2xl overflow-y-auto space-y-4 sm:space-y-6 z-10"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 sm:pb-4 gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm sm:text-lg font-bold text-white truncate">
                      {legalModal === 'privacy' ? 'Privacy Policy & Data Sovereignty' : 'Terms of Service'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] active:scale-[0.98] transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {legalModal === 'privacy' ? (
                  <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-normal break-words">
                    <p>
                      <strong className="text-white">{t('ui_footer_1_data_ownership_ocap_compliance')}</strong> {t('ui_footer_your_organization_retains_100_legal')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_2_encryption_standards')}</strong> {t('ui_footer_all_data_is_encrypted_at_rest_using')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_3_offline_first_caching')}</strong> {t('ui_footer_agronomic_manuals_and_farmer_logs_ca')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_4_external_telemetry')}</strong> {t('ui_footer_integrations_with_nasa_power_weather')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_5_right_to_erasure_portability')}</strong> {t('ui_footer_administrators_can_export_full_tenan')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-normal break-words">
                    <p>
                      <strong className="text-white">{t('ui_footer_1_purpose_agricultural_decision_supp')}</strong> {t('ui_footer_gpexts_provides_agronomic_insights_s')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_2_account_responsibility')}</strong> {t('ui_footer_organizations_are_responsible_for_ma')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_3_offline_pwa_usage')}</strong> {t('ui_footer_the_progressive_web_app_pwa_operates')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_4_service_availability_telemetry_sla')}</strong> {t('ui_footer_while_core_platform_operations_featu')}
                    </p>
                    <p>
                      <strong className="text-white">{t('ui_footer_5_institutional_inquiries')}</strong> {t('ui_footer_for_multi_district_deployment_contra')} <a href="mailto:info@gpfed.com" className="text-emerald-400 hover:underline">{t('ui_demo_page_info_gpfed_com')}</a>.
                    </p>
                  </div>
                )}

                <div className="pt-3 sm:pt-4 border-t border-white/[0.08] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-colors"
                  >
                    {t('common_close')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </>
  );
}
