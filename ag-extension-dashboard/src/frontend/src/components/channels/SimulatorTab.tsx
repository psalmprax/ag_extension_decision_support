import React from 'react';
import {
  Sparkles,
  RefreshCw,
  Send,
  User,
  Bot,
} from 'lucide-react';

export interface SimulatorTabProps {
  simulatorMessages: Array<{ sender: 'farmer' | 'bot'; text: string }>;
  simulatorInput: string;
  setSimulatorInput: (val: string) => void;
  handleSimulatorSend: () => void;
  onResetSimulator: () => void;
}

export const SimulatorTab: React.FC<SimulatorTabProps> = ({
  simulatorMessages,
  simulatorInput,
  setSimulatorInput,
  handleSimulatorSend,
  onResetSimulator,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
          <Sparkles className="w-4 h-4" />
          <span>How Multi-Channel Self-Enrollment Works</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          When an unregistered farmer texts your SMS number, WhatsApp Business account, or Telegram Bot, the system
          automatically walks them through interactive conversational registration. Once finished, their profile is
          instantly added to your dashboard with real regional GPS coordinates!
        </p>
      </div>

      <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col h-80">
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-300">Live Conversational Simulation</span>
          </div>
          <button
            onClick={onResetSimulator}
            className="text-xxs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Simulator</span>
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-2.5 custom-scrollbar text-xs">
          {simulatorMessages.map((m, idx) => (
            <div key={idx} className={`flex ${m.sender === 'farmer' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2 whitespace-pre-wrap ${
                  m.sender === 'farmer'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                <div className="text-xxs opacity-60 mb-0.5 font-bold flex items-center gap-1">
                  {m.sender === 'farmer' ? (
                    <>
                      <span>Farmer Phone</span>
                      <User className="w-2.5 h-2.5" />
                    </>
                  ) : (
                    <>
                      <Bot className="w-2.5 h-2.5" />
                      <span>Ag-Advisory Bot</span>
                    </>
                  )}
                </div>
                <div>{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            value={simulatorInput}
            onChange={e => setSimulatorInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSimulatorSend()}
            placeholder="Type your response as a farmer..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            onClick={handleSimulatorSend}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>
        </div>
      </div>
    </div>
  );
};
