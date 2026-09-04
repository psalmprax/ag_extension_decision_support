import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Layers, Menu, X, Sparkles } from 'lucide-react';
import { LiquidToggleSwitch } from '@/components/canvasui/LiquidToggleSwitch';

export function Navbar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/75 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-[90rem] w-full mx-auto px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
          >
            <img src="/logo.png" alt="GPExts Logo" width={36} height={36} className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform" />
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-300 transition-colors">GPExts</span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#problem"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Why Us
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#agent-os"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Agent OS
            </a>
            <a
              href="#interactive-story"
              className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              3D Pipeline
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href="#capabilities"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Ecosystem
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              FAQ
            </a>
            <a
              href="#contact"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>

          <div className="flex items-center gap-3">
            <LiquidToggleSwitch compact className="hidden sm:flex" />
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:inline-flex text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-semibold bg-white/[0.08] border border-white/[0.12] text-white rounded-lg hover:bg-white/[0.16] transition-all backdrop-blur-sm shadow-sm"
            >
              Get Started
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-white/[0.08] px-6 py-5 space-y-4"
            >
              <div className="flex flex-col space-y-3">
                {[
                  { label: 'Why Us', href: '#problem' },
                  { label: 'Features', href: '#features' },
                  { label: 'Agent OS (Goal Mode)', href: '#agent-os' },
                  { label: '3D Agro Pipeline', href: '#interactive-story' },
                  { label: 'How It Works', href: '#how-it-works' },
                  { label: 'Ecosystem & Soil Telemetry', href: '#capabilities' },
                  { label: 'Frequently Asked Questions', href: '#faq' },
                  { label: 'Contact', href: '#contact' },
                ].map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium text-white/75 hover:text-emerald-400 transition-colors py-1 flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <ArrowRight className="w-4 h-4 text-white/30" />
                  </a>
                ))}
              </div>
              <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-2.5">
                <div className="pb-1">
                  <LiquidToggleSwitch className="w-full justify-between py-2" />
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-2.5 text-sm font-medium text-white/80 hover:text-white bg-white/[0.05] border border-white/[0.08] rounded-xl text-center"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/register');
                  }}
                  className="relative group overflow-hidden w-full py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 border border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.55)] active:scale-[0.98] transition-all duration-300 text-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <span className="relative z-10">Get Started</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
  );
}
