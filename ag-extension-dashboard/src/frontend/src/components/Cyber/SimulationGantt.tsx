import React from 'react';
import { motion } from 'framer-motion';

interface GanttItem {
    id: string;
    label: string;
    value: string;
    percent: number;
}

interface SimulationGanttProps {
    items?: GanttItem[];
}

const SimulationGantt: React.FC<SimulationGanttProps> = ({ items }) => {
    const defaultItems: GanttItem[] = [
        { id: '1', label: 'PHASE_01', value: '35%', percent: 35 },
        { id: '2', label: 'PHASE_02', value: '50%', percent: 50 },
        { id: '3', label: 'PHASE_03', value: '65%', percent: 65 },
        { id: '4', label: 'PHASE_04', value: '80%', percent: 80 },
    ];

    const displayItems = items || defaultItems;

    return (
        <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em]">CROP CYCLE SIMULATION</h3>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500/20" />)}
                </div>
            </div>
            <div className="space-y-6">
                {displayItems.map(item => (
                    <div key={item.id} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-primary-300/30">
                            <span>{item.label}</span>
                            <span>{item.value}</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percent}%` }}
                                className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SimulationGantt;
