import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Shield, X } from 'lucide-react';

export function Footer() {
  const navigate = useNavigate();
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
        <footer id="contact" className="border-t border-white/[0.04] pt-12 sm:pt-16 pb-8">
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
                  className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform"
                />
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">GPExts</span>
              </button>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed max-w-xs mb-4 font-normal break-words">
                Empowering agricultural extension officers with AI-driven decision support across
                the Globe.
              </p>
              <a
                href="mailto:info@gpfed.com"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 active:scale-[0.98] transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl"
              >
                <Mail className="w-4 h-4" />
                info@gpfed.com
              </a>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4 sm:mb-5">
                Product &amp; Features
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <a
                    href="#features"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#agent-os"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Agent OS
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#capabilities"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Ecosystem &amp; Soil
                  </a>
                </li>
                <li>
                  <a
                    href="#architecture"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Architecture
                  </a>
                </li>
                <li>
                  <a
                    href="#roi"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Impact &amp; ROI
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-white/60 hover:text-emerald-400 transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4 sm:mb-5">
                Overview &amp; Contact
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <a
                    href="#problem"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Why Us
                  </a>
                </li>
                <li>
                  <a
                    href="#mission"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Our Mission
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/demo')}
                    className="text-white/60 hover:text-emerald-400 transition-colors text-left"
                  >
                    Live Interactive Demo
                  </button>
                </li>
                <li>
                  <a
                    href="mailto:info@gpfed.com"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
                  >
                    info@gpfed.com
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4 sm:mb-5">
                Get Started
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-normal">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-white/60 hover:text-emerald-400 transition-colors text-left"
                  >
                    Create Account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-white/60 hover:text-emerald-400 transition-colors text-left"
                  >
                    Sign In
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-center sm:text-left">
            <span className="text-[11px] sm:text-xs text-white/40 font-normal">
              &copy; {new Date().getFullYear()} GPExts. All rights reserved.
            </span>
            <div className="flex flex-wrap justify-center sm:justify-end gap-4 sm:gap-5 text-xs">
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-white/40 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-white/40 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Terms of Service
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
                  <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-white/70 leading-relaxed font-normal break-words">
                    <p>
                      <strong className="text-white">1. Data Ownership &amp; OCAP Compliance:</strong> Your organization retains 100% legal ownership and control of all farmer registries, field visit logs, geospatial coordinates, and diagnostic imagery. GPExts strictly adheres to the OCAP (Ownership, Control, Access, and Possession) principles.
                    </p>
                    <p>
                      <strong className="text-white">2. Encryption Standards:</strong> All data is encrypted at rest using AES-256 and in transit via TLS 1.3. Tenant databases are strictly isolated to prevent cross-organizational data leakage.
                    </p>
                    <p>
                      <strong className="text-white">3. Offline-First Caching:</strong> Agronomic manuals and farmer logs cached on field officer devices remain encrypted locally and synchronize securely upon cellular re-connection with conflict-free cryptographic reconciliation.
                    </p>
                    <p>
                      <strong className="text-white">4. External Telemetry:</strong> Integrations with NASA POWER weather and SoilGrids ISRIC querying only submit bounding GPS coordinates to fetch environmental telemetry, and never transmit identifying personal farmer records.
                    </p>
                    <p>
                      <strong className="text-white">5. Right to Erasure &amp; Portability:</strong> Administrators can export full tenant datasets as encrypted JSON/CSV archives or trigger audited record erasure at any time via the User Management and System Settings panel.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-white/70 leading-relaxed font-normal break-words">
                    <p>
                      <strong className="text-white">1. Purpose &amp; Agricultural Decision Support:</strong> GPExts provides agronomic insights, soil recommendations, and disease diagnostics for agricultural extension officers and institutions. Recommendations are designed to support, not replace, certified agronomic judgment.
                    </p>
                    <p>
                      <strong className="text-white">2. Account Responsibility:</strong> Organizations are responsible for maintaining the confidentiality of officer authentication tokens and assigning appropriate Role-Based Access Control (RBAC) permissions.
                    </p>
                    <p>
                      <strong className="text-white">3. Offline &amp; PWA Usage:</strong> The Progressive Web App (PWA) operates in disconnected environments; officers are responsible for periodic syncing to ensure institutional records remain updated.
                    </p>
                    <p>
                      <strong className="text-white">4. Service Availability &amp; Telemetry SLAs:</strong> While core platform operations feature 99.9% uptime and offline continuity, third-party satellite telemetry availability (e.g. NASA POWER) depends on upstream agency feeds.
                    </p>
                    <p>
                      <strong className="text-white">5. Institutional Inquiries:</strong> For multi-district deployment contracts or custom data hosting terms, please contact <a href="mailto:info@gpfed.com" className="text-emerald-400 hover:underline">info@gpfed.com</a>.
                    </p>
                  </div>
                )}

                <div className="pt-3 sm:pt-4 border-t border-white/[0.08] flex justify-end">
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 active:scale-[0.98] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </>
  );
}
