import React from 'react';
import { motion } from 'framer-motion';

interface GanttItem {
    id: string;
    label: string;
    value: string;
    percent: number;
}

interface CropCycleGanttProps {
    items?: GanttItem[];
}

const CropCycleGantt: React.FC<CropCycleGanttProps> = ({ items }) => {
    const displayItems = items || [];

    return (
        <div className="glass-premium p-8 rounded-[2.5rem] border-white/5 h-full">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black text-primary-300/40 uppercase tracking-[0.3em]">CROP CYCLE TIMELINE</h3>
                <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary-500/20" />)}
                </div>
            </div>
            <div className="space-y-6">
                {displayItems.length > 0 ? displayItems.map(item => (
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
                )) : (
                    <div className="text-[10px] font-bold text-primary-300/20 uppercase tracking-widest text-center py-10">
                        No active cycles found
                    </div>
                )}
            </div>
        </div>
    );
};

export default CropCycleGantt;
