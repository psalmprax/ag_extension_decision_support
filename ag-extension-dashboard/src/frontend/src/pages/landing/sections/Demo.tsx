import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Wifi, CloudSun, Layers, Sprout, Activity } from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function Demo() {
  return (
        <section
          id="capabilities"
          className="relative py-28 border-t border-b border-white/[0.04] overflow-hidden scroll-mt-10"
        >
          <div id="architecture" className="absolute -top-16" />
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
                  className="p-6 rounded-xl backdrop-blur-md bg-slate-900/60 border border-white/[0.08] hover:border-emerald-500/30 hover:bg-slate-900/80 hover:shadow-xl hover:shadow-emerald-950/20 transition-all duration-300 flex flex-col justify-between"
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
              className="mt-10 p-6 sm:p-8 rounded-xl backdrop-blur-md bg-slate-900/70 border border-emerald-500/25 shadow-2xl shadow-emerald-950/30"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white/90 flex items-center gap-2">
                      Real-World Agronomic Intelligence Trail
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
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
              {[
                { title: 'FAOSTAT Integrated', sub: 'Verified Agro Standards', target: '#capabilities' },
                { title: 'Voice Synthesis', sub: 'Automated Visit Logs', target: '#features' },
                { title: 'Multi-District', sub: 'Climatic Zone Profiling', target: '#agent-os' },
                { title: 'Encrypted Store', sub: 'Tamper-Proof Records', target: '#faq' },
              ].map((item, idx) => (
                <a
                  key={idx}
                  href={item.target}
                  className="space-y-1 p-2 rounded-xl hover:bg-white/[0.04] transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <div className="text-sm sm:text-base font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-xs text-white/45 group-hover:text-white/70 transition-colors">{item.sub}</div>
                </a>
              ))}
            </motion.div>
          </div>
        </section>
  );
}
