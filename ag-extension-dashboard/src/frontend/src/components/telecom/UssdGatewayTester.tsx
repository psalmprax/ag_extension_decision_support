import React, { useRef, useState } from 'react';
import { PhoneCall, Send, Radio, CheckCircle2, Smartphone, RotateCcw } from 'lucide-react';

export const UssdGatewayTester: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'ussd' | 'sms'>('ussd');
  const nextPreviewId = useRef(0);

  // USSD State
  const ussdDialCode = '*123#';
  const [ussdSessionActive, setUssdSessionActive] = useState(false);
  const [ussdScreen, setUssdScreen] = useState<string>(
    'CON Welcome to GPExts Farmer Advisory:\n1. Maize Armyworm Alert\n2. Soil NPK Test Request\n3. Book Extension Visit\n4. Swahili Language'
  );
  const [ussdInput, setUssdInput] = useState('');
  const [ussdHistory, setUssdHistory] = useState<string[]>([]);

  // SMS State
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState(
    'Example: Contact a local extension officer to discuss your crop symptoms.'
  );
  const [smsLogs, setSmsLogs] = useState<
    {
      id: string;
      phone: string;
      message: string;
      status: 'Preview only';
    }[]
  >([]);

  const handleDialUssd = () => {
    setUssdSessionActive(true);
    setUssdHistory([`Dialed ${ussdDialCode}`]);
    setUssdScreen(
      'CON Welcome to GPExts Farmer Advisory:\n1. Maize Armyworm Alert\n2. Soil NPK Test Request\n3. Book Extension Visit\n4. Swahili Language'
    );
  };

  const handleSendUssdInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ussdInput.trim()) return;

    const input = ussdInput.trim();
    setUssdHistory(prev => [...prev, `> User entered: ${input}`]);
    setUssdInput('');

    if (input === '1') {
      setUssdScreen(
        'END Example only: record crop symptoms and consult a local extension officer. No SMS was sent.'
      );
    } else if (input === '2') {
      setUssdScreen(
        'END Example only: contact a local soil specialist. No visit was scheduled.'
      );
    } else if (input === '3') {
      setUssdScreen(
        'END Example only: contact an extension officer to request a visit. No visit was scheduled.'
      );
    } else if (input === '4') {
      setUssdScreen(
        'END Mfano pekee: wasiliana na afisa ugani. Hakuna ujumbe uliotumwa.'
      );
    } else {
      setUssdScreen('END Thank you for using GPExts Agricultural Advisory. Session closed.');
    }
  };

  const handleResetUssd = () => {
    setUssdSessionActive(false);
    setUssdHistory([]);
    setUssdScreen(
      'CON Welcome to GPExts Farmer Advisory:\n1. Maize Armyworm Alert\n2. Soil NPK Test Request\n3. Book Extension Visit\n4. Swahili Language'
    );
  };

  const handleSendSms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsMessage.trim()) return;

    const id = String(nextPreviewId.current++);
    setSmsLogs(prev => [
      { id, phone: smsPhone, message: smsMessage, status: 'Preview only' },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            Telecom Gateway & USSD/SMS Simulator
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Local simulation only. No gateway is contacted, messages sent, or visits scheduled.
            Do not enter real phone numbers or personal information.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveChannel('ussd')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'ussd'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>USSD Session</span>
          </button>
          <button
            onClick={() => setActiveChannel('sms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'sms'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>SMS Broadcaster</span>
          </button>
        </div>
      </div>

      {/* USSD Simulator */}
      {activeChannel === 'ussd' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Virtual Phone Mockup */}
          <div className="flex flex-col items-center">
            <div className="w-[280px] bg-slate-900 border-4 border-slate-700 rounded-xl p-4 shadow-2xl relative">
              {/* Earpiece */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3" />

              {/* Feature Phone Screen */}
              <div className="bg-[#8fa781] text-black font-mono text-xs p-3 rounded-lg min-h-[220px] shadow-inner flex flex-col justify-between border border-[#788e6d]">
                {ussdSessionActive ? (
                  <>
                    <div className="whitespace-pre-line leading-relaxed font-bold">
                      {ussdScreen}
                    </div>
                    {ussdScreen.startsWith('CON') && (
                      <form
                        onSubmit={handleSendUssdInput}
                        className="mt-3 pt-2 border-t border-[#788e6d]"
                      >
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={ussdInput}
                            onChange={e => setUssdInput(e.target.value)}
                            placeholder="Reply..."
                            autoFocus
                            className="w-full bg-[#9bb58c] text-black font-mono text-xs px-2 py-1 rounded border border-[#788e6d] outline-none"
                          />
                          <button
                            type="submit"
                            className="bg-black text-[#8fa781] px-2 py-1 rounded text-xxs font-bold cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[180px] text-center">
                    <Radio className="w-8 h-8 opacity-40 mb-2" />
                    <span className="font-bold text-sm">Simulated phone</span>
                    <span className="text-xs opacity-75 mt-1">Example code {ussdDialCode} (not a live service)</span>
                  </div>
                )}
              </div>

              {/* Keypad */}
              <div className="mt-4 space-y-2">
                {!ussdSessionActive ? (
                  <button
                    onClick={handleDialUssd}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Simulate dialing {ussdDialCode}
                  </button>
                ) : (
                  <button
                    onClick={handleResetUssd}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-stone-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    End Session
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Session Logs & Explanation */}
          <div className="p-6 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xxs font-mono uppercase text-emerald-400 font-bold">
                  Simulated USSD Session Trace
                </span>
                <span className="text-xxs text-stone-400">
                  No provider connected
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-stone-300 min-h-[160px] space-y-1.5 border border-white/5">
                {ussdHistory.length === 0 ? (
                  <span className="text-stone-500 italic">
                    No active session. Click Dial on the virtual phone.
                  </span>
                ) : (
                  ussdHistory.map((h, i) => (
                    <div key={i} className="text-emerald-400">
                      {h}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-stone-300">
              <span className="font-bold text-emerald-400">Smallholder Inclusivity:</span> USSD
              can work on basic phones when a supported carrier and service are configured.
            </div>
          </div>
        </div>
      )}

      {/* SMS Gateway Tester */}
      {activeChannel === 'sms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleSendSms}
            className="p-6 rounded-xl bg-black/40 border border-white/10 space-y-4"
          >
            <div>
              <label htmlFor="demo-phone" className="text-xs font-bold text-stone-300 block mb-1.5">
                Example recipient (do not enter a real number)
              </label>
              <input
                id="demo-phone"
                type="text"
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="demo-message" className="text-xs font-bold text-stone-300">Example message</label>
                <span className="text-xxs font-mono text-stone-400">
                  {smsMessage.length} characters
                </span>
              </div>
              <textarea
                id="demo-message"
                rows={4}
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:border-emerald-500 outline-none leading-relaxed"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer border border-white/10 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Add local preview
            </button>
          </form>

          {/* SMS Logs */}
          <div className="p-6 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <h4 className="text-xs font-medium text-stone-400">
              Local previews (not sent)
            </h4>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
              {smsLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1"
                >
                  <div className="flex items-center justify-between text-xxs font-mono tabular-nums text-stone-400">
                    <span className="text-emerald-400 font-medium">{log.phone}</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> {log.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-200 leading-snug">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UssdGatewayTester;
