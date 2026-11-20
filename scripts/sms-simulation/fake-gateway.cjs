// Local SMS simulation only (scripts/sms-simulation/run.sh): a fake SMS gateway and a stub AI
// provider, preloaded into the backend with node -r. Outbound SMS go to SMS_SIM_OUTBOX, never a phone.
const fs = require('fs');
const OUTBOX = process.env.SMS_SIM_OUTBOX || '/tmp/sms-sim/outbox.jsonl';
const AI_MODE = process.env.SMS_SIM_AI || 'off'; // 'stub' | 'off'
const Module = require('module');
const origLoad = Module._load;
let patched = false;
Module._load = function (request, parent, isMain) {
  const mod = origLoad.apply(this, arguments);
  if (request === 'axios' && !patched) {
    patched = true;
    const ax = mod.default || mod;
    const post = ax.post.bind(ax);
    ax.post = async (url, body, cfg) => {
      if (String(url).includes('africastalking.com')) {
        const p = new URLSearchParams(String(body));
        fs.appendFileSync(OUTBOX, JSON.stringify({ at: new Date().toISOString(), via: 'africas_talking', to: p.get('to'), message: p.get('message') }) + '\n');
        return { data: { SMSMessageData: { Recipients: [{ status: 'Success', messageId: 'sim-' + Date.now() }] } } };
      }
      if (String(url).includes('aihubmix.com')) {
        if (AI_MODE !== 'stub') throw new Error('simulated: AI provider unreachable');
        return { data: { choices: [{ message: { content: '[SIMULATED AI ANSWER - stub provider, not agronomic advice] ' + 'Scout the field and check the lower leaves first. '.repeat(8) } }] } };
      }
      return post(url, body, cfg);
    };
  }
  return mod;
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url && url.includes('aihubmix.com')) {
    if (AI_MODE !== 'stub') throw new TypeError('simulated: AI provider unreachable');
    let question = '';
    try { const b = JSON.parse(init.body); question = (b.messages || []).filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : '').pop() || ''; } catch {}
    const content = '[SIMULATED AI ANSWER - stub provider, not agronomic advice] Reply to: ' + question.slice(0, 60);
    
    return new Response(JSON.stringify({ id: 'sim', object: 'chat.completion', created: Date.now() / 1000 | 0, model: 'sim', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};
