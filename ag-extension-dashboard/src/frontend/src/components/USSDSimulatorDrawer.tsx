import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  PhoneCall,
  RotateCcw,
  Smartphone,
  Sparkles,
  CheckCircle,
  Globe,
  Radio,
  Send,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface USSDSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onEscalate?: (farmerName: string, reason: string) => void;
}

type USSDStep = 'idle' | 'dialing' | 'main' | 'diagnose' | 'weather' | 'officer' | 'feedback' | 'response';

export const USSDSimulatorDrawer: React.FC<USSDSimulatorDrawerProps> = ({
  isOpen,
  onClose,
  onEscalate,
}) => {
  useLanguage();
  const [dialCode, setDialCode] = useState('*384*274#');
  const [ussdStep, setUssdStep] = useState<USSDStep>('idle');
  const [userInput, setUserInput] = useState('');
  const [selectedLang, setSelectedLang] = useState<'en' | 'sw' | 'fr'>('en');
  const [sessionLogs, setSessionLogs] = useState<Array<{ sender: 'user' | 'ussd'; text: string; time: string }>>([]);

  const handleDialPadPress = (val: string) => {
    if (ussdStep === 'idle') {
      setDialCode(prev => prev + val);
    } else {
      setUserInput(prev => prev + val);
    }
  };

  const addLog = (sender: 'user' | 'ussd', text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSessionLogs(prev => [...prev, { sender, text, time }]);
  };

  const getMainMenuText = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'CON Karibu GPExts Huduma:\n1. Tambua Ugonjwa wa Mmea\n2. Hali ya Hewa & Tahadhari\n3. Omba Afisa wa Ugani\n4. Toa Maoni';
      case 'fr':
        return 'CON Bienvenue sur GPExts:\n1. Diagnostiquer maladie des plantes\n2. Météo & Alertes\n3. Contacter un agronome\n4. Commentaires';
      default:
        return 'CON Welcome to GPExts:\n1. Diagnose Crop Disease\n2. Weather & Pest Alerts\n3. Request Field Officer Call\n4. Provide Service Feedback';
    }
  };

  const getDiagnosePrompt = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'CON Eleza dalili za mmea wako (mfano: majani yana madoa meusi):';
      case 'fr':
        return 'CON Décrivez les symptômes de votre culture:';
      default:
        return 'CON Describe your crop symptoms (e.g., dark water-soaked spots on leaves):';
    }
  };

  const getWeatherText = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'END Tahadhari: Mvua kubwa inatarajiwa Nakuru kesho. Hatari ya Koga ya Majani (Late Blight) ni ya juu.';
      case 'fr':
        return 'END Alerte: Fortes pluies à Nakuru demain. Risque élevé de mildiou.';
      default:
        return 'END Alert: Heavy rain forecast in Nakuru County. High risk of Late Blight spores. Apply preventive fungicide.';
    }
  };

  const getOfficerText = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'END Ombi lako limepokelewa. Afisa wa Kilimo atawasiliana nawe ndani ya saa 2.';
      case 'fr':
        return 'END Votre demande a été reçue. Un agronome vous contactera dans les 2 heures.';
      default:
        return 'END Ticket Created #AG-8821. Extension Officer assigned and will call you within 2 hours.';
    }
  };

  const getFeedbackPrompt = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'CON Tafadhali pima huduma yetu (1=Mbaya, 5=Bora sana):';
      case 'fr':
        return 'CON Évaluez notre service (1=Médiocre, 5=Excellent):';
      default:
        return 'CON Please rate your experience today (1=Poor, 5=Excellent):';
    }
  };

  const getDiagnosisResult = (lang: 'en' | 'sw' | 'fr') => {
    switch (lang) {
      case 'sw':
        return 'END Utambuzi wa AI: Koga ya Majani (Late Blight) - Ukali 85%.\nDawa: Ridomil Gold 50g/20L maji mara moja.';
      case 'fr':
        return 'END Diagnostic AI: Mildiou (Late Blight) - Gravité 85%.\nTraitement: Fongicide à base de cuivre immédiatement.';
      default:
        return 'END AI Diagnosis: Late Blight (Phytophthora infestans) - Confidence 88%.\nAction: Apply Mancozeb/Metalaxyl spray within 24 hours. Keep leaves dry.';
    }
  };

  const startSession = () => {
    setUssdStep('main');
    addLog('user', `Dialed ${dialCode}`);
    addLog('ussd', getMainMenuText(selectedLang));
  };

  const handleMainMenuOption = (input: string) => {
    switch (input) {
      case '1':
        setUssdStep('diagnose');
        addLog('ussd', getDiagnosePrompt(selectedLang));
        break;
      case '2':
        setUssdStep('weather');
        addLog('ussd', getWeatherText(selectedLang));
        setUssdStep('response');
        break;
      case '3':
        setUssdStep('officer');
        addLog('ussd', getOfficerText(selectedLang));
        onEscalate?.('Simulated Farmer (+254 712 345678)', 'Urgent USSD Field Visit Request');
        setUssdStep('response');
        break;
      case '4':
        setUssdStep('feedback');
        addLog('ussd', getFeedbackPrompt(selectedLang));
        break;
      default:
        addLog('ussd', 'CON Invalid choice. Please reply with 1, 2, 3, or 4.');
    }
  };

  const handleSendInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim()) return;

    const input = userInput.trim();
    addLog('user', input);
    setUserInput('');

    if (ussdStep === 'main') {
      handleMainMenuOption(input);
      return;
    }

    if (ussdStep === 'diagnose') {
      addLog('ussd', getDiagnosisResult(selectedLang));
      setUssdStep('response');
      return;
    }

    if (ussdStep === 'feedback') {
      addLog('ussd', selectedLang === 'sw' ? 'END Asante kwa maoni yako!' : 'END Thank you for your rating!');
      setUssdStep('response');
    }
  };

  const resetSession = () => {
    setUssdStep('idle');
    setUserInput('');
    setDialCode('*384*274#');
    setSessionLogs([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1200] flex justify-end pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-md bg-slate-950/95 border-l border-emerald-500/20 text-slate-100 shadow-2xl flex flex-col h-full z-10 overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white tracking-wide">USSD & SMS Sandbox</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Interactive mobile gateway simulator</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetSession}
                  title="Reset Session"
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Language Selector */}
            <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/50 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Simulation Locale:
              </span>
              <div className="flex gap-1">
                {(['en', 'sw', 'fr'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-all ${
                      selectedLang === lang
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Screen Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {/* Virtual Device Frame */}
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 shadow-inner relative flex flex-col min-h-[280px]">
                {/* Device Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 pb-2 border-b border-slate-800/60 mb-3">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    Safaricom / Airtel
                  </span>
                  <span>100% 🔋</span>
                </div>

                {/* Screen Content */}
                {ussdStep === 'idle' ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Ready to Dial</p>
                    <p className="text-xs text-slate-400 mb-4 max-w-[200px]">
                      Dial <code className="text-emerald-400 font-mono">*384*274#</code> to initiate farmer USSD session
                    </p>
                    <div className="font-mono text-xl font-bold text-emerald-400 tracking-wider bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 mb-4">
                      {dialCode || '---'}
                    </div>
                    <button
                      onClick={startSession}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all"
                    >
                      <PhoneCall className="w-4 h-4" />
                      Send USSD Request
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* USSD Dialog Modal on Phone */}
                    <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 shadow-xl flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                          <span className="text-[11px] font-bold text-emerald-400 tracking-wider">USSD DIALOG</span>
                          <span className="text-[10px] text-slate-500">Session ID: #8841</span>
                        </div>
                        <div className="text-xs font-mono text-slate-200 whitespace-pre-line leading-relaxed">
                          {sessionLogs[sessionLogs.length - 1]?.text}
                        </div>
                      </div>

                      {ussdStep !== 'response' ? (
                        <form onSubmit={handleSendInput} className="mt-4 pt-2 border-t border-slate-800">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={userInput}
                              onChange={e => setUserInput(e.target.value)}
                              placeholder="Reply..."
                              autoFocus
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Send
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="mt-4 pt-2 border-t border-slate-800 flex justify-end">
                          <button
                            onClick={resetSession}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
                          >
                            Dismiss / OK
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(btn => (
                  <button
                    key={btn}
                    onClick={() => handleDialPadPress(btn)}
                    className="py-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-600/30 hover:border-emerald-500/40 border border-slate-700/50 text-white font-mono font-bold text-sm transition-all active:scale-95 flex flex-col items-center justify-center shadow-sm"
                  >
                    <span>{btn}</span>
                  </button>
                ))}
              </div>

              {/* Quick Preset Queries */}
              <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Quick Test Scenarios
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <button
                    onClick={() => {
                      resetSession();
                      setSelectedLang('sw');
                      setTimeout(() => {
                        setDialCode('*384*274#');
                        setUssdStep('main');
                        addLog('user', '*384*274#');
                        addLog('ussd', 'CON Karibu GPExts Huduma:\n1. Tambua Ugonjwa wa Mmea\n2. Hali ya Hewa\n3. Omba Afisa');
                      }, 100);
                    }}
                    className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors flex justify-between items-center"
                  >
                    <span>🇹🇿 Swahili Diagnosis Flow</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Test &rarr;</span>
                  </button>
                  <button
                    onClick={() => {
                      resetSession();
                      setTimeout(() => {
                        setDialCode('*384*274#');
                        setUssdStep('diagnose');
                        addLog('user', '1');
                        addLog('ussd', 'CON Describe your crop symptoms:');
                        setUserInput('Maize leaves have gray spots');
                      }, 100);
                    }}
                    className="text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors flex justify-between items-center"
                  >
                    <span>🌽 Gray Leaf Spot (Maize)</span>
                    <span className="text-emerald-400 font-mono text-[10px]">Test &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Session Debug Log Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between items-center">
              <span>Gateway: Africa's Talking / Twilio Sandbox</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Ready
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
