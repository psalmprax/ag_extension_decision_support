import React, { useState } from 'react';
import { Settings, Shield, Zap, ChevronRight, BarChart3, Cloud } from 'lucide-react';

function App() {
  const [activeAgent, setActiveAgent] = useState('AGENT ALPHA');

  const handleOpenSidepanel = () => {
    const chromeAPI = (window as any).chrome;
    if (chromeAPI && chromeAPI.runtime) {
      chromeAPI.runtime.sendMessage({ action: 'open_sidepanel' });
    }
  };

  const handleQuickAction = (action: string) => {
    handleOpenSidepanel();
    // Use a small delay to ensure sidepanel is open before sending message
    setTimeout(() => {
      const chromeAPI = (window as any).chrome;
      if (chromeAPI && chromeAPI.runtime) {
        chromeAPI.runtime.sendMessage({ 
          action: 'trigger_quick_action', 
          actionType: action 
        });
      }
    }, 500);
  };

  return (
    <div className="w-[360px] bg-slate-900 text-white shadow-2xl overflow-hidden font-sans">
      {/* Header */}
      <header className="p-4 bg-gradient-to-r from-primary-600 to-primary-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">AG-EXTENSION</h1>
            <p className="text-[10px] text-primary-100 font-medium opacity-80 uppercase tracking-widest">Alpha v0.1.0</p>
          </div>
        </div>
        <button 
          onClick={() => handleQuickAction('Settings')}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Settings className="w-4 h-4 text-white/80" />
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* Agent Select Panel */}
        <section className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Active AI Intelligence</p>
          <div 
            onClick={handleOpenSidepanel}
            className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-primary-500/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                  <Shield className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors uppercase">{activeAgent}</h3>
                  <p className="text-xs text-slate-400">Ready for page analysis</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary-500" />
            </div>
          </div>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleQuickAction('Summarize')}
            className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:bg-slate-800 flex flex-col items-center gap-2 transition-all"
          >
            <BarChart3 className="w-5 h-5 text-secondary-400" />
            <span className="text-[11px] font-bold tracking-wide">INSIGHTS</span>
          </button>
          <button 
            onClick={() => handleQuickAction('Weather')}
            className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:bg-slate-800 flex flex-col items-center gap-2 transition-all"
          >
            <Cloud className="w-5 h-5 text-blue-400" />
            <span className="text-[11px] font-bold tracking-wide">WEATHER</span>
          </button>
        </section>

        {/* Page Context */}
        <section className="p-3 bg-primary-900/10 rounded-xl border border-primary-500/10">
          <div className="flex items-center justify-between mb-2">
             <span className="text-[10px] font-bold text-primary-500/80 uppercase tracking-widest">Page Analysis</span>
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Agricultural context detected on this page. Press <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] border border-slate-600">⌘⇧A</kbd> or click above to activate side-panel assistance.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="p-3 bg-slate-950/50 border-t border-slate-800/50 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-900 transition-all" onClick={handleOpenSidepanel}>
        <div className="w-2 h-2 rounded-full bg-primary-500" />
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">Connected to ALFA Core</span>
      </footer>
    </div>
  );
}

export default App;
