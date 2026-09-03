import React, { useState, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { LiquidBackgroundCanvas } from '@/components/canvasui/LiquidBackgroundCanvas';
import { AgroStorytellingSection } from '@/components/landing/AgroStorytellingSection';
import { SANDBOX_PRESETS } from './landing/data';
import { Navbar } from './landing/sections/Navbar';
import { Hero } from './landing/sections/Hero';
import { Problem } from './landing/sections/Problem';
import { Features } from './landing/sections/Features';
import { AgentOS } from './landing/sections/AgentOS';
import { HowItWorks } from './landing/sections/HowItWorks';
import { Demo } from './landing/sections/Demo';
import { ROI } from './landing/sections/ROI';
import { FAQ } from './landing/sections/FAQ';
import { Mission } from './landing/sections/Mission';
import { CTA } from './landing/sections/CTA';
import { Footer } from './landing/sections/Footer';

// ─── Main component ─────────────────────────────────────────────
export function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  // Agent OS Sandbox Interactive State
  const [activePreset, setActivePreset] = useState(SANDBOX_PRESETS[0]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(4);
  const [activeChannelTab, setActiveChannelTab] = useState<'sms' | 'whatsapp' | 'telegram'>('sms');

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimProgress(1);
    setTimeout(() => setSimProgress(2), 350);
    setTimeout(() => setSimProgress(3), 700);
    setTimeout(() => {
      setSimProgress(4);
      setIsSimulating(false);
    }, 1050);
  };

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 150, damping: 15 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 15 });

  const reducedMotion = useReducedMotion();

  // Scroll-driven transforms
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.6]);

  // Global Cursor spotlight tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = pageRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY]
  );

  return (
    <div
      ref={pageRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-screen bg-slate-950 text-white overflow-x-hidden"
    >
      {/* ── Global Animated Mesh Background ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="mesh-orb-1 absolute top-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full bg-emerald-600/[0.05] blur-[180px]" />
        <div className="mesh-orb-2 absolute top-[30%] right-[-15%] w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[150px]" />
        <div className="mesh-orb-3 absolute top-[60%] left-[10%] w-[600px] h-[600px] rounded-full bg-emerald-400/[0.035] blur-[130px]" />
        <div className="mesh-orb-2 absolute top-[85%] right-[5%] w-[500px] h-[500px] rounded-full bg-teal-500/[0.035] blur-[110px]" />
      </div>

      {/* Global Cursor spotlight */}
      <motion.div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-0 opacity-25"
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, var(--color-outline) 0%, transparent 70%)',
        }}
      />

      {/* ── CSS for mesh animation ── */}
      <style>{`
        @keyframes meshShift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-20px, 30px) scale(0.95); }
          75% { transform: translate(10px, 10px) scale(1.02); }
        }
        @keyframes meshShift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.08); }
          66% { transform: translate(20px, -30px) scale(0.96); }
        }
        @keyframes meshShift3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, 25px) scale(1.04); }
        }
        .mesh-orb-1 { animation: meshShift 12s ease-in-out infinite; }
        .mesh-orb-2 { animation: meshShift2 15s ease-in-out infinite; }
        .mesh-orb-3 { animation: meshShift3 10s ease-in-out infinite; }
        ${reducedMotion ? '.mesh-orb-1,.mesh-orb-2,.mesh-orb-3{animation:none !important;}' : ''}
      `}</style>

      {/* ── WebGL / CanvasUI Fluid Dynamics Background ── */}
      <LiquidBackgroundCanvas />

      {/* Accessible Skip to Main Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-emerald-600 focus:text-white focus:font-semibold focus:text-sm focus:rounded-lg focus:shadow-2xl focus:ring-2 focus:ring-white focus:outline-none transition-all"
      >
        Skip to main content
      </a>


      <Navbar />

      <main id="main-content">
        <Hero heroY={heroY} heroOpacity={heroOpacity} />
        <Problem />
        <Features />
        <AgentOS
          activePreset={activePreset}
          setActivePreset={setActivePreset}
          handleRunSimulation={handleRunSimulation}
          isSimulating={isSimulating}
          simProgress={simProgress}
          activeChannelTab={activeChannelTab}
          setActiveChannelTab={setActiveChannelTab}
        />
        <HowItWorks />

        {/* ── INTERACTIVE 3D SCROLL-DRIVEN AGRO-ECOSYSTEM STORYTELLING ── */}
        <AgroStorytellingSection />
        <Demo />
        <ROI />
        <FAQ />
        <Mission />
        <CTA />
        <Footer />
      </main>
    </div>
  );
}

export default LandingPage;
