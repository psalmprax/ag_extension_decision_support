import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CH_COLORS } from '@/lib/colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import {
  Users,
  MapPin,
  Brain,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle,
  XCircle,
  Database,
  TrendingUp,
  FileText,
  Building2,
  GraduationCap,
  Heart,
  Bell,
  Wifi,
  ChevronDown,
  ChevronUp,
  Play,
  CloudSun,
  Layers,
  Mail,
  Menu,
  X,
  Sprout,
  Activity,
} from 'lucide-react';
import { Liquid } from '@/components/canvasui/Liquid';

// ─── Animation variants ─────────────────────────────────────────
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Data ───────────────────────────────────────────────────────
const painPoints = [
  {
    problem: 'Paper-based field visit records lost or delayed by weeks',
    solution: 'Digital visit logs synced in real time, even offline',
  },
  {
    problem: 'Guesswork recommendations with no soil or weather data',
    solution: 'NASA POWER weather + SoilGrids soil data in every decision',
  },
  {
    problem: 'No visibility into officer performance or farmer outcomes',
    solution: 'Live analytics dashboard with per-officer metrics',
  },
  {
    problem: 'Crop diseases identified too late, after spread',
    solution: 'AI disease diagnosis from photos, treatment in minutes',
  },
];

const features = [
  {
    icon: Users,
    title: 'Farmer Portfolio',
    desc: 'Manage your entire farmer network with real-time vital scores, crop data, and soil analytics in one unified view.',
    highlight: true,
  },
  {
    icon: Brain,
    title: 'AI Assistant',
    desc: 'Instant agronomic advice powered by RAG with citations, knowledge graphs, and re-ranked results.',
  },
  {
    icon: MapPin,
    title: 'Field Visits',
    desc: 'Schedule, track, and synthesize field visits with AI-powered note analysis and follow-up automation.',
  },
  {
    icon: TrendingUp,
    title: 'Analytics & Reports',
    desc: 'Track officer performance, farmer outcomes, and generate executive reports with one click.',
  },
  {
    icon: Shield,
    title: 'Disease Diagnosis',
    desc: 'AI-powered crop disease identification with treatment recommendations from the knowledge base.',
  },
  {
    icon: Database,
    title: 'Knowledge Base',
    desc: 'FAOSTAT data, NASA POWER weather, SoilGrids properties — all searchable with AI-powered RAG.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Register Farmers',
    desc: 'Add farmers with GPS coordinates, crop data, soil info, and contact details. Bulk import supported.',
  },
  {
    num: '02',
    title: 'Track & Visit',
    desc: 'Schedule field visits, record observations, capture photos, and log follow-up actions from any device.',
  },
  {
    num: '03',
    title: 'Analyze & Act',
    desc: 'AI surfaces insights, predicts risks, recommends actions, and generates reports for stakeholders.',
  },
];

const audiences = [
  {
    icon: Building2,
    title: 'Government Agencies',
    desc: 'National and regional agricultural ministries scaling extension services across districts.',
  },
  {
    icon: GraduationCap,
    title: 'NGOs & Development Orgs',
    desc: 'World Bank, FAO, AGRA, and field partners running agricultural improvement programs.',
  },
  {
    icon: Heart,
    title: 'Cooperatives & Agribusiness',
    desc: 'Farmer cooperatives and agribusiness companies managing contract farming at scale.',
  },
];

const globalTelemetryNodes = [
  { x: 51, y: 48, label: 'Nairobi, Kenya', region: 'East Africa' },
  { x: 44, y: 45, label: 'Lagos, Nigeria', region: 'West Africa' },
  { x: 48, y: 43, label: 'Kampala, Uganda', region: 'East Africa' },
  { x: 38, y: 44, label: 'Accra, Ghana', region: 'West Africa' },
  { x: 67, y: 36, label: 'New Delhi, India', region: 'South Asia' },
  { x: 76, y: 42, label: 'Hanoi, Vietnam', region: 'Southeast Asia' },
  { x: 29, y: 64, label: 'São Paulo, Brazil', region: 'Latin America' },
  { x: 23, y: 26, label: 'Saskatoon, Canada', region: 'North America' },
  { x: 53, y: 32, label: 'Cairo, Egypt', region: 'North Africa' },
  { x: 54, y: 55, label: 'Lusaka, Zambia', region: 'Southern Africa' },
];

