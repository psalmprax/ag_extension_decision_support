import React from 'react';
import { useAppStore } from '@/store/useAppStore';

const MaintenanceDiagnostics: React.FC = () => {
  const { addNotification } = useAppStore();

  const handleDownload = () => {
    addNotification({
      type: 'info',
      message: 'Generating Equipment Diagnostic Report...'
    });
    
    // Simulate file generation and download
    setTimeout(() => {
      const data = {
        reportId: 'DIAG-2024-001',
        timestamp: new Date().toISOString(),
        equipment: 'Ag-Extension-Tractor-01',
        diagnostics: {
          engine: 'Optimal',
          transmission: 'Optimal',
          hydraulics: 'Alert: Check Pressure',
          downtimeAvoided: '15 HRS'
        }
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagnostics-report.json';
      a.click();
      URL.revokeObjectURL(url);
      
      addNotification({
          type: 'success',
          message: 'Maintenance Report downloaded successfully'
      });
    }, 1000);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden h-full flex flex-col group">
        <div className="flex justify-between items-start mb-6">
            <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    EQUIPMENT PREDICTIVE MAINTENANCE
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-ping"></div>
                </h4>
            </div>
            <button 
                onClick={handleDownload}
                className="text-gray-500 hover:text-white transition-colors"
                title="Download Report"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </button>
        </div>

        <div className="flex-1 relative flex items-center justify-center py-8">
            <div className="relative w-full max-w-[280px]">
                {/* Tractor SVG Outline (Simplified) */}
                <svg viewBox="0 0 200 150" className="w-full drop-shadow-[0_0_15px_rgba(79,209,197,0.1)]">
                    <g fill="none" stroke="#4FD1C5" strokeWidth="1.5" strokeOpacity="0.4" className="transition-opacity group-hover:stroke-opacity-70">
                        {/* Cab */}
                        <path d="M70,80 L70,40 L120,40 L120,80" />
                        {/* Body */}
                        <path d="M40,110 L160,110 L160,80 L40,80 Z" />
                        {/* Wheels */}
                        <circle cx="60" cy="115" r="25" />
                        <circle cx="140" cy="115" r="25" />
                        <circle cx="60" cy="115" r="12" />
                        <circle cx="140" cy="115" r="12" />
                        {/* Hood */}
                        <path d="M120,80 L160,80 L160,60 L125,50 Z" />
                    </g>
                    
                    {/* Alert Hotspot */}
                    <g className="animate-glow">
                        <circle cx="130" cy="90" r="8" fill="#F6AD55" fillOpacity="0.2" />
                        <circle cx="130" cy="90" r="3" fill="#F6AD55" />
                        <path d="M130,80 L130,70" stroke="#F6AD55" strokeWidth="2" strokeLinecap="round" />
                    </g>
                </svg>

                {/* Status Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="glass-premium px-4 py-2 rounded-xl border-secondary-500/40 flex items-center gap-3 animate-slide-up">
                        <svg className="w-5 h-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-xs font-bold text-white tracking-widest uppercase">Alert</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-auto pt-6 border-t border-white/5">
            <div className="glass-premium p-4 rounded-xl border-primary-500/20">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary-300/40 uppercase tracking-widest leading-none">Est. Downtime Avoided:</span>
                    <span className="text-lg font-bold text-primary-400 tabular-nums leading-none">15 HRS</span>
                </div>
            </div>
        </div>
        
        {/* Background Ambient Light */}
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary-500/5 rounded-full blur-[60px] pointer-events-none"></div>
    </div>
  );
};

export default MaintenanceDiagnostics;
