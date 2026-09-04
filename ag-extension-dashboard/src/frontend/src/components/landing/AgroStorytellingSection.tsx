import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgroEcosystemCanvasScrubber } from '@/components/canvas-ui/AgroEcosystemCanvasScrubber';
import {
  Satellite,
  MapPin,
  Layers,
  Radio,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  Briefcase,
  Landmark,
} from 'lucide-react';
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
        'Continuous supply risk scoring across your farmer contract portfolio',
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
        'Vegetation-anomaly signals to flag emerging crop stress early',
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
        'Targeted fertilizer guidance to cut smallholder input wastage',
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
        '[Status: Demonstrator] EUDR deforestation heuristic estimator (not regulatory certification)',
        'Broadcast bulk harvest instructions via 2-way SMS gateway',
        '[Roadmap] SAP/NetSuite connector — not yet integrated',
      ],
      tag: 'Export & ERP [Demo/Roadmap]',
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
        'Early-warning food-supply signals ahead of harvest',
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
        'Track measured smallholder yield & income change per programme',
      ],
      tag: 'Last-Mile Impact',
    },
  ],
};

export function AgroStorytellingSection() {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState(0);
  const [persona, setPersona] = useState<AudiencePersona>('officers');

  const handlePersonaChange = (newPersona: AudiencePersona) => {
    setPersona(newPersona);
    playStageChime(activeStage);
  };

  const handleStageSelect = (stageIndex: number) => {
    setActiveStage(stageIndex);
    playStageChime(stageIndex);
  };

  const personas = [
    { id: 'officers' as const, label: 'Field Officers', icon: UserCheck },
    { id: 'agribusiness' as const, label: 'Agribusiness & Co-ops', icon: Briefcase },
    { id: 'donors' as const, label: 'Gov & Donors', icon: Landmark },
  ];

  const currentStageData = STAGE_DATA_BY_PERSONA[persona];
  const activeStoryItem = currentStageData[activeStage] || currentStageData[0];
  const IconComp = activeStoryItem.icon;

  return (
    <section
      id="interactive-story"
      className="relative py-16 sm:py-24 bg-slate-950 border-t border-white/[0.04] scroll-mt-20 overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.03] blur-[150px] pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-[600px] h-[600px] rounded-full bg-sky-500/[0.03] blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
        {/* Section Header & Persona Switcher */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Agronomic Intelligence Pipeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              From Satellite Orbit to Soil Root Zone
            </h2>
          </div>

          {/* Persona Switcher Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-lg">
            {personas.map((p) => {
              const isSelected = persona === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={`View story as ${p.label}`}
                  onClick={() => handlePersonaChange(p.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-Column Showcase */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Canvas Scrubber Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col min-h-[440px] sm:min-h-[500px] w-full rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md">
            <AgroEcosystemCanvasScrubber
              progress={activeStage * 0.28 + 0.05}
              onStageChange={(stage) => {
                if (stage !== activeStage) setActiveStage(stage);
              }}
              interactive={true}
              showControls={true}
              autoPlay={true}
              className="h-full w-full"
            />
          </div>

          {/* Right Milestone HUD Card Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between self-stretch space-y-6">
            {/* Dynamic Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${persona}-${activeStage}`}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`p-7 sm:p-8 rounded-xl bg-gradient-to-br ${activeStoryItem.bgGlow} bg-slate-900/95 backdrop-blur-xl border ${activeStoryItem.border} shadow-2xl flex flex-col justify-between flex-1 relative overflow-hidden`}
              >
                <div>
                  {/* Category & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2.5 rounded-xl bg-white/5 ${activeStoryItem.color}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono font-bold tracking-wider text-white/60">
                        {activeStoryItem.category}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-md text-xs font-mono font-bold bg-white/10 text-white/90 border border-white/10">
                      STEP {activeStoryItem.num} // 04
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">
                    {activeStoryItem.title}
                  </h3>

                  {/* Bullet Points */}
                  <ul className="space-y-3 mb-6">
                    {activeStoryItem.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="flex items-start gap-3 text-sm text-slate-300">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${activeStoryItem.color}`} />
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tag & Action */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between mt-auto">
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    ✓ {activeStoryItem.tag}
                  </span>
                  <button
                    type="button"
                    aria-label="Open Interactive Demo Sandbox"
                    onClick={() => navigate('/demo')}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20"
                  >
                    <span>Try Demo</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Stage Quick Switcher Pills */}
            <div className="bg-slate-900/70 border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-lg">
              <button
                type="button"
                aria-label="Previous step"
                onClick={() => handleStageSelect((activeStage - 1 + 4) % 4)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-4 gap-1.5 flex-1">
                {currentStageData.map((s, idx) => {
                  const isCurrent = activeStage === idx;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      aria-label={`Jump to stage ${s.num}`}
                      onClick={() => handleStageSelect(idx)}
                      className={`py-1.5 px-2 rounded-xl text-xxs font-mono font-bold transition-all text-center truncate cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950'
                          : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      {s.num} {s.category.split(' ')[0]}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                aria-label="Next step"
                onClick={() => handleStageSelect((activeStage + 1) % 4)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
