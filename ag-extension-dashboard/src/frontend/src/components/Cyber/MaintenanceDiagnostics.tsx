import React from 'react';

const MaintenanceDiagnostics = () => {
    return (
        <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full flex flex-col justify-between">
            <div>
                <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em] mb-8">SYSTEM DIAGNOSTICS</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        <span className="text-xs font-bold text-white/60">SENSORS_ONLINE</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        <span className="text-xs font-bold text-white/60">NETWORK_STABLE</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                        <span className="text-xs font-bold text-white/60">IO_THROTTLED</span>
                    </div>
                </div>
            </div>
            <div className="pt-8 border-t border-white/5 mt-8">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-[10px] font-black text-primary-300/20 uppercase tracking-widest mb-1">Health Score</p>
                        <p className="text-4xl font-black text-white tabular-nums tracking-tighter">94.2</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                        <span className="text-primary-400 font-black text-xl">A</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceDiagnostics;
