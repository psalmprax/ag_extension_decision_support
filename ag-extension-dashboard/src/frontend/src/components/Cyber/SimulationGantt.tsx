import React, { useState } from 'react';

interface SimulationStep {
  id: string;
  label: string;
  start: number;
  duration: number;
  color: string;
}

const SimulationGantt: React.FC = () => {
  const [profitOffset, setProfitOffset] = useState(2400);
  const [activeSimulation, setActiveSimulation] = useState<'standard' | 'delayed'>('delayed');

  const timelineSteps: SimulationStep[] = [
    { id: '1', label: 'DELAYED PLANTING', start: 20, duration: 25, color: '#4FD1C5' },
    { id: '2', label: 'STANDARD', start: 10, duration: 40, color: '#F6AD55' },
  ];

  return (
    <div className="glass-panel-glow p-6 rounded-2xl border border-secondary-500/20 relative overflow-hidden h-full flex flex-col">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            WHAT-IF SIMULATION
            <span className="text-[10px] text-secondary-400 normal-case font-normal lowercase">Interactive gantt simulation timeline</span>
          </h4>
        </div>
        <button className="text-secondary-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-8 mt-4">
        {timelineSteps.map((step) => (
          <div key={step.id} className="relative group">
            <div className="flex justify-between mb-2">
              <span className={`text-[10px] font-bold tracking-tighter uppercase ${activeSimulation === (step.label.toLowerCase().includes('delayed') ? 'delayed' : 'standard') ? 'text-white' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
            <div className="h-4 bg-gray-800/50 rounded-full w-full relative overflow-hidden border border-white/5">
              <div 
                className={`absolute inset-y-0 rounded-full transition-all duration-700 ease-out ${step.label.toLowerCase().includes('delayed') ? 'neon-glow-primary' : 'neon-glow-secondary'}`}
                style={{ 
                  left: `${step.start}%`, 
                  width: `${step.duration}%`,
                  backgroundColor: step.color,
                  opacity: activeSimulation === (step.label.toLowerCase().includes('delayed') ? 'delayed' : 'standard') ? 1 : 0.3
                }}
              >
                {/* Drag handle mockup */}
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/40 cursor-ew-resize"></div>
              </div>
            </div>
            
            {/* Grid markings */}
            <div className="absolute top-8 left-0 right-0 flex justify-between px-1 opacity-20 pointer-events-none">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                    <div key={val} className="flex flex-col items-center gap-1">
                        <div className="h-2 w-[1px] bg-white"></div>
                        <span className="text-[8px] text-white tabular-nums">{val}</span>
                    </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-secondary-900/40 p-4 rounded-xl border border-secondary-500/20 backdrop-blur-md">
        <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-secondary-100 uppercase tracking-widest">ECONOMIC ADVANTAGE:</span>
            <span className="text-xl font-bold text-primary-400 tabular-nums text-glow">
                +${profitOffset.toLocaleString()} Profit
            </span>
        </div>
      </div>
      
      {/* Simulation Toggle Mockup */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 to-transparent"></div>
    </div>
  );
};

export default SimulationGantt;
