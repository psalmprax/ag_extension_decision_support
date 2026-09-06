import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { Sparkline, GlobalConstellationVisualization } from '@/components/landing/Visuals';
import { CH_COLORS } from '@/lib/colors';
import {
  Users, MapPin, Brain, BarChart3, Shield, ArrowRight, Database, TrendingUp, FileText,
  Bell, Wifi, ChevronDown, Play, Sparkles, Radio, CheckCircle2, Smartphone,
} from 'lucide-react';
import { stagger, fadeUp, scaleIn } from '../variants';
import { globalTelemetryNodes } from '../data';

export function Hero({ heroY, heroOpacity }: { heroY: MotionValue<number>; heroOpacity: MotionValue<number> }) {
  const navigate = useNavigate();

  return (
        <section
          className="relative min-h-screen flex items-start sm:items-center pt-20 sm:pt-24 pb-10 sm:pb-16 overflow-hidden"
        >
          {/* Authentic Agricultural Extension Officer & Smallholder Partnership Backdrop */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <img
              src="/images/landing/officer-farmer-hero.webp"
              alt="Agricultural extension officer consulting with a smallholder farmer in a maize field using a digital tablet"
              width={1920}
              height={1080}
              className="w-full h-full object-cover object-center opacity-25 mix-blend-luminosity scale-105 filter saturate-125 transition-opacity duration-700"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/60 to-slate-950" />
          </div>

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
          <GlobalConstellationVisualization nodes={globalTelemetryNodes} />

          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="max-w-7xl w-full min-w-0 mx-auto px-4 sm:px-6 grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-center relative z-10"
          >
            {/* Left copy */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-5 sm:space-y-8 text-center sm:text-left mx-auto sm:mx-0 min-w-0 max-w-full overflow-hidden">
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-sm max-w-full mx-auto sm:mx-0 overflow-hidden"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[10px] sm:text-xs font-medium tracking-wide text-white/80 font-mono truncate">
                  Global Agricultural Decision Support Platform
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.12] sm:leading-[1.08] tracking-tight text-white"
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
                className="text-sm sm:text-base lg:text-lg text-white/80 leading-relaxed max-w-lg mx-auto sm:mx-0 font-normal"
              >
                Empower extension officers with AI-driven insights, real-time farmer tracking, and
                data-powered decisions across the Globe.
              </motion.p>

              {/* What it is / Who it's for / What it solves */}
              <motion.div
                variants={fadeUp}
                className="space-y-2 sm:space-y-2.5 max-w-lg mx-auto sm:mx-0 pt-1"
              >
                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm flex items-start gap-2 sm:gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-xs sm:text-sm text-white/80 leading-snug">
                    <strong className="text-emerald-400 font-semibold uppercase tracking-wider text-[11px] block mb-0.5">What it is</strong>
                    Field-ready decision-support platform for agricultural extension officers managing thousands of farmers across districts.
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm flex items-start gap-2 sm:gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-3 h-3 text-sky-400" />
                  </div>
                  <div className="text-xs sm:text-sm text-white/80 leading-snug">
                    <strong className="text-sky-400 font-semibold uppercase tracking-wider text-[11px] block mb-0.5">Who it&apos;s for</strong>
                    Government agencies, NGOs, and cooperatives running agricultural improvement programs.
                  </div>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm flex items-start gap-2 sm:gap-2.5">
                  <div className="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="text-xs sm:text-sm text-white/80 leading-snug">
                    <strong className="text-amber-400 font-semibold uppercase tracking-wider text-[11px] block mb-0.5">What it solves</strong>
                    Paper-based field visits, guesswork recommendations, delayed disease response, and zero visibility into farmer outcomes.
                  </div>
                </div>
              </motion.div>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                <button
                  onClick={() => navigate('/register')}
                  className="w-full sm:w-auto relative group overflow-hidden px-6 sm:px-7 py-3 sm:py-3.5 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-500 border border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-[0_0_36px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  <span className="relative z-10 flex items-center gap-2">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-white/90" />
                  </span>
                </button>
                <button
                  onClick={() => navigate('/demo')}
                  className="w-full sm:w-auto group px-6 sm:px-7 py-3 sm:py-3.5 text-sm font-semibold bg-white/[0.05] border border-white/[0.08] text-white/80 rounded-xl hover:bg-white/[0.1] hover:text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  <Play className="w-4 h-4 text-emerald-400" />
                  Try Live Demo
                </button>
              </motion.div>

              {/* Mobile / Store Readiness Badge Strip */}
              <motion.div
                variants={fadeUp}
                className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5"
              >
                <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 text-[11px] sm:text-xs font-medium max-w-full overflow-hidden">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Field PWA (Android / iOS / Mobile Chrome)</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-[11px] font-bold font-mono max-w-full overflow-hidden">
                  <Radio className="w-3 h-3 animate-pulse shrink-0" />
                  <span className="truncate">Apple Store &amp; Play Store Compatible</span>
                </div>
              </motion.div>

              {/* Feature highlights */}
              <motion.div variants={fadeUp} className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-1">
                {[
                  { title: 'Satellite Weather', sub: 'NASA POWER API', target: '#capabilities' },
                  { title: 'Soil Telemetry', sub: 'SoilGrids ISRIC', target: '#capabilities' },
                  { title: 'Offline-First', sub: 'Instant Local Sync', target: '#features' },
                ].map((item, i) => (
                  <a
                    key={i}
                    href={item.target}
                    className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-emerald-500/30 hover:bg-white/[0.06] active:scale-[0.98] transition-all group block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <div className="text-[10px] sm:text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                      <span className="truncate">{item.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 sm:group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-400 shrink-0 hidden sm:block" />
                    </div>
                    <div className="text-[9px] sm:text-[11px] text-white/50 mt-0.5 font-medium group-hover:text-white/70 transition-colors truncate">{item.sub}</div>
                  </a>
                ))}
              </motion.div>
            </motion.div>

            {/* Right — Detailed dashboard mockup */}
            <motion.div initial="hidden" animate="visible" variants={scaleIn} className="relative w-full max-w-full min-w-0">
              {/* Glow behind mockup */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-amber-500/10 blur-[60px] rounded-full scale-90" />

              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-slate-950 shadow-2xl shadow-black/60 w-full max-w-full lg:transform lg:perspective-[1200px] lg:rotate-y-[2deg] lg:-rotate-x-[1deg] lg:hover:rotate-y-0 lg:hover:rotate-x-0 transition-transform duration-700">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                  <div className="flex gap-1.5 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                  </div>
                  <div className="flex-1 min-w-0 flex justify-center">
                    <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-xxs text-white/30 font-mono truncate max-w-full">
                      app.gpexts.com/dashboard
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Bell className="w-3 h-3 text-white/30" />
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[7px] font-bold">
                      A
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] min-h-[360px] sm:min-h-[380px]">
                  {/* Sidebar (hidden on small mobile screens to prevent squishing) */}
                  <div className="hidden md:block bg-white/[0.015] border-r border-white/[0.05] p-2.5 text-xxs space-y-0.5">
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
                          <span className="text-[8px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                            {item.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Main content */}
                  <div className="p-3 bg-white/[0.005] space-y-2.5 overflow-hidden">
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                              className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md"
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
                    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-2">
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
                              className={`px-1.5 py-0.5 rounded-md text-[8px] font-semibold ${f.statusBg}`}
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
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none z-20" />

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
  );
}
