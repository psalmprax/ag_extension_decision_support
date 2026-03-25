import React from 'react';
import { motion } from 'framer-motion';
import { 
    Layers, 
    Zap, 
    Droplets, 
    Sun, 
    Navigation2,
    Shield,
    Cpu
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface Metric {
    label: string;
    value: string;
    status: string;
    icon: any;
    color: string;
}

interface SatelliteInsightsProps {
    farmerId: string;
    isCyber?: boolean;
    metrics?: Metric[];
}

export const SatelliteInsights: React.FC<SatelliteInsightsProps> = ({ farmerId, isCyber, metrics }) => {
    const { t } = useLanguage();

    const displayMetrics = metrics || [];

    return (
        <div className="space-y-8">
            {/* Real-time Telemetry Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isCyber ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-primary-100 text-primary-600'}`}>
                        <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-[0.2em] ${isCyber ? 'text-primary-400' : 'text-gray-900'}`}>
                            Spatial Intelligence
                        </h4>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                            Live Telemetry • ID: {farmerId.slice(0, 8)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-green-500">Active Scan</span>
                </div>
            </div>

            {/* Spatial Data Visualization */}
            <div className={`aspect-video rounded-3xl relative overflow-hidden border ${isCyber ? 'bg-black/40 border-primary-500/20 shadow-[0_0_30px_rgba(79,209,197,0.1)]' : 'bg-gray-100 border-gray-200'}`}>
                {isCyber && <div className="absolute inset-0 cyber-grid-premium opacity-30" />}
                
                {/* Data Points Layer */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-full h-full">
                        {[...Array(6)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.2 }}
                                className="absolute w-4 h-4"
                                style={{
                                    left: `${Math.random() * 80 + 10}%`,
                                    top: `${Math.random() * 80 + 10}%`
                                }}
                            >
                                <div className={`w-full h-full rounded-full ${i % 2 === 0 ? 'bg-green-500' : 'bg-yellow-500'} blur-sm opacity-50 pulse-ring`} />
                                <div className={`absolute inset-0 w-2 h-2 m-auto rounded-full ${i % 2 === 0 ? 'bg-green-400' : 'bg-yellow-400'} border border-white/40 shadow-lg`} />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div
                        animate={{ y: ['-100%', '200%'] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="w-full h-1/2 bg-gradient-to-b from-transparent via-primary-500/10 to-transparent blur-xl"
                    />
                </div>

                {/* Corner Labels */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <p className="text-[8px] font-black text-primary-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Layers className="w-3 h-3" />
                        Spectral Layer 04
                    </p>
                </div>
                <div className="absolute bottom-4 right-4 text-right">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                        Resolution: 0.5m/px
                    </p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
                {displayMetrics.length > 0 ? displayMetrics.map((m) => (
                    <div key={m.label} className={`p-4 rounded-2xl border ${isCyber ? 'bg-black/40 border-white/10 hover:border-primary-500/30' : 'bg-white border-gray-100 shadow-sm'} transition-all`}>
                        <div className="flex items-center gap-2 mb-2">
                            <m.icon className={`w-3 h-3 ${m.color}`} />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{m.label}</span>
                        </div>
                        <div className={`text-xl font-black ${isCyber ? 'text-white' : 'text-gray-900'}`}>
                            {m.value}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Shield className="w-2.5 h-2.5 text-green-500" />
                            <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">{m.status}</span>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-3 py-6 text-center text-[10px] font-black uppercase tracking-widest text-white/20">
                        Awaiting data stream...
                    </div>
                )}
            </div>

            {/* Analysis Summary */}
            <div className={`p-6 rounded-3xl border ${isCyber ? 'bg-primary-500/5 border-primary-500/20' : 'bg-blue-50/50 border-blue-100'}`}>
                <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${isCyber ? 'text-primary-400' : 'text-blue-600'}`}>
                    <Navigation2 className="w-3 h-3" />
                    Growth Trajectory Analysis
                </h5>
                <p className={`text-xs leading-relaxed font-medium ${isCyber ? 'text-gray-300' : 'text-gray-600'}`}>
                    Current vegetation indices indicate <span className="text-green-500 font-bold uppercase underline decoration-green-500/30">Stable Maturity</span> across 84% of the plot. Precipitation forecast suggests adequate soil moisture maintenance for the next 72 hours. No immediate pest-related anomalies detected.
                </p>
            </div>
        </div>
    );
};
