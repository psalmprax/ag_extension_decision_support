import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const TALKING_ASSISTANT_HASH = '#talking-assistant';

/** Section anchors on the landing page, in page order. */
const NAV_LINKS = [
  { href: '#services', labelKey: 'ui_navbar_services', fallback: 'Services' },
  { href: '#how-it-works', labelKey: 'ui_footer_how_it_works', fallback: 'How it works' },
  { href: '#features', labelKey: 'ui_navbar_built_for_fields', fallback: 'Who it is for' },
  { href: '#trust-safety', labelKey: 'ui_navbar_trust_safety', fallback: 'Trust & safety' },
  { href: TALKING_ASSISTANT_HASH, labelKey: 'ui_navbar_voice_advisor', fallback: 'Voice advisor' },
  { href: '#faq', labelKey: 'ui_navbar_faq', fallback: 'FAQ' },
] as const;

export function Navbar() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // The voice advisor is a floating panel, not a section: open it in place.
  const handleLinkClick = (e: React.MouseEvent, href: string) => {
    setMobileMenuOpen(false);
    if (href !== TALKING_ASSISTANT_HASH) return;
    e.preventDefault();
    window.location.hash = 'talking-assistant';
    window.dispatchEvent(new CustomEvent('open-talking-assistant'));
  };

  const links = NAV_LINKS.map(link => ({ ...link, label: t(link.labelKey, { defaultValue: link.fallback }) }));

  return (
    <nav className="fixed top-0 start-0 end-0 z-50 bg-[#0d1a14]/90 backdrop-blur border-b border-white/[0.08]">
      <div className="max-w-6xl w-full mx-auto px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 text-start rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <img src="/logo.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
          <span className="text-base font-medium text-white">{t('app_title')}</span>
        </button>

        <div className="hidden md:flex items-center gap-6">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={e => handleLinkClick(e, link.href)}
              className="text-sm text-[#9db2a6] hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="hidden sm:inline-flex h-9 items-center px-3 text-sm text-[#9db2a6] hover:text-white transition-colors"
          >
            {t('login_sign_in')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            {t('ui_demo_page_get_started')}
          </button>
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-md text-[#9db2a6] hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden bg-[#0d1a14] border-b border-white/[0.08] px-6 py-4"
          >
            <div className="flex flex-col">
              {links.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={e => handleLinkClick(e, link.href)}
                  className="py-2.5 text-base text-[#e6eee9] hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="pt-4 mt-2 border-t border-white/[0.08]">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full h-10 text-sm text-[#e6eee9] border border-white/[0.12] rounded-md"
              >
                {t('login_sign_in')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
