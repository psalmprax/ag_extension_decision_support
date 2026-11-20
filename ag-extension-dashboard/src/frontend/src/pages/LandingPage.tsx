import { useMotionValue } from 'framer-motion';
import { Navbar } from './landing/sections/Navbar';
import { Hero } from './landing/sections/Hero';
import { FarmerServices } from './landing/sections/FarmerServices';
import { HowItWorks } from './landing/sections/HowItWorks';
import { Features } from './landing/sections/Features';
import { TrustAndSafety } from './landing/sections/TrustAndSafety';
import { TalkingAssistant } from './landing/sections/TalkingAssistant';
import { FAQ } from './landing/sections/FAQ';
import { CTA } from './landing/sections/CTA';
import { Footer } from './landing/sections/Footer';
import { useLanguage } from '@/lib/LanguageContext';

// ─── Main component ─────────────────────────────────────────────
// One dark page, eight sections: what farmers get, how it works, who it is
// for, how it stays safe, questions, and one call to action. No ambient
// motion: the hero carries the page.
export function LandingPage() {
  const { t } = useLanguage();
  // Hero accepts motion values for an optional scroll effect; the page holds
  // it still.
  const heroY = useMotionValue(0);
  const heroOpacity = useMotionValue(1);

  return (
    <div className="dark surface-dark relative min-h-screen bg-[#0d1a14] text-[#e6eee9] overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-emerald-700 focus:text-white focus:text-sm focus:rounded-md focus:ring-2 focus:ring-white focus:outline-none"
      >
        {t('skip_to_main_content')}
      </a>

      <Navbar />

      <main id="main-content">
        <Hero heroY={heroY} heroOpacity={heroOpacity} />
        <FarmerServices />
        <HowItWorks />
        <Features />
        <TrustAndSafety />
        <FAQ />
        <CTA />
      </main>

      <Footer />
      <TalkingAssistant />
    </div>
  );
}

export default LandingPage;