const faqItems = [
  {
    question: 'How does offline-first sync work in remote rural areas without cellular coverage?',
    answer:
      'GPExts is built with a resilient offline-first architecture. Extension officers can register farmers, record visit observations, capture diagnostic photos, and query locally cached agronomic guidelines without an active internet connection. When returning to cellular range or Wi-Fi, all pending records synchronize seamlessly with conflict-free reconciliation and cryptographic timestamps.',
  },
  {
    question: 'Where is our organizational and farmer data hosted, and who owns it?',
    answer:
      'Your organization retains 100% legal data sovereignty and ownership. GPExts enforces strict tenant database isolation, encrypted storage at rest (AES-256) and in transit (TLS 1.3), and role-based access control (RBAC). We fully support jurisdictional data residency requirements and built-in Data Rights tools for automated export and audited record erasure.',
  },
  {
    question: 'How are AI recommendations validated to ensure agronomic reliability?',
    answer:
      'Our AI Advisory Engine uses Retrieval-Augmented Generation (RAG) anchored strictly in verified institutional knowledge bases—including FAOSTAT agronomy manuals, localized SoilGrids ISRIC soil profiles, and NASA POWER weather telemetry. Every recommendation includes transparent source citations, confidence scores, and an optional human-in-the-loop supervisor review queue.',
  },
  {
    question: 'What devices and hardware are supported for extension officers in the field?',
    answer:
      'The platform is built as a lightweight, battery-efficient Progressive Web App (PWA) and responsive mobile application. It runs smoothly on budget Android smartphones and tablets (Android 8.0+), iOS devices, and desktop browsers, requiring no costly proprietary field hardware.',
  },
  {
    question: 'Can GPExts be customized for regional crop varieties, languages, and local units?',
    answer:
      'Yes. GPExts is globally configurable. Administrators can define custom crop catalogs, local soil nutrient thresholds, regional measurement units (hectares vs. acres, kg vs. lbs, metric vs. imperial), and localized interfaces across more than 10 languages (including Swahili, French, Hausa, Hindi, Portuguese, and Spanish).',
  },
  {
    question: 'How can an agricultural ministry, NGO, or cooperative start a pilot deployment?',
    answer:
      'Organizations can launch an instant self-service trial or test drive the interactive demo immediately. For large-scale multi-district deployments, our team provides assisted data onboarding, bulk farmer registry import, custom GIS layer indexing, and dedicated agronomic training workshops.',
  },
];

