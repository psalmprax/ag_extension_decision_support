import React, { useRef, useState } from 'react';
import { PhoneCall, Send, Radio, CheckCircle2, Smartphone, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

// A preview of the USSD menu: nothing is sent and nothing is booked.
const USSD_WELCOME = 'CON Welcome to GPExts Farmer Advisory:\n1. Maize Armyworm Alert\n2. Soil NPK Test Request\n3. Book Extension Visit\n4. Swahili Language';
const USSD_REPLIES: Record<string, string> = {
  '1': 'END Example only: record crop symptoms and consult a local extension officer. No SMS was sent.',
  '2': 'END Example only: contact a local soil specialist. No visit was scheduled.',
  '3': 'END Example only: contact an extension officer to request a visit. No visit was scheduled.',
  '4': 'END Mfano pekee: wasiliana na afisa ugani. Hakuna ujumbe uliotumwa.',
};
const USSD_GOODBYE = 'END Thank you for using GPExts Agricultural Advisory. Session closed.';

export const UssdGatewayTester: React.FC = () => {
  const { t } = useLanguage();
  const [activeChannel, setActiveChannel] = useState<'ussd' | 'sms'>('ussd');
  const nextPreviewId = useRef(0);

  // USSD State
  const ussdDialCode = '*123#';
  const [ussdSessionActive, setUssdSessionActive] = useState(false);
  const [ussdScreen, setUssdScreen] = useState<string>(USSD_WELCOME);
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
    setUssdScreen(USSD_WELCOME);
  };

  const handleSendUssdInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ussdInput.trim()) return;

    const input = ussdInput.trim();
    setUssdHistory(prev => [...prev, `> User entered: ${input}`]);
    setUssdInput('');

    setUssdScreen(USSD_REPLIES[input] ?? USSD_GOODBYE);
  };

  const handleResetUssd = () => {
    setUssdSessionActive(false);
    setUssdHistory([]);
    setUssdScreen(USSD_WELCOME);
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
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            {t('ui_ussd_gateway_tester_telecom_gateway_ussd_sms_simulator')}
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            {t('ui_ussd_gateway_tester_local_simulation_only_no_gateway_is')}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveChannel('ussd')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'ussd'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('ui_ussd_gateway_tester_ussd_session')}</span>
          </button>
          <button
            onClick={() => setActiveChannel('sms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              activeChannel === 'sms'
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('ui_ussd_gateway_tester_sms_broadcaster')}</span>
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
                    <div className="whitespace-pre-line leading-relaxed font-medium">
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
                            className="bg-black text-[#8fa781] px-2 py-1 rounded text-xxs font-medium cursor-pointer"
                          >
                            {t('common_send')}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[180px] text-center">
                    <Radio className="w-8 h-8 opacity-40 mb-2" />
                    <span className="font-medium text-sm">{t('ui_ussd_gateway_tester_simulated_phone')}</span>
                    <span className="text-xs opacity-75 mt-1">{t('ui_ussd_gateway_tester_example_code_not_a_live_service', { ussdDialCode })}</span>
                  </div>
                )}
              </div>

              {/* Keypad */}
              <div className="mt-4 space-y-2">
                {!ussdSessionActive ? (
                  <button
                    onClick={handleDialUssd}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    {t('ui_ussd_gateway_tester_simulate_dialing')} {ussdDialCode}
                  </button>
                ) : (
                  <button
                    onClick={handleResetUssd}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-stone-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t('ui_ussd_gateway_tester_end_session')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Session Logs & Explanation */}
          <div className="p-6 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xxs font-mono text-emerald-400 font-medium">
                  {t('ui_ussd_gateway_tester_simulated_ussd_session_trace')}
                </span>
                <span className="text-xxs text-stone-400">
                  {t('ui_ussd_gateway_tester_no_provider_connected')}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-stone-300 min-h-[160px] space-y-1.5 border border-white/5">
                {ussdHistory.length === 0 ? (
                  <span className="text-stone-500 italic">
                    {t('ui_ussd_gateway_tester_no_active_session_click_dial_on_the')}
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
              <span className="font-medium text-emerald-400">{t('ui_ussd_gateway_tester_smallholder_inclusivity')}</span> {t('ui_ussd_gateway_tester_ussd_can_work_on_basic_phones_when_a')}
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
              <label htmlFor="demo-phone" className="text-xs font-medium text-stone-300 block mb-1.5">
                {t('ui_ussd_gateway_tester_example_recipient_do_not_enter_a_rea')}
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
                <label htmlFor="demo-message" className="text-xs font-medium text-stone-300">{t('ui_ussd_gateway_tester_example_message')}</label>
                <span className="text-xxs font-mono text-stone-400">
                  {t('ui_ussd_gateway_tester_characters', { length: smsMessage.length })}
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
              {t('ui_ussd_gateway_tester_add_local_preview')}
            </button>
          </form>

          {/* SMS Logs */}
          <div className="p-6 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <h4 className="text-xs font-medium text-stone-400">
              {t('ui_ussd_gateway_tester_local_previews_not_sent')}
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
