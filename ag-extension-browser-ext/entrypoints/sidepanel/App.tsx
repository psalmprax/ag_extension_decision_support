import React, { useState } from 'react';
import { Send, Bot, User, Sparkles, Brain, Code, Terminal, Zap } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'I have analyzed the current page. This looks like an agricultural research portal from the FAO. I can help you extract data, summarize reports, or translate specific sections.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    setMessages([...messages, newMessage]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20 shadow-lg shadow-primary-500/5">
            <Brain className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter text-white uppercase italic">ALFA ADVISOR</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Link Active</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700">
             <Terminal className="w-4 h-4 text-slate-400" />
           </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              msg.role === 'assistant' 
                ? 'bg-primary-500/10 border-primary-500/20 shadow-lg shadow-primary-500/5' 
                : 'bg-secondary-500/10 border-secondary-500/20 shadow-lg shadow-secondary-500/5'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4 text-primary-400" /> : <User className="w-4 h-4 text-secondary-400" />}
            </div>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'assistant' 
                ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none' 
                : 'bg-primary-600 border border-primary-500 text-white rounded-tr-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md">
        <div className="flex gap-2 mb-3 px-1">
          {['Summarize', 'Extract Data', 'Analyze Page'].map(tag => (
            <button key={tag} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-tighter">
              {tag}
            </button>
          ))}
        </div>
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask ALFA Core..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-primary-500 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none transition-all placeholder:text-slate-600 shadow-inner"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary-600 hover:bg-primary-500 rounded-xl text-white transition-all shadow-lg shadow-primary-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] flex items-center justify-center gap-1">
           <Sparkles className="w-2.5 h-2.5" /> Powered by OpenCrew AI & Claude
        </p>
      </footer>
    </div>
  );
}

export default App;
