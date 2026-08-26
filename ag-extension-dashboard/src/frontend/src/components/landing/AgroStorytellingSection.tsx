import React, { useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';
import { Satellite, MapPin, Layers, Radio, ArrowDown, Sparkles, CheckCircle2, ChevronRight, UserCheck, Briefcase, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playStageChime } from '@/lib/audioHaptics';

export type AudiencePersona = 'officers' | 'agribusiness' | 'donors';

export interface StageStoryItem {
  num: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  border: string;
  bgGlow: string;
  bullets: string[];
  tag: string;
}

const STAGE_DATA_BY_PERSONA: Record<AudiencePersona, StageStoryItem[]> = {
  officers: [
    {
      num: '01',
      title: 'Orbital Recon & Atmospheric Ingestion',
      category: 'REMOTE SENSING ENGINE',
      icon: Satellite,
      color: 'text-sky-400',
      border: 'border-sky-500/30',
      bgGlow: 'from-sky-500/10 to-transparent',
      bullets: [
        'Real-time NASA POWER solar radiation flux (MJ/m²)',
        'Global GPM daily precipitation coefficients',
        'Automated spatial coordinate locks on smallholder plots',
      ],
      tag: 'NASA POWER + Sentinel-2',
    },
    {
      num: '02',
      title: 'Topological Elevation & NDVI Biomass',
      category: 'CANOPY HEALTH & GPS MAPPING',
      icon: MapPin,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bgGlow: 'from-emerald-500/10 to-transparent',
      bullets: [
        'Centimeter-accurate field boundary polygon mapping',
        'Multi-spectral NDVI vegetation vigor indices',
        'Stressed foliage early anomaly alerts before yield loss',
      ],
      tag: 'Sub-meter Polygon Precision',
    },
    {
      num: '03',
      title: 'Subsurface Soil Horizon Stratigraphy',
      category: 'ISRIC SOILGRIDS V2 INTEGRATION',
      icon: Layers,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bgGlow: 'from-amber-500/10 to-transparent',
      bullets: [
        'Clay, Sand, and Silt density gradients (0-100cm depth)',
        'Cation exchange capacity (CEC) & pH aluminum toxicity risk',
        'Root-zone soil moisture percolation modeling',
      ],
      tag: 'Depth-Calibrated Agronomy',
    },
    {
      num: '04',
      title: 'AI Decision Synthesis & Edge Uplink',
      category: 'AUTONOMOUS ADVISORY & USSD DISPATCH',
      icon: Radio,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      bgGlow: 'from-purple-500/10 to-transparent',
      bullets: [
        'Agronomic RAG synthesis citing FAO, IITA & CIMMYT protocols',
        'Instant prescription routing to field extension officers',
        'Zero-internet SMS/USSD fallback for offline farmers',
      ],
      tag: 'Offline-Ready Delivery',
    },
  ],
  agribusiness: [
    {
      num: '01',
      title: 'Macro Weather Sourcing & Climatology',
      category: 'COMMODITY SUPPLY SECURITY',
      icon: Satellite,
      color: 'text-sky-400',
      border: 'border-sky-500/30',
      bgGlow: 'from-sky-500/10 to-transparent',
      bullets: [
        'Predict seasonal drought risks across outgrower clusters',
        'Verify planting rainfall windows before fertilizer procurement',
        'Continuous supply risk scoring across 10,000+ farmer contracts',
      ],
      tag: 'Yield Risk Modeling',
    },
    {
      num: '02',
      title: 'Farm Yield Forecast & Acreage Tracking',
      category: 'PORTFOLIO CANOPY MONITORING',
      icon: MapPin,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bgGlow: 'from-emerald-500/10 to-transparent',
      bullets: [
        'Sub-meter field boundaries eliminate phantom smallholder acreage',
        'NDVI anomaly detection flags crop failures 3 weeks early',
        'Predict harvest tonnage volume for warehouse logistics',
      ],
      tag: 'Supply Assurance',
    },
    {
      num: '03',
      title: 'Input Efficiency & Fertilizer Optimization',
      category: 'ISRIC SOILGRIDS PRECISION INPUTS',
      icon: Layers,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bgGlow: 'from-amber-500/10 to-transparent',
      bullets: [
        'Custom N-P-K & lime blend recommendations per district',
        'Reduce smallholder fertilizer wastage by up to 28%',
        'Protect topsoil fertility against long-term acidification',
      ],
      tag: 'Optimized Input Spend',
    },
    {
      num: '04',
      title: 'Enterprise ERP & Buyer Telemetry',
      category: 'AUTOMATED DISPATCH & COMPLIANCE',
      icon: Radio,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      bgGlow: 'from-purple-500/10 to-transparent',
      bullets: [
        'EUDR deforestation and origin traceability export reports',
        'Broadcast bulk harvest instructions via 2-way SMS gateway',
        'Direct integration with SAP, NetSuite, and warehouse ERPs',
      ],
      tag: 'EUDR & ERP Ready',
    },
  ],
  donors: [
    {
      num: '01',
      title: 'Climate Adaptation & Satellite Monitoring',
      category: 'FOOD SECURITY RESILIENCE',
      icon: Satellite,
      color: 'text-sky-400',
      border: 'border-sky-500/30',
      bgGlow: 'from-sky-500/10 to-transparent',
      bullets: [
        'Track climate vulnerability across vulnerable rural zones',
        'Early-warning food shortage flags 60 days before harvest',
        'Satellite-backed transparency for grant reporting',
      ],
      tag: 'UN SDG 2: Zero Hunger',
    },
    {
      num: '02',
      title: 'Smallholder Land Inclusion & GPS Footprints',
      category: 'EQUITABLE ACCESS & TENURE',
      icon: MapPin,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bgGlow: 'from-emerald-500/10 to-transparent',
      bullets: [
        'Digital farm identity for underbanked women & youth farmers',
        'Verify smallholder boundary compliance without field disputes',
        'Aggregate community crop health indices for program audits',
      ],
      tag: 'Financial Inclusion',
    },
    {
      num: '03',
      title: 'Regenerative Soil & Carbon Stratigraphy',
      category: 'SOIL CARBON & CONSERVATION',
      icon: Layers,
      color: 'text-amber-400',
      border: 'border-amber-500/30',
      bgGlow: 'from-amber-500/10 to-transparent',
      bullets: [
        'Measure topsoil organic carbon buildup year-over-year',
        'Identify soil erosion hotspots for reforestation programs',
        'Target subsidised lime distributions to severe acid soils',
      ],
      tag: 'Regenerative Agriculture',
    },
    {
      num: '04',
      title: 'Last-Mile Digital Extension & USSD',
      category: 'NO SMALLHOLDER LEFT BEHIND',
      icon: Radio,
      color: 'text-purple-400',
      border: 'border-purple-500/30',
      bgGlow: 'from-purple-500/10 to-transparent',
      bullets: [
        'Serve basic 2G feature phones without requiring internet access',
        'Multi-language advisory in local dialects and voice synthesis',
        'Measurable +34% median smallholder yield & income increase',
      ],
      tag: 'Last-Mile Impact',
    },
  ],
};

export function AgroStorytellingSection() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [persona, setPersona] = useState<AudiencePersona>('officers');

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setScrollProgress(latest);
    const stage = Math.min(3, Math.floor(latest * 4));
    setActiveStage(stage);
  });

  const handlePersonaChange = (newPersona: AudiencePersona) => {
    setPersona(newPersona);
    playStageChime(activeStage);
  };

  const personas = [
    { id: 'officers' as const, label: 'Field Extension Officers', icon: UserCheck },
    { id: 'agribusiness' as const, label: 'Agribusiness & Co-ops', icon: Briefcase },
    { id: 'donors' as const, label: 'Gov & Impact Donors', icon: Landmark },
  ];

  const currentStageData = STAGE_DATA_BY_PERSONA[persona];

  return (
    <section
      ref={containerRef}
      id="interactive-story"
      className="relative h-[320vh] bg-slate-950 border-t border-white/[0.04]"
    >
      {/* Sticky Fullscreen Pinned Viewport */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-between p-4 sm:p-8 overflow-hidden z-20">
        {/* Section Header & Persona Switcher */}
        <div className="max-w-7xl w-full mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 z-30 pt-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Scroll-Driven Agronomic Intelligence Pipeline</span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
              From Satellite Orbit to Soil Root Zone
            </h2>
          </div>

          {/* Persona Switcher Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 p-1 rounded-xl">
            {personas.map((p) => {
              const isSelected = persona === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`View story as ${p.label}`}
                  onClick={() => handlePersonaChange(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Split Grid: Left Canvas Scrubber + Right Dynamic HUD Narrative */}
        <div className="max-w-7xl w-full mx-auto grid lg:grid-cols-12 gap-6 items-center flex-1 my-3 z-30 min-h-0">
          {/* Left Canvas Scrubber (7 cols) */}
          <div className="lg:col-span-7 h-[40vh] lg:h-[56vh] w-full relative">
            <AgroEcosystemCanvasScrubber
              progress={scrollProgress}
              showControls={false}
              className="h-full w-full"
            />
          </div>

          {/* Right Floating Milestone HUD Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            {currentStageData.map((stage: StageStoryItem, idx: number) => {
              if (activeStage !== idx) return null;
              const IconComp = stage.icon;
              return (
                <motion.div
                  key={`${persona}-${idx}`}
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`p-6 sm:p-7 rounded-2xl bg-gradient-to-br ${stage.bgGlow} bg-slate-900/90 backdrop-blur-xl border ${stage.border} shadow-2xl relative overflow-hidden`}
                >
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg bg-white/5 ${stage.color}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-mono font-bold tracking-wider text-white/50">
                        {stage.category}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/10 text-white/80 border border-white/10">
                      STEP {stage.num} // 04
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg sm:text-2xl font-bold text-white mb-3.5 leading-snug">
                    {stage.title}
                  </h3>

                  {/* Bullet Points */}
                  <ul className="space-y-2 mb-5">
                    {stage.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${stage.color}`} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Tag & Action */}
                  <div className="pt-3.5 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400/90 font-medium">
                      ✓ {stage.tag}
                    </span>
                    <button
                      type="button"
                      aria-label="Open Interactive Demo"
                      onClick={() => navigate('/demo')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
                    >
                      <span>Interactive Demo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom Scroll Prompt Bar & Stage Tracker */}
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between text-xs text-white/40 font-mono pb-2 z-30">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            <span>SCROLL TO ADVANCE STRATIGRAPHY & UPLINK</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-lg border border-white/10">
              {currentStageData.map((_item: StageStoryItem, idx: number) => (
                <span
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    activeStage === idx ? 'bg-emerald-400 scale-125' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            <span className="hidden sm:inline">
              {(scrollProgress * 100).toFixed(0)}% SYNCHRONIZED
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
