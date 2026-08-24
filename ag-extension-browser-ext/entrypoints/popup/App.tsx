import React, { useState } from 'react';
import { Settings, Shield, Zap, ChevronRight, BarChart3, Cloud, ArrowLeft, Globe, Server, Bot, Save } from 'lucide-react';
import { usePersistence } from '@/shared/hooks/usePersistence';
import CONFIG from '../../shared/config';

function App() {
  const [activeAgent, setActiveAgent] = usePersistence('activeAgent', 'AGENT ALPHA');
  const [language, setLanguage] = usePersistence('language', 'en');
  const [apiEndpoint, setApiEndpoint] = usePersistence('apiEndpoint', CONFIG.API_BASE_URL);
  const [showSettings, setShowSettings] = useState(false);

  const handleOpenSidepanel = () => {
    if (browser?.runtime) {
      browser.runtime.sendMessage({ action: 'open_sidepanel' });
    }
  };

  const handleQuickAction = (action: string) => {
    if (action === 'Settings') {
      setShowSettings(true);
      return;
    }
    
    handleOpenSidepanel();
    // Use a small delay to ensure sidepanel is open before sending message
    setTimeout(() => {
      if (browser?.runtime) {
        browser.runtime.sendMessage({ 
          action: 'trigger_quick_action', 
          actionType: action 
        });
      }
    }, 500);
  };

  if (showSettings) {
    return (
      <div className="w-full min-w-[320px] max-w-[380px] bg-slate-950 text-white shadow-2xl overflow-hidden font-sans min-h-[400px] border border-white/10 rounded-2xl">
        <header className="p-3.5 sm:p-4 bg-slate-900 border-b border-white/10 flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-sm font-bold tracking-tight uppercase text-white">System Settings</h1>
        </header>

        <main className="p-4 space-y-5">
          {/* Language Setting */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1">
              <Globe className="w-3 h-3" /> Language Preference
            </label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
            >
              <option value="en" className="bg-slate-950">English (Global)</option>
              <option value="sw" className="bg-slate-950">Kiswahili (East Africa)</option>
              <option value="fr" className="bg-slate-950">Français (West Africa)</option>
            </select>
          </div>

          {/* Agent Setting */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1">
              <Bot className="w-3 h-3" /> Default Intelligence Agent
            </label>
            <select 
              value={activeAgent}
              onChange={(e) => setActiveAgent(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
            >
              <option value="AGENT ALPHA" className="bg-slate-950">Agent Alpha (Standard)</option>
              <option value="AGENT SIGMA" className="bg-slate-950">Agent Sigma (Specialist)</option>
              <option value="AGENT BETA" className="bg-slate-950">Agent Beta (Experimental)</option>
            </select>
          </div>

          {/* API Setting */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1">
              <Server className="w-3 h-3" /> Backend API Endpoint
            </label>
            <input 
              type="text"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="https://your-api.com/api"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:ring-1 focus:ring-emerald-400 outline-none transition-all"
            />
          </div>

          <button 
            onClick={() => setShowSettings(false)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            SAVE & RETURN
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full min-w-[320px] max-w-[380px] bg-slate-950 text-white shadow-2xl overflow-hidden font-sans border border-white/10 rounded-2xl">
      {/* Header */}
      <header className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-600 to-teal-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20 shrink-0">
            <img src="/logo.png" alt="GPExts Logo" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">GPExts</h1>
            <p className="text-[10px] text-emerald-100 font-medium opacity-90 uppercase tracking-widest">Decision Support</p>
          </div>
        </div>
        <button 
          onClick={() => handleQuickAction('Settings')}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors active:scale-95"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-white/90" />
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* Agent Select Panel */}
        <section className="space-y-2">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest px-1">Active AI Intelligence</p>
          <button 
            type="button"
            onClick={handleOpenSidepanel}
            className="w-full text-left p-3.5 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30 text-emerald-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors uppercase">{activeAgent}</h3>
                  <p className="text-xxs text-white/50">Ready for smallholder advisory</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-emerald-400 transition-colors shrink-0" />
            </div>
          </button>
        </section>

        {/* Quick Actions Grid */}
        <section className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleQuickAction('Summarize')}
            className="p-3.5 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-emerald-500/30 flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span className="text-xxs font-bold tracking-wider uppercase text-white">INSIGHTS</span>
          </button>
          <button 
            onClick={() => handleQuickAction('Weather')}
            className="p-3.5 bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 hover:border-emerald-500/30 flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <Cloud className="w-5 h-5 text-sky-400" />
            <span className="text-xxs font-bold tracking-wider uppercase text-white">WEATHER</span>
          </button>
        </section>

        {/* Page Context */}
        <section className="p-3.5 bg-emerald-500/10 backdrop-blur-xl rounded-2xl border border-emerald-500/20">
          <div className="flex items-center justify-between mb-1.5">
             <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Page Analysis</span>
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs text-white/80 leading-relaxed">
            Agricultural context detected on this page. Press <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] border border-white/10 text-white font-mono">⌘⇧A</kbd> to activate side-panel assistance.
          </p>
        </section>
      </main>

      {/* Footer */}
      <button 
        type="button" 
        className="w-full p-3 bg-slate-950 border-t border-white/10 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-900 transition-all focus:outline-none" 
        onClick={handleOpenSidepanel}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">Connected to ALFA Core</span>
      </button>
    </div>
  );
}

export default App;