// ─── Sparkline component ────────────────────────────────────────
function Sparkline({
  data,
  color,
  width = 80,
  height = 28,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient
          id={`spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
      />
    </svg>
  );
}

// ─── Global Telemetry Constellation SVG ─────────────────────────
function GlobalConstellationVisualization() {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[540px] h-[540px] opacity-[0.08] pointer-events-none hidden xl:block">
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        {/* Stylized world lat/long concentric rings & orbit guides */}
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="46"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.25"
          strokeDasharray="2,2"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="24"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="1.5,1.5"
        />
        <ellipse
          cx="50"
          cy="50"
          rx="46"
          ry="12"
          fill="none"
          stroke="var(--color-outline)"
          strokeWidth="0.15"
          strokeDasharray="1,1"
        />
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="96"
          stroke="var(--color-outline)"
          strokeWidth="0.2"
          strokeDasharray="2,2"
        />

        {/* Inter-hub telemetry orbital arcs */}
        {globalTelemetryNodes.map((node, i) =>
          globalTelemetryNodes
            .slice(i + 1, i + 4)
            .map((other, j) => (
              <line
                key={`${i}-${j}`}
                x1={node.x}
                y1={node.y}
                x2={other.x}
                y2={other.y}
                stroke="var(--color-outline)"
                strokeWidth="0.18"
                strokeDasharray="1.5,1.5"
              />
            ))
        )}

        {/* Global Telemetry Beacons */}
        {globalTelemetryNodes.map((node, i) => (
          <g key={i}>
            <circle cx={node.x} cy={node.y} r="1.6" fill="var(--color-outline)">
              <animate
                attributeName="r"
                values="1.2;3.2;1.2"
                dur={`${2.2 + (i % 4) * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0.15;0.7"
                dur={`${2.2 + (i % 4) * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle cx={node.x} cy={node.y} r="0.6" fill="var(--color-outline)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => (prev === index ? null : index));
  };

  return (
    <div
      ref={pageRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-screen bg-slate-950 text-white overflow-x-hidden"
    >
      {/* ── Global Animated Mesh & Liquid WebGL Background ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <Liquid style={{ position: 'absolute', inset: 0 }} color={[0.02, 0.59, 0.41]}>
          {null}
        </Liquid>
        <div className="mesh-orb-1 absolute top-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full bg-emerald-600/[0.07] blur-[160px]" />
        <div className="mesh-orb-2 absolute top-[30%] right-[-15%] w-[700px] h-[700px] rounded-full bg-amber-500/[0.05] blur-[140px]" />
        <div className="mesh-orb-3 absolute top-[60%] left-[10%] w-[600px] h-[600px] rounded-full bg-emerald-400/[0.04] blur-[120px]" />
        <div className="mesh-orb-2 absolute top-[85%] right-[5%] w-[500px] h-[500px] rounded-full bg-teal-500/[0.05] blur-[100px]" />
      </div>

      {/* Global Cursor spotlight */}
      <motion.div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-0 opacity-40"
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

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/75 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-[90rem] w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GPExts Logo" className="w-9 h-9 object-contain rounded-lg" />
            <span className="text-lg font-bold tracking-tight text-white">GPExts</span>
          </div>

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
                  className="w-full py-2.5 text-sm font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 text-center shadow-lg shadow-emerald-500/20"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main id="main-content">
        {/* ── HERO ── */}
        <section
          className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden"
        >
          {/* Grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(var(--color-outline) 1px, transparent 1px), linear-gradient(90deg, var(--color-outline) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          {/* Global Constellation Visualization */}
          <GlobalConstellationVisualization />

          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center relative z-10"
          >
            {/* Left copy */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-white/70">
                  Global Agricultural Decision Support Platform
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08] tracking-tight text-white"
              >
                Smarter Farming
                <br />
                Starts with{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-400 bg-clip-text text-transparent">
                    Better Data
                  </span>
                  <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full opacity-40" />
                </span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-base sm:text-lg text-white/80 leading-relaxed max-w-lg font-normal"
              >
                Empower extension officers with AI-driven insights, real-time farmer tracking, and
                data-powered decisions across the Globe.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="text-sm text-white/70 leading-relaxed max-w-lg pt-1 space-y-1.5 font-normal"
              >
                <p>
                  <span className="text-emerald-400 font-semibold">What it is:</span> A field-ready
                  decision-support platform for agricultural extension officers managing thousands
                  of farmers across districts.
                </p>
                <p>
                  <span className="text-emerald-400 font-semibold">Who it&apos;s for:</span>{' '}
                  Government agencies, NGOs, and cooperatives running agricultural improvement
                  programs.
                </p>
                <p>
                  <span className="text-emerald-400 font-semibold">What it solves:</span>{' '}
                  Paper-based field visits, guesswork recommendations, delayed disease response, and
                  zero visibility into farmer outcomes.
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="group px-7 py-3.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => navigate('/demo')}
                  className="group px-7 py-3.5 text-sm font-semibold bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-xl hover:bg-white/[0.1] hover:text-white transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  Try Live Demo
                </button>
              </motion.div>

              {/* Feature highlights */}
              <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2.5 pt-2">
                {[
                  { title: 'Satellite Weather', sub: 'NASA POWER API' },
                  { title: 'Soil Telemetry', sub: 'SoilGrids ISRIC' },
                  { title: 'Offline-First', sub: 'Instant Local Sync' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-emerald-500/20 transition-colors"
                  >
                    <div className="text-xs font-bold text-emerald-400">{item.title}</div>
                    <div className="text-[11px] text-white/50 mt-0.5 font-medium">{item.sub}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — Detailed dashboard mockup */}
            <motion.div initial="hidden" animate="visible" variants={scaleIn} className="relative">
              {/* Glow behind mockup */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-amber-500/10 blur-[60px] rounded-full scale-90" />

              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950 shadow-2xl shadow-black/60 transform perspective-[1200px] rotate-y-[2deg] -rotate-x-[1deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-xxs text-white/30 font-mono">
                      app.gpexts.com/dashboard
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bell className="w-3 h-3 text-white/30" />
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[7px] font-bold">
                      A
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[170px_1fr] min-h-[380px]">
                  {/* Sidebar */}
                  <div className="bg-white/[0.015] border-r border-white/[0.05] p-2.5 text-xxs space-y-0.5">
                    <div className="px-2.5 py-1.5 mb-2">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.1] text-emerald-400 font-medium text-xxs">
                        <BarChart3 className="w-3 h-3" />
                        Dashboard
                      </div>
                    </div>
                    {[
                      { icon: Users, label: 'Farmers', count: '120' },
                      { icon: MapPin, label: 'Visits', count: '156' },
                      { icon: Brain, label: 'AI Assistant' },
                      { icon: TrendingUp, label: 'Analytics' },
                      { icon: Shield, label: 'Diseases', count: '3' },
                      { icon: FileText, label: 'Reports' },
                      { icon: Database, label: 'Knowledge' },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/[0.02] transition-all cursor-default"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="w-3 h-3" />
                          {item.label}
                        </div>
                        {item.count && (
                          <span className="text-[8px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                            {item.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="p-3 bg-white/[0.005] space-y-2.5">
                    {/* Welcome bar */}
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-xs-plus font-semibold text-white/80">
                          Good morning, Amina
                        </div>
                        <div className="text-micro text-white/35">
                          Here&apos;s what&apos;s happening across your district
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/[0.08] text-emerald-400 text-micro font-medium">
                        <Wifi className="w-2.5 h-2.5" />
                        All Systems Online
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        {
                          value: '120',
                          label: 'Farmers',
                          change: '+12%',
                          color: CH_COLORS.success,
                          sparkData: [20, 25, 22, 30, 28, 35, 32, 40, 38, 45],
                        },
                        {
                          value: '156',
                          label: 'Visits',
                          change: '+8%',
                          color: CH_COLORS.success,
                          sparkData: [10, 15, 12, 18, 20, 16, 22, 25, 20, 28],
                        },
                        {
                          value: '92%',
                          label: 'Health',
                          change: '+3%',
                          color: CH_COLORS.warning,
                          sparkData: [85, 87, 86, 88, 90, 89, 91, 90, 92, 92],
                        },
                        {
                          value: '4.2mm',
                          label: 'Rain/day',
                          change: 'Normal',
                          color: CH_COLORS.blue,
                          sparkData: [3, 4, 5, 3, 4, 6, 5, 4, 3, 4],
                        },
                      ].map((stat, i) => (
                        <div
                          key={i}
                          className="bg-white/[0.025] rounded-lg p-2.5 border border-white/[0.04]"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[14px] font-bold text-white/90">
                              {stat.value}
                            </span>
                            <span
                              className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ color: stat.color, background: `${stat.color}15` }}
                            >
                              {stat.change}
                            </span>
                          </div>
                          <div className="text-[8px] text-white/35 uppercase tracking-wider mb-1.5">
                            {stat.label}
                          </div>
                          <Sparkline
                            data={stat.sparkData}
                            color={stat.color}
                            width={60}
                            height={18}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Chart + Activity */}
                    <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                      {/* Chart */}
                      <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-micro font-semibold text-white/50">
                            Farmer Network Growth
                          </span>
                          <span className="text-[8px] text-white/25">Last 12 months</span>
                        </div>
                        <div className="flex items-end gap-1 h-20">
                          {[20, 28, 24, 35, 30, 42, 38, 50, 45, 58, 52, 65].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100"
                              style={{
                                height: `${h}%`,
                                background:
                                  i === 11
                                    ? 'linear-gradient(to top, var(--color-primary-500), var(--color-status-warning))'
                                    : `linear-gradient(to top, var(--color-outline), var(--color-outline))`,
                                opacity: i === 11 ? 1 : 0.6 + i * 0.03,
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1.5 text-[7px] text-white/20">
                          <span>Jan</span>
                          <span>Mar</span>
                          <span>Jun</span>
                          <span>Sep</span>
                          <span>Dec</span>
                        </div>
                      </div>

                      {/* Activity feed */}
                      <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
                        <div className="text-micro font-semibold text-white/50 mb-2">
                          Recent Field Activity
                        </div>
                        <div className="space-y-2">
                          {[
                            {
                              icon: MapPin,
                              text: 'Visit: Amina Okafor',
                              time: '2m ago',
                              color: 'text-emerald-400',
                            },
                            {
                              icon: Brain,
                              text: 'AI: Soil analysis ready',
                              time: '15m ago',
                              color: 'text-purple-400',
                            },
                            {
                              icon: Shield,
                              text: 'Alert: Rust detected',
                              time: '1h ago',
                              color: 'text-amber-400',
                            },
                            {
                              icon: Users,
                              text: 'New farmer: J. Mensah',
                              time: '3h ago',
                              color: 'text-blue-400',
                            },
                          ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <item.icon className={`w-3 h-3 ${item.color} flex-shrink-0 mt-0.5`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-micro text-white/60 truncate">{item.text}</div>
                                <div className="text-[7px] text-white/30">{item.time}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Farmer list */}
                    <div className="space-y-1">
                      {[
                        {
                          name: 'Amina Okafor',
                          initials: 'AO',
                          color: 'from-emerald-400 to-emerald-600',
                          crop: 'Maize & Beans',
                          status: 'Active',
                          statusBg: 'bg-emerald-500/10 text-emerald-400',
                          health: 94,
                        },
                        {
                          name: 'Joseph Mensah',
                          initials: 'JM',
                          color: 'from-amber-400 to-amber-600',
                          crop: 'Cassava',
                          status: 'Review',
                          statusBg: 'bg-amber-500/10 text-amber-400',
                          health: 78,
                        },
                        {
                          name: 'Ngozi Kalu',
                          initials: 'NK',
                          color: 'from-orange-400 to-orange-600',
                          crop: 'Rice & Millet',
                          status: 'Active',
                          statusBg: 'bg-emerald-500/10 text-emerald-400',
                          health: 88,
                        },
                      ].map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 bg-white/[0.015] rounded-lg px-2.5 py-1.5 border border-white/[0.03] text-xxs"
                        >
                          <div
                            className={`w-5 h-5 rounded-full bg-gradient-to-br ${f.color} flex items-center justify-center text-white text-[7px] font-bold`}
                          >
                            {f.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-white/70 block truncate">
                              {f.name}
                            </span>
                            <span className="text-[8px] text-white/30">{f.crop}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${f.health}%`,
                                  background:
                                    f.health > 85
                                      ? CH_COLORS.success
                                      : f.health > 70
                                        ? CH_COLORS.warning
                                        : CH_COLORS.error,
                                }}
                              />
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-semibold ${f.statusBg}`}
                            >
                              {f.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060b08] to-transparent pointer-events-none z-20" />

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
          >
            <span className="text-xxs text-white/30 uppercase tracking-widest">Scroll</span>
            <ChevronDown className="w-4 h-4 text-white/30 animate-bounce" />
          </motion.div>
        </section>

        {/* ── PROBLEM / SOLUTION ── */}
        <section id="problem" className="relative py-28 border-t border-white/[0.04]">
          <div className="max-w-[90rem] w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Why GPExts
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight leading-tight"
              >
                The old way isn&apos;t{' '}
                <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                  working
                </span>
              </motion.h2>
            </motion.div>

            <div className="space-y-3">
              {painPoints.map((item, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-40px' }}
                  variants={fadeUp}
                  className="grid md:grid-cols-2 gap-3"
                >
                  <div className="flex items-start gap-3 p-5 rounded-xl backdrop-blur-md bg-rose-950/20 border border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-950/30 transition-all duration-300">
                    <XCircle className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/60 leading-relaxed">{item.problem}</span>
                  </div>
                  <div className="flex items-start gap-3 p-5 rounded-xl backdrop-blur-md bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/30 transition-all duration-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-white/80 leading-relaxed">{item.solution}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="relative py-28 border-t border-white/[0.04]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-[90rem] w-full mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Features
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight max-w-xl"
              >
                Built for the realities of{' '}
                <span className="text-white/45">Global & Tropical agriculture</span>
              </motion.h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {features.map((feat, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={fadeUp}
                  className={`group relative p-7 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-emerald-950/25 transition-all duration-500 overflow-hidden ${
                    feat.highlight ? 'lg:col-span-2 lg:row-span-2 lg:p-10' : ''
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10">
                    <div
                      className={`rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 transition-all duration-500 ${
                        feat.highlight ? 'w-14 h-14 mb-7' : 'w-11 h-11'
                      }`}
                    >
                      <feat.icon
                        className={`text-emerald-400/70 group-hover:text-emerald-400 transition-colors duration-500 ${
                          feat.highlight ? 'w-7 h-7' : 'w-5 h-5'
                        }`}
                      />
                    </div>
                    <h3
                      className={`font-bold mb-2 text-white/90 ${feat.highlight ? 'text-xl mb-3' : 'text-base'}`}
                    >
                      {feat.title}
                    </h3>
                    <p
                      className={`text-white/50 leading-relaxed group-hover:text-white/70 transition-colors duration-500 ${
                        feat.highlight ? 'text-base max-w-md' : 'text-sm'
                      }`}
                    >
                      {feat.desc}
                    </p>

                    {feat.highlight && (
                      <div className="mt-8 pt-6 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                        {[
                          { val: 'Real-time', label: 'Sync Engine' },
                          { val: 'Offline-First', label: 'Local Encrypted DB' },
                          { val: 'GPS Polygon', label: 'Field Boundary Mapping' },
                        ].map((s, j) => (
                          <div key={j}>
                            <div className="text-sm font-bold text-emerald-400">{s.val}</div>
                            <div className="text-xxs text-white/35 uppercase tracking-wider mt-0.5">
                              {s.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="relative py-28 border-t border-white/[0.04]">
          <div className="max-w-[90rem] w-full mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-20"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                How It Works
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight"
              >
                Up and running in{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                  three steps
                </span>
              </motion.h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px">
                <div className="w-full h-full bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-amber-500/20" />
              </div>

              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="p-6 rounded-2xl backdrop-blur-md bg-slate-900/50 border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-300 text-center relative"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-amber-500/10 border border-emerald-500/30 flex items-center justify-center text-lg font-bold text-emerald-400 mx-auto mb-6 relative z-10 shadow-lg shadow-emerald-950/30">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-white/90">{step.title}</h3>
                  <p className="text-sm text-white/50 max-w-[280px] mx-auto leading-relaxed">
                    {step.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CORE CAPABILITIES & DATA ECOSYSTEM ── */}
        <section
          id="capabilities"
          className="relative py-28 border-t border-b border-white/[0.04] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-transparent to-amber-500/[0.02] pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="text-center mb-14"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400 mb-3"
              >
                Integrated Decision Ecosystem
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white/90"
              >
                Engineered for precision, resilience, and field reality
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/65 max-w-2xl mx-auto mt-3 font-normal leading-relaxed"
              >
                Connecting extension officers to verified global agricultural datasets, localized
                soil chemistry, and real-time offline workflows.
              </motion.p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: CloudSun,
                  title: 'Satellite Weather',
                  badge: 'NASA POWER API',
                  desc: 'Solar irradiance, precipitation coefficients, and thermal forecasts tailored to exact GPS farm coordinates.',
                },
                {
                  icon: Layers,
                  title: 'Soil Telemetry',
                  badge: 'SoilGrids ISRIC',
                  desc: 'Sub-surface pH mapping, organic carbon densities, and precision lime and nutrient recovery formulas.',
                },
                {
                  icon: Brain,
                  title: 'AI Advisory Engine',
                  badge: 'RAG Knowledge Graph',
                  desc: 'Instant pest and disease diagnosis referencing verified FAOSTAT agronomic manuals and extension research.',
                },
                {
                  icon: Wifi,
                  title: 'Offline-First Sync',
                  badge: 'Zero Latency',
                  desc: 'Record visit notes and audio logs with no cell coverage; auto-syncs securely once back in range.',
                },
              ].map((cap, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="p-6 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-emerald-950/20 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                      <cap.icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                      {cap.badge}
                    </div>
                    <h3 className="text-base font-bold text-white/90 mb-2">{cap.title}</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed font-normal">
                      {cap.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Live Field Agronomy Telemetry Snapshot Card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="mt-10 p-6 sm:p-8 rounded-2xl backdrop-blur-md bg-slate-900/70 border border-emerald-500/25 shadow-2xl shadow-emerald-950/30"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                      Real-World Agronomic Intelligence Trail
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        Verified
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      Multi-parameter field data stream synthesized into evidence-backed
                      recommendations
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Telemetry Live</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="p-3.5 rounded-xl backdrop-blur-sm bg-slate-950/60 border border-white/[0.06]">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                    NDVI Canopy Vigor
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    0.78 <span className="text-xs font-normal text-white/50">High</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">Sentinel-2 Multispectral</div>
                </div>
                <div className="p-3.5 rounded-xl backdrop-blur-sm bg-slate-950/60 border border-white/[0.06]">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                    Soil pH & Carbon
                  </div>
                  <div className="text-lg font-bold text-amber-400">
                    6.4 pH <span className="text-xs font-normal text-white/50">Optimal</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">SoilGrids 0-30cm Depth</div>
                </div>
                <div className="p-3.5 rounded-xl backdrop-blur-sm bg-slate-950/60 border border-white/[0.06]">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                    Soil Moisture
                  </div>
                  <div className="text-lg font-bold text-blue-400">
                    31.2% <span className="text-xs font-normal text-white/50">Field Cap.</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">NASA POWER 7-Day Model</div>
                </div>
                <div className="p-3.5 rounded-xl backdrop-blur-sm bg-slate-950/60 border border-white/[0.06]">
                  <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                    Pest Risk Index
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    Low Risk <span className="text-xs font-normal text-white/50">9%</span>
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">FAO Early-Warning Vector</div>
                </div>
              </div>
            </motion.div>

            {/* Operational Standards Strip */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="mt-10 pt-8 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-6 text-center"
            >
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-emerald-400">
                  FAOSTAT Integrated
                </div>
                <div className="text-xs text-white/45">Verified Agro Standards</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-emerald-400">
                  Voice Synthesis
                </div>
                <div className="text-xs text-white/45">Automated Visit Logs</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-emerald-400">
                  Multi-District
                </div>
                <div className="text-xs text-white/45">Climatic Zone Profiling</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm sm:text-base font-bold text-emerald-400">
                  Encrypted Store
                </div>
                <div className="text-xs text-white/45">Tamper-Proof Records</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── BUILT FOR ── */}
        <section className="relative py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Built For
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight"
              >
                Serving organizations across{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                  the Globe
                </span>
              </motion.h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4">
              {audiences.map((aud, i) => (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="group p-7 rounded-2xl backdrop-blur-md bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-emerald-950/20 transition-all duration-500"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-all duration-500">
                    <aud.icon className="w-6 h-6 text-emerald-400/80 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-white/90">{aud.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{aud.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ACCORDION SECTION ── */}
        <section id="faq" className="relative py-28 border-t border-white/[0.04]">
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeUp}
                className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
              >
                Frequently Asked Questions
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight"
              >
                Everything you need to know about{' '}
                <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                  GPExts
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/60 max-w-xl mx-auto mt-3 font-normal"
              >
                Transparent answers on data ownership, offline reliability, agronomic accuracy, and
                institutional rollout.
              </motion.p>
            </motion.div>

            <div className="space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <motion.div
                    key={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-40px' }}
                    variants={fadeUp}
                    className="rounded-2xl border border-white/[0.08] backdrop-blur-md bg-slate-900/60 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => toggleFaq(index)}
                      className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <span className="text-base sm:text-lg font-semibold text-white/90 leading-snug">
                        {item.question}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 text-white/60 group-hover:text-emerald-400">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`faq-answer-${index}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-6 pb-6 pt-1 text-sm sm:text-base text-white/65 leading-relaxed font-normal border-t border-white/[0.03]">
                            {item.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── MISSION ── */}
        <section id="mission" className="relative py-28 border-t border-white/[0.04]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-emerald-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-3xl mx-auto px-6 text-center relative z-10"
          >
            <motion.div
              variants={fadeUp}
              className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-4"
            >
              Our Mission
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight mb-6 leading-tight"
            >
              Closing the gap between{' '}
              <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                agricultural data
              </span>{' '}
              and field decisions
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg text-white/75 leading-relaxed max-w-2xl mx-auto"
            >
              Across the Globe, extension officers manage thousands of farmers with clipboards and
              guesswork. GPExts replaces that with real-time soil data, satellite weather, and
              AI-powered diagnostics — so every recommendation is backed by evidence, not intuition.
            </motion.p>
          </motion.div>
        </section>

        {/* ── CTA ── */}
        <section className="relative py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#060b08] via-emerald-950/20 to-[#060b08] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/[0.05] blur-[100px] rounded-full pointer-events-none" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="max-w-2xl mx-auto px-6 text-center relative z-10"
          >
            <motion.h2
              variants={fadeUp}
              className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-5 leading-tight"
            >
              Ready to transform your
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-amber-400 bg-clip-text text-transparent">
                agricultural extension?
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-white/75 mb-8">
              Start with a free trial. No credit card required.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <button
                onClick={() => navigate('/register')}
                className="group px-8 py-4 text-base font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-400 hover:to-emerald-500 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="px-8 py-4 text-base font-semibold bg-white/[0.04] border border-white/[0.06] text-white/70 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Try Live Demo
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* ── FOOTER ── */}
        <footer id="contact" className="border-t border-white/[0.04] pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 pb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/logo.png"
                  alt="GPExts Logo"
                  className="w-9 h-9 object-contain rounded-lg"
                />
                <span className="text-lg font-bold tracking-tight text-white">GPExts</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs mb-4 font-normal">
                Empowering agricultural extension officers with AI-driven decision support across
                the Globe.
              </p>
              <a
                href="mailto:info@gpfed.com"
                className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl"
              >
                <Mail className="w-4 h-4" />
                info@gpfed.com
              </a>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-5">
                Product
              </h4>
              <ul className="space-y-3 text-sm font-normal">
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
                    Ecosystem & Soil
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-white/60 hover:text-emerald-400 transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="/demo"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Live Demo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-5">
                Contact & Inquiries
              </h4>
              <ul className="space-y-3 text-sm font-normal">
                <li>
                  <a
                    href="#mission"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Our Mission
                  </a>
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-5">
                Get Started
              </h4>
              <ul className="space-y-3 text-sm font-normal">
                <li>
                  <a
                    href="/register"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Create Account
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    className="text-white/60 hover:text-emerald-400 transition-colors"
                  >
                    Sign In
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-4">
            <span className="text-xs text-white/35">
              &copy; {new Date().getFullYear()} GPExts. All rights reserved.
            </span>
            <div className="flex gap-5 text-xs">
              <a href="#" className="text-white/35 hover:text-emerald-400 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-white/35 hover:text-emerald-400 transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default LandingPage;
