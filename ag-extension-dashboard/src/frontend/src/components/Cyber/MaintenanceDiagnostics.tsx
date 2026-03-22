import React from 'react';

const MaintenanceDiagnostics: React.FC = () => {
    return (
        <div className="glass-premium p-6 rounded-3xl border-primary-500/20 h-full">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-300/60 mb-6">Health Diagnostics: Node v84</h3>
            <div className="flex justify-center mb-8 relative">
                <div className="w-32 h-32 rounded-full border-4 border-primary-500/20 flex items-center justify-center relative">
                    <div className="w-24 h-24 rounded-full border-2 border-primary-500 animate-spin-slow opacity-50 shadow-[0_0_20px_rgba(0,255,255,0.2)]" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tighter shadow-sm">84%</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary-300/60 mt-0.5">Vitals</span>
                    </div>
                    {/* Pulsing Dot */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-secondary-500 rounded-full shadow-[0_0_10px_rgba(255,0,255,0.5)] animate-pulse" />
                </div>
            </div>
            
            <div className="space-y-3">
                {[
                    { label: 'Soil Core', status: 'Optimal', color: 'text-primary-400' },
                    { label: 'Pest Vector', status: 'Stable', color: 'text-secondary-400' },
                    { label: 'Nutrient Flow', status: 'Warning', color: 'text-yellow-400' }
                ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-t border-white/5">
                        <span className="text-[10px] font-bold text-primary-300/40 uppercase tracking-widest">{item.label}</span>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${item.color}`}>{item.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MaintenanceDiagnostics;
