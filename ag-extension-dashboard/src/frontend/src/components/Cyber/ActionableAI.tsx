import React from 'react';
import { motion } from 'framer-motion';
import { 
    Zap, 
    ShieldAlert, 
    TrendingUp, 
    Target, 
    BarChart3, 
    Globe, 
    Ship, 
    Truck,
    ArrowUpRight,
    Droplets,
    Wind,
    ThermometerSun
} from 'lucide-react';
import IsometricFarmOverview from './IsometricFarmOverview';

const ActionableAI = () => {
    return (
        <div className="w-full space-y-8 pb-12">
            {/* Header / Title Section */}
            <div className="relative p-8 rounded-[2rem] bg-gradient-to-br from-primary-900/40 to-black/60 border border-white/10 overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Zap className="w-32 h-32 text-primary-400" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="px-3 py-1 bg-primary-500/20 rounded-full border border-primary-500/30">
                            <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Priority Alpha</span>
                        </div>
                        <div className="h-px w-12 bg-white/20" />
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Real-time Decision Matrix</span>
                    </div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] mb-4">Actionable AI</h2>
                    <p className="max-w-2xl text-white/60 text-sm leading-relaxed font-medium capitalize">
                        Strategic intelligence layer for agricultural optimization. High-fidelity predictive modeling for risk mitigation and yield maximization across the regional supply chain.
                    </p>
                </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Spatial Intelligence */}
                <div className="col-span-8 space-y-8">
                    <div className="bg-black/20 border border-white/5 rounded-[2.5rem] p-4 relative">
                        <div className="absolute top-8 left-8 z-20 flex items-center gap-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center overflow-hidden">
                                        <div className="w-full h-full bg-primary-500 opacity-20" />
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">3 Satellite Nodes Active</span>
                        </div>
                        <IsometricFarmOverview />
                    </div>

                    {/* Supply Chain / Logistics Precision */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-primary-400" />
                                    Precision Logistics
                                </h3>
                                <ArrowUpRight className="w-4 h-4 text-white/20" />
                            </div>
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div>
                                        <div className="text-[8px] font-black text-white/40 uppercase mb-1">Optimal Route Found</div>
                                        <div className="text-xs font-bold text-white uppercase tracking-wider">Mombasa Port Path A</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-green-400 uppercase mb-1">-14% Time</div>
                                        <div className="text-xs font-black text-white">4.2h</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div>
                                        <div className="text-[8px] font-black text-white/40 uppercase mb-1">Cold Chain Integrity</div>
                                        <div className="text-xs font-bold text-white uppercase tracking-wider">Storage Facility #04</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-primary-400 uppercase mb-1">Stable</div>
                                        <div className="text-xs font-black text-white">4.5°C</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-secondary-400" />
                                    Yield Forecasting
                                </h3>
                                <div className="px-2 py-0.5 bg-green-500/10 rounded text-[8px] font-black text-green-400 uppercase tracking-widest">94% Confidence</div>
                            </div>
                            <div className="relative h-24 flex items-end gap-1 px-2">
                                {[35, 45, 30, 60, 85, 70, 95, 80, 100].map((h, i) => (
                                    <div 
                                        key={i} 
                                        className="flex-1 bg-gradient-to-t from-secondary-500/20 to-secondary-500/60 rounded-t-sm" 
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                            <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-white/40 uppercase">
                                <span>Q1 Forecast</span>
                                <span className="text-white">+12.4% Est. Growth</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Risk & Economic Matrix */}
                <div className="col-span-4 space-y-8">
                    {/* Critical Alerts */}
                    <div className="bg-error-500/10 border border-error-500/20 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ShieldAlert className="w-16 h-16 text-error-400" />
                        </div>
                        <h3 className="text-xs font-black text-error-400 uppercase tracking-widest mb-4 flex items-center gap-2 font-mono">
                            <Zap className="w-4 h-4 animate-pulse" />
                            System Anomalies
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-error-500/5 rounded-xl border border-error-500/10">
                                <p className="text-[11px] font-black text-white uppercase tracking-tight mb-1">Water Scarcity Probability</p>
                                <p className="text-[10px] text-white/60 leading-relaxed font-medium lowercase">Rift Valley Sector 4 observing 15% moisture decline. Irrigation overrides suggested.</p>
                            </div>
                        </div>
                    </div>

                    {/* Meteorological Stream */}
                    <div className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary-500/20 rounded-lg">
                                <Globe className="w-5 h-5 text-primary-400" />
                            </div>
                            <span className="text-xs font-black text-white uppercase tracking-[0.2em]">Environment Stream</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                <ThermometerSun className="w-4 h-4 text-orange-400 mx-auto mb-2" />
                                <div className="text-[8px] font-black text-white/40 uppercase mb-1">Temp</div>
                                <div className="text-[11px] font-black text-white">31°C</div>
                            </div>
                            <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-2" />
                                <div className="text-[8px] font-black text-white/40 uppercase mb-1">Humid</div>
                                <div className="text-[11px] font-black text-white">62%</div>
                            </div>
                            <div className="text-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                <Wind className="w-4 h-4 text-primary-400 mx-auto mb-2" />
                                <div className="text-[8px] font-black text-white/40 uppercase mb-1">Wind</div>
                                <div className="text-[11px] font-black text-white">14km/s</div>
                            </div>
                        </div>
                    </div>

                    {/* Economic Performance */}
                    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-white/10 rounded-3xl p-8 backdrop-blur-md text-center">
                        <BarChart3 className="w-12 h-12 text-primary-400 mx-auto mb-4 opacity-40" />
                        <h4 className="text-[10px] font-black text-primary-400 uppercase tracking-[0.3em] mb-4">Economic Index Rank</h4>
                        <div className="flex items-center justify-center gap-4">
                            <div className="text-5xl font-black text-white tracking-tighter">#04</div>
                            <div className="text-left">
                                <span className="block text-[8px] font-black text-green-400 uppercase">+18.5%</span>
                                <span className="block text-[10px] font-black text-white/60 uppercase">Top 2% Regional</span>
                            </div>
                        </div>
                        <button className="w-full mt-8 py-4 bg-primary-500 rounded-2xl font-black text-[10px] text-white uppercase tracking-[0.2em] shadow-lg shadow-primary-500/20 hover:bg-primary-600 transition-all">
                            Generate Full Strategy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActionableAI;
