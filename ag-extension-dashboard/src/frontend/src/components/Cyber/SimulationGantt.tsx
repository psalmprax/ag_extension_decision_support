import React from 'react';

const SimulationGantt: React.FC = () => {
    return (
        <div className="glass-premium p-6 rounded-3xl border-primary-500/20 h-full">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-300/60 mb-6">Execution Timeline: S-Gantt x86</h3>
            <div className="space-y-4">
                {[
                    { label: 'Planting Delta', progress: 45, color: 'bg-primary-500', time: 'Active' },
                    { label: 'Irrigation Sync', progress: 82, color: 'bg-secondary-500', time: 'Pending' },
                    { label: 'Harvest Logic', progress: 12, color: 'bg-purple-500', time: 'Scheduled' },
                ].map((item, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold text-white uppercase tracking-widest">
                            <span>{item.label}</span>
                            <span className="text-primary-300/40">{item.time}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className={`h-full ${item.color} neon-glow-primary transition-all duration-1000`} 
                                style={{ width: `${item.progress}%` }} 
                            />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-8 border-t border-white/5 pt-4 flex justify-between text-[8px] font-bold text-primary-300/40 uppercase tracking-widest">
                <span>00:00:00</span>
                <span>12:00:00</span>
                <span>24:00:00</span>
            </div>
        </div>
    );
};

export default SimulationGantt;
