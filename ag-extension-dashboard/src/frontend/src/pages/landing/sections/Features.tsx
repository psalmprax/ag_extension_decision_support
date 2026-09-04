import React from 'react';
import { motion } from 'framer-motion';
import { Users, BarChart3, CheckCircle2, MessageSquare, Smartphone } from 'lucide-react';
import { stagger, fadeUp } from '../variants';

export function Features() {
  return (
        <section id="features" className="relative py-20 sm:py-28 border-t border-white/[0.04]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-[90rem] w-full mx-auto px-4 sm:px-6 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={stagger}
              className="text-center max-w-3xl mx-auto mb-14 sm:mb-20"
            >
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-[0.2em] mb-4"
              >
                <Users className="w-3.5 h-3.5" />
                Who We Empower
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="text-[clamp(2rem,3.5vw,3rem)] font-bold tracking-tight leading-tight text-white mb-4"
              >
                Built for the real field.{' '}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-amber-300 bg-clip-text text-transparent">
                  Grounded in rural realities.
                </span>
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-white/70 leading-relaxed font-normal"
              >
                Connecting smallholder farms, mobile extension officers, and enterprise leadership in one unified, offline-first ecosystem.
              </motion.p>
            </motion.div>

            {/* 3-Persona Visual Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {/* Persona 1: The Smallholder Farmer */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl hover:shadow-emerald-950/40"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/persona-farmer.webp"
                    alt="Smallholder farmer in maize field receiving mobile SMS advisory"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xxs font-bold uppercase tracking-wider">
                    <MessageSquare className="w-3 h-3 text-amber-400" />
                    Direct Farmer Advisory
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      Zero Smartphone Required
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      The Smallholder Farmer
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      Receives actionable planting advice, disease treatment steps, and NASA rain alerts via 2G SMS and USSD in local dialects.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>2G/3G SMS &amp; USSD Direct Dialing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Hyperlocal NASA Rain &amp; Storm Warnings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Swahili, Luganda, English &amp; Voice STT</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Persona 2: The Agricultural Extension Officer */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-emerald-500/30 hover:border-emerald-500/60 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl shadow-emerald-950/30 hover:shadow-emerald-950/60 ring-1 ring-emerald-500/20"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/persona-officer.webp"
                    alt="Field extension officer diagnosing crop leaf health in the field with mobile AI app"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xxs font-bold uppercase tracking-wider">
                    <Smartphone className="w-3 h-3 text-emerald-400" />
                    Field-Ready Mobile PWA
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-emerald-300 bg-emerald-500/30 border border-emerald-400/40 px-2 py-0.5 rounded-md font-bold">
                      100% Offline-First Sync
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      The Field Extension Officer
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      Conducts rapid digital farm visits, captures leaf photos for instant AI disease identification, and logs records offline in remote areas.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Offline Encrypted IndexedDB Storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Instant Multimodal Leaf &amp; Pest Diagnosis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>GPS Parcel Mapping &amp; Yield Scoring</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Persona 3: Regional & Cooperative Managers */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                className="group relative rounded-xl backdrop-blur-xl bg-slate-900/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl hover:shadow-emerald-950/40"
              >
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950">
                  <img
                    src="/images/landing/persona-manager.webp"
                    alt="Regional agribusiness manager analyzing yield analytics and field operations on dashboard"
                    width={600}
                    height={450}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 filter brightness-95 group-hover:brightness-100"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xxs font-bold uppercase tracking-wider">
                    <BarChart3 className="w-3 h-3 text-cyan-400" />
                    Macro Yield &amp; Supply Intelligence
                  </div>
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-xxs font-mono text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                      Enterprise Oversight
                    </span>
                  </div>
                </div>

                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
                      Regional &amp; Cooperative Directors
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      Tracks district-wide disease vectors, monitors officer visit throughput, and exports auditable PDF/Excel compliance reports.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.06] space-y-2 text-xs text-white/80 font-medium">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>District-Wide Outbreak &amp; Soil Heatmaps</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Extension Officer Visit Efficacy Metrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>1-Click Auditable PDF &amp; Excel Exports</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
  );
}
