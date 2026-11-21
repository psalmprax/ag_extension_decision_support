import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Shield, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const FOOTER_LINK = 'text-[#9db2a6] hover:text-white transition-colors';

/** Footer anchors: the landing sections that exist, in page order. */
const FOOTER_SECTION_LINKS = [
  { href: '#services', labelKey: 'ui_navbar_services', fallback: 'Services' },
  { href: '#how-it-works', labelKey: 'ui_footer_how_it_works', fallback: 'How it works' },
  { href: '#features', labelKey: 'ui_navbar_built_for_fields', fallback: 'Who it is for' },
  { href: '#trust-safety', labelKey: 'ui_navbar_trust_safety', fallback: 'Trust & safety' },
  { href: '#faq', labelKey: 'ui_navbar_faq', fallback: 'FAQ' },
] as const;

export function Footer() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
        <footer id="contact" className="border-t border-white/[0.08] pt-12 sm:pt-16 pb-8 relative z-10">
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 sm:gap-10 pb-8 sm:pb-10">
            <div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-3 mb-4 cursor-pointer group text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
              >
                <img
                  src="/logo.png"
                  alt="GPExts Logo"
                  width={36}
                  height={36}
                  className="w-7 h-7 object-contain"
                />
                <span className="text-base font-medium text-white">{t('app_title')}</span>
              </button>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs mb-4 font-normal break-words">
                {t('ui_footer_empowering_agricultural_extension_of')}
              </p>
              <a
                href="mailto:info@gpfed.com"
                className="inline-flex items-center gap-2 text-sm text-[#e6eee9] hover:text-white transition-colors"
              >
                <Mail className="w-4 h-4" />
                {t('ui_demo_page_info_gpfed_com')}
              </a>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-4">
                {t('ui_footer_product_features')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-sm">
                {FOOTER_SECTION_LINKS.map(link => (
                  <li key={link.href}>
                    <a href={link.href} className={FOOTER_LINK}>
                      {t(link.labelKey, { defaultValue: link.fallback })}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-4">
                {t('ui_footer_overview_contact')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/demo')}
                    className={`${FOOTER_LINK} text-start`}
                  >
                    {t('ui_footer_live_interactive_demo')}
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:info@gpfed.com"
                    className={FOOTER_LINK}
                  >
                    {t('ui_demo_page_info_gpfed_com')}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-4">
                {t('ui_demo_page_get_started')}
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className={`${FOOTER_LINK} text-start`}
                  >
                    {t('register_button')}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className={`${FOOTER_LINK} text-start`}
                  >
                    {t('login_sign_in')}
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-center sm:text-start">
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
                className="absolute inset-0 bg-[#0d1a14]/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] bg-white/[0.03] border border-white/10 rounded-xl p-4 sm:p-8 shadow-2xl overflow-y-auto space-y-4 sm:space-y-6 z-10"
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
