import React from 'react';

const SimulationGantt = () => {
    return (
        <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em]">CROP CYCLE SIMULATION</h3>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500/20" />)}
                </div>
            </div>
            <div className="space-y-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-primary-300/30">
                            <span>PHASE_0{i}</span>
                            <span>{20 + i * 15}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                                style={{ width: `${20 + i * 15}%` }} 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SimulationGantt;
