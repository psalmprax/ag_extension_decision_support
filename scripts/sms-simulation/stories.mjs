// SMS, USSD and phone sign-in user stories for farmers, officers and regional managers.
// Runs against a LOCAL backend started with fake-gateway.cjs (see run.sh): nothing is sent
// to a real phone, and AI answers come from a stub marked "[SIMULATED AI ANSWER ...]".
// Uses the real-world fixture accounts (prisma/seed-realworld.ts). Prints PASS/FAIL per story.
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';

const API = process.env.SIM_API || 'http://127.0.0.1:3001';
const OUTBOX = process.env.SMS_SIM_OUTBOX || '/tmp/sms-sim/outbox.jsonl';
const AT_KEY = process.env.AFRICASTALKING_WEBHOOK_SECRET || 'sim-at-secret';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'sim-twilio-token';
const PW = process.env.SIM_PASSWORD || 'Harvest2026!';
const HOST = 'sim.local';
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const outbox = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []);
const smsTo = (phone, since) => outbox().filter(m => m.to === phone && m.at >= since);
const now = () => new Date().toISOString();
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
async function waitFor(fn, ms = 10000) { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await sleep(250); } return v; }
const nextSms = async (phone, since, ms) => (await waitFor(() => { const m = smsTo(phone, since); return m.length ? m : null; }, ms)) ?? [];

function twilioSign(path, params) {
  const data = Object.keys(params).sort().reduce((a, k) => a + k + params[k], '');
  return crypto.createHmac('sha1', TWILIO_TOKEN).update(Buffer.from(`https://${HOST}${path}` + data, 'utf8')).digest('base64');
}
async function post(path, params, { auth = 'twilio' } = {}) {
  const headers = { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST };
  let url = API + path;
  if (auth === 'twilio') headers['x-twilio-signature'] = twilioSign(path, params);
  if (auth === 'at') url += `?key=${encodeURIComponent(AT_KEY)}`;
  if (auth === 'at-wrong') url += '?key=wrong';
  const res = await fetch(url, { method: 'POST', headers, body: new URLSearchParams(params) });
  return { status: res.status, body: await res.text() };
}
let seq = 0;
const sms = (from, text) => post('/api/sms/inbound', { from, text, id: `ATsim${Date.now()}${seq++}`, to: '20880' }, { auth: 'at' });
const ussd = (phone, text) => post('/api/sms/ussd', { sessionId: `sim${Date.now()}${seq++}`, phoneNumber: phone, text, serviceCode: '*384#' }, { auth: 'at' });

const tokens = {};
async function login(email) {
  if (tokens[email]) return tokens[email];
  const res = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return (tokens[email] = (await res.json()).data.token);
}
async function api(who, method, path, body) {
  const token = who.startsWith('Bearer ') ? who.slice(7) : await login(who);
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, json };
}
async function story(id, title, fn) {
  try { results.push({ id, title, ok: true, note: (await fn()) ?? '' }); }
  catch (e) { results.push({ id, title, ok: false, note: e.message }); }
}

const FARMER = '+254711000301', FARMER2 = '+254711000302';
const OFFICER = 'officer.nakuru@real.agriext.test', OFFICER_PHONE = '+254711000201';
const RM = 'rm.nakuru@real.agriext.test', RM_PHONE = '+254711000101';
const OTHER_OFFICER = 'officer.mzuzu@real.agriext.test';
const STRANGER = '+254711999' + String(Date.now()).slice(-3);
const UNKNOWN = '+254711997' + String(Date.now()).slice(-3);
const ctx = {};

// Start from a known state for the parts these stories change (local fixtures only).
await db.query(`UPDATE users SET sms_pin_hash = NULL, sms_pin_locked = false, sms_pin_failed_attempts = 0, sms_unlocked_until = NULL WHERE phone IN ($1, $2)`, [OFFICER_PHONE, RM_PHONE]);
await db.query(`UPDATE farmers SET language_preference = 'sw' WHERE phone = $1`, [FARMER]);
await db.query(`DELETE FROM phone_login_codes WHERE created_at > NOW() - INTERVAL '1 day'`);
await db.query(`DELETE FROM sms_continuations`);
// Today's AI-by-SMS allowance for the test farmer (so repeated runs still get an answer).
await db.query(`DELETE FROM chat_messages m USING chat_conversations cv, farmers f
                 WHERE m.conversation_id = cv.id AND cv.farmer_id = f.id AND f.phone = $1
                   AND m.role = 'assistant' AND m.channel = 'sms'`, [FARMER]);

// ── Gateways ──
await story('G1', "Africa's Talking SMS callback with the shared key is accepted", async () => {
  const r = await sms(FARMER2, 'Habari');
  expect(r.status === 200, `${r.status} ${r.body.slice(0, 80)}`);
});
await story('G2', 'Callbacks with a wrong key or no signature are refused', async () => {
  const a = await post('/api/sms/inbound', { from: FARMER, text: 'spoof', id: 'x' + Date.now() }, { auth: 'at-wrong' });
  const b = await post('/api/sms/inbound', { from: FARMER, text: 'spoof', id: 'y' + Date.now() }, { auth: 'none' });
  expect(a.status === 403 && b.status === 403, `${a.status}/${b.status}`);
});
await story('G3', 'Twilio-signed callbacks still work', async () => {
  const r = await post('/api/sms/inbound', { From: FARMER2, Body: 'Asante', MessageSid: 'SM' + Date.now() });
  expect(r.status === 200, String(r.status));
});
await story('G4', 'Delivery receipts reach the server', async () => {
  const r = await post('/api/sms/delivery', { id: 'ATX1', status: 'Success', phoneNumber: FARMER }, { auth: 'at' });
  expect(r.status === 200, `${r.status} ${r.body.slice(0, 60)}`);
});
await story('G5', 'Gateway retries do not run a message twice', async () => {
  const t0 = now(); const params = { from: OFFICER_PHONE, text: 'HELP', id: 'dup' + Date.now() };
  await post('/api/sms/inbound', params, { auth: 'at' }); await post('/api/sms/inbound', params, { auth: 'at' });
  await sleep(1500);
  expect(smsTo(OFFICER_PHONE, t0).length === 1, `${smsTo(OFFICER_PHONE, t0).length} replies`);
});

// ── Farmer by SMS ──
await story('F1', 'Farmer texts her officer; the officer sees it', async () => {
  await sms(FARMER, 'Majani ya mahindi yanageuka manjano baada ya mvua');
  const thread = await waitFor(async () => {
    const r = await api(OFFICER, 'GET', '/api/chatbot/conversations');
    const list = r.json?.data?.conversations ?? r.json?.data ?? [];
    return (Array.isArray(list) ? list : []).find(c => JSON.stringify(c).includes('manjano'));
  });
  expect(thread, 'thread not in the officer list');
  ctx.thread = thread.id ?? thread.conversation_id;
});
await story('F2', 'Officer replies on the web; the farmer gets an SMS', async () => {
  const t0 = now();
  const r = await api(OFFICER, 'POST', '/api/chatbot/messages', { conversationId: ctx.thread, content: 'Habari Mary, nitakutembelea Jumanne.' });
  expect(r.status < 300, `post ${r.status}`);
  const got = await nextSms(FARMER, t0);
  expect(got.some(m => m.message.includes('Jumanne')), 'no SMS to the farmer');
});
await story('F3', 'ASK AI by SMS: two parts at most, then MORE sends the rest', async () => {
  const t0 = now();
  await sms(FARMER, 'ASK AI maize leaves turning yellow after rain');
  const answer = (await nextSms(FARMER, t0, 20000))[0];
  expect(answer, 'no AI answer');
  expect(answer.message.length <= 306, `${answer.message.length} characters`);
  expect(/MORE/.test(answer.message), 'no MORE prompt on a long answer');
  const t1 = now();
  await sms(FARMER, 'MORE');
  const rest = (await nextSms(FARMER, t1))[0];
  expect(rest && !rest.message.startsWith('[SIMULATED'), 'MORE did not send the rest');
  return `first ${answer.message.length} chars; prompt in Swahili: ${/Tuma MORE/.test(answer.message)}`;
});
await story('F4', 'Every SMS is plain GSM-7 (no emoji, no markdown stars)', async () => {
  const bad = outbox().filter(m => /\p{Extended_Pictographic}|\*\S/u.test(m.message) || /[‘-”–—]/.test(m.message));
  expect(bad.length === 0, `${bad.length} messages, e.g. "${bad[0]?.message.slice(0, 60)}"`);
});
await story('F5', 'LANG EN switches a farmer to English', async () => {
  const t0 = now();
  await sms(FARMER2, 'LANG EN');
  const got = (await nextSms(FARMER2, t0))[0];
  expect(got?.message.includes('English'), got?.message ?? 'no reply');
});

// ── Farmer by USSD ──
await story('U1', 'USSD menu for a registered farmer (in Kiswahili)', async () => {
  const r = await ussd(FARMER, '');
  expect(r.status === 200 && r.body.startsWith('CON') && r.body.includes('Uliza swali'), r.body.slice(0, 120));
});
await story('U2', 'USSD: ask a question, the answer arrives by SMS', async () => {
  const t0 = now();
  const r = await ussd(FARMER, '1*How do I store maize after harvest');
  expect(r.body.startsWith('END'), r.body);
  expect((await nextSms(FARMER, t0, 20000)).length, 'no SMS answer');
});
await story('U3', 'USSD: guided crop problem (crop, part, symptom)', async () => {
  const screens = [await ussd(FARMER, '2'), await ussd(FARMER, '2*1'), await ussd(FARMER, '2*1*1')];
  expect(screens.every(s => s.body.startsWith('CON')), screens.map(s => s.body.slice(0, 20)).join(' | '));
  const t0 = now();
  const done = await ussd(FARMER, '2*1*1*2');
  expect(done.body.startsWith('END') && /afisa/i.test(done.body), done.body);
  expect((await nextSms(FARMER, t0, 20000)).length, 'no SMS answer');
  const r = await api(OFFICER, 'GET', `/api/chatbot/conversations/${ctx.thread}/messages`);
  const msgs = r.json?.data?.messages ?? r.json?.data ?? [];
  expect(JSON.stringify(msgs).includes('Mahindi, majani: madoa'), 'the report is not in the officer thread');
});
await story('U4', 'USSD: weather and market prices', async () => {
  const w = await ussd(FARMER, '3'); const m = await ussd(FARMER, '4');
  expect(w.body.startsWith('END') && m.body.startsWith('END'), `${w.body.slice(0, 60)} | ${m.body.slice(0, 60)}`);
  return `${w.body.slice(4, 70)} | ${m.body.slice(4, 60).replace(/\n/g, ' ')}`;
});
await story('U5', 'USSD: message my officer', async () => {
  const r = await ussd(FARMER, '5*Naomba ushauri kuhusu mbolea');
  expect(r.body.startsWith('END'), r.body);
  await sleep(1200);
  const res = await api(OFFICER, 'GET', `/api/chatbot/conversations/${ctx.thread}/messages`);
  expect(JSON.stringify(res.json).includes('mbolea'), 'message not in the thread');
});

// ── New farmer by SMS ──
await story('N1', 'Unknown number joins by SMS and is placed with the local officer', async () => {
  const t0 = now();
  for (const text of ['Hello', 'Grace Atieno', 'Maize', 'Nakuru', '5 acres']) { await sms(STRANGER, text); await sleep(500); }
  const replies = smsTo(STRANGER, t0).map(m => m.message);
  expect(replies.length === 5, `${replies.length} replies: ${replies.map(r => r.slice(0, 25)).join(' / ')}`);
  const { rows } = await db.query(`SELECT f.farm_size_hectares, f.region, f.district, u.email FROM farmers f LEFT JOIN users u ON u.id = f.assigned_officer_id WHERE f.phone = $1`, [STRANGER]);
  expect(rows[0], 'no farmer record');
  expect(rows[0].email === OFFICER, `assigned to ${rows[0].email}`);
  return `${rows[0].farm_size_hectares} ha, region ${rows[0].region}, district ${rows[0].district}`;
});
await story('N2', 'An unregistered number gets the USSD visitor menu', async () => {
  const r = await ussd(UNKNOWN, '');
  expect(r.body.includes('Register by SMS'), r.body);
});

// ── Officer by SMS ──
await story('O1', 'Officer texts INBOX before setting a PIN', async () => {
  const t0 = now(); await sms(OFFICER_PHONE, 'INBOX');
  const got = (await nextSms(OFFICER_PHONE, t0))[0];
  expect(/PIN/.test(got?.message ?? ''), got?.message ?? 'no reply');
});
await story('O2', 'Officer sets the SMS PIN by USSD', async () => {
  const menu = await ussd(OFFICER_PHONE, '');
  expect(menu.body.includes('SMS PIN'), menu.body);
  const r = await ussd(OFFICER_PHONE, '1*4821*4821');
  expect(r.body.startsWith('END SMS PIN set'), r.body);
});
await story('O3', 'Officer unlocks and reads INBOX', async () => {
  let t0 = now(); await sms(OFFICER_PHONE, 'PIN 4821');
  expect(/Unlocked/.test((await nextSms(OFFICER_PHONE, t0))[0]?.message ?? ''), 'not unlocked');
  await sms(FARMER, 'Asante afisa, nitakuwa shambani');
  await sleep(800);
  t0 = now(); await sms(OFFICER_PHONE, 'INBOX');
  const inbox = (await nextSms(OFFICER_PHONE, t0))[0]?.message ?? '';
  const ref = /^(\d+) Mary/m.exec(inbox)?.[1];
  expect(ref, `Mary not listed: ${inbox}`);
  ctx.ref = ref;
  return inbox.replace(/\n/g, ' | ').slice(0, 140);
});
await story('O4', 'Officer replies by SMS; the farmer gets it and the web thread shows it', async () => {
  const t0 = now(); await sms(OFFICER_PHONE, `R ${ctx.ref} Nitafika kesho saa tatu asubuhi.`);
  expect((await nextSms(FARMER, t0)).some(m => m.message.includes('saa tatu')), 'farmer did not get it');
  const r = await api(OFFICER, 'GET', `/api/chatbot/conversations/${ctx.thread}/messages`);
  expect(JSON.stringify(r.json).includes('saa tatu'), 'not in the web thread');
});
await story('O5', 'Officer records a visit by SMS', async () => {
  const t0 = now(); await sms(OFFICER_PHONE, `VISIT ${ctx.ref} done Fall armyworm on 20% of plants, advised scouting twice a week`);
  const reply = (await nextSms(OFFICER_PHONE, t0))[0]?.message ?? '';
  expect(/recorded/.test(reply), reply);
  const { rows } = await db.query(`SELECT v.status, v.notes, v.location_check FROM visits v JOIN farmers f ON f.id = v.farmer_id WHERE f.phone = $1 ORDER BY v.created_at DESC LIMIT 1`, [FARMER]);
  expect(rows[0]?.status === 'completed' && rows[0].notes.includes('armyworm') && rows[0].location_check === 'not_shared', JSON.stringify(rows[0]));
  const web = await api(OFFICER, 'GET', '/api/visits?limit=50');
  expect(JSON.stringify(web.json).includes('armyworm'), 'not on the web Visits list');
});
await story('O6', 'Officer finds a farmer and plans a visit by SMS', async () => {
  let t0 = now(); await sms(OFFICER_PHONE, 'FIND Kimani');
  const found = (await nextSms(OFFICER_PHONE, t0))[0]?.message ?? '';
  const ref = /^(\d+) Joseph Kimani/m.exec(found)?.[1];
  expect(ref, found);
  t0 = now(); await sms(OFFICER_PHONE, `PLAN ${ref} 25/12 soil sampling`);
  const reply = (await nextSms(OFFICER_PHONE, t0))[0]?.message ?? '';
  expect(/planned for \d{4}-12-25/.test(reply), reply);
});
await story('O7', 'Officer asks the AI by SMS', async () => {
  const t0 = now(); await sms(OFFICER_PHONE, 'ASK AI signs of maize lethal necrosis');
  expect((await nextSms(OFFICER_PHONE, t0, 20000))[0]?.message.includes('SIMULATED'), 'no AI answer');
});
await story('O8', 'Officer cannot act on another officer\'s farmer number', async () => {
  const t0 = now(); await sms(OFFICER_PHONE, 'R 9999 hello');
  expect(/No farmer 9999/.test((await nextSms(OFFICER_PHONE, t0))[0]?.message ?? ''), 'unexpected reply');
});

// ── Regional manager ──
await story('R1', 'Manager sets the SMS PIN on the web and uses INBOX for the region', async () => {
  const r = await api(RM, 'PUT', '/api/account/sms-pin', { pin: '7350', currentPassword: PW });
  expect(r.status === 200, `PUT ${r.status} ${JSON.stringify(r.json)}`);
  let t0 = now(); await sms(RM_PHONE, 'PIN 7350'); await nextSms(RM_PHONE, t0);
  t0 = now(); await sms(RM_PHONE, 'INBOX');
  const inbox = (await nextSms(RM_PHONE, t0))[0]?.message ?? '';
  expect(/\d+ \w+/.test(inbox), inbox);
  return inbox.replace(/\n/g, ' | ').slice(0, 120);
});
await story('R2', 'Five wrong PINs lock SMS commands', async () => {
  await db.query(`UPDATE users SET sms_unlocked_until = NULL WHERE phone = $1`, [RM_PHONE]);
  for (let i = 0; i < 5; i++) { await sms(RM_PHONE, 'PIN 0000'); await sleep(300); }
  await sleep(800);
  await sleep(2500);
  const t0 = now(); await sms(RM_PHONE, 'PIN 7350');
  const locked = await waitFor(() => smsTo(RM_PHONE, t0).find(m => /locked/i.test(m.message)));
  expect(locked, 'not locked');
});
await story('R3', 'Manager sees the region\'s SMS history and the officer\'s SMS visit', async () => {
  const h = await api(RM, 'GET', '/api/sms/history?limit=100');
  expect(h.status === 200 && (h.json?.data?.length ?? h.json?.data?.messages?.length ?? 0) > 0, `history ${h.status}`);
  const v = await api(RM, 'GET', '/api/visits?limit=100');
  expect(JSON.stringify(v.json).includes('armyworm'), 'visit not visible to the manager');
});
await story('X1', 'An officer from another region cannot read the thread', async () => {
  const r = await api(OTHER_OFFICER, 'GET', `/api/chatbot/conversations/${ctx.thread}/messages`);
  expect(r.status === 403 || r.status === 404, String(r.status));
});

// ── Phone sign-in ──
async function codeFor(phone, since) { const m = (await nextSms(phone, since))[0]?.message ?? ''; return /(\d{6})/.exec(m)?.[1]; }
await story('P1', 'Farmer with an account signs in with an SMS code', async () => {
  const t0 = now();
  const r = await fetch(API + '/api/auth/phone/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '0711000302' }) });
  expect(r.status === 200, String(r.status));
  const code = await codeFor(FARMER2, t0);
  expect(code, 'no code SMS');
  const v = await fetch(API + '/api/auth/phone/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: FARMER2, code }) });
  const j = await v.json();
  expect(v.status === 200 && j.data?.user?.role === 'farmer', `${v.status} ${JSON.stringify(j).slice(0, 100)}`);
  ctx.farmerToken = j.data.token;
});
await story('P2', 'After phone sign-in, Ask AI works on the web', async () => {
  const r = await api(`Bearer ${ctx.farmerToken}`, 'GET', '/api/chatbot/conversations');
  expect(r.status === 200, String(r.status));
});
await story('P3', 'A farmer who joined by SMS gets an account on first code sign-in', async () => {
  const t0 = now();
  await fetch(API + '/api/auth/phone/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: STRANGER }) });
  const code = await codeFor(STRANGER, t0);
  expect(code, 'no code SMS');
  const v = await fetch(API + '/api/auth/phone/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: STRANGER, code }) });
  const j = await v.json();
  expect(v.status === 200 && j.data?.user?.role === 'farmer', `${v.status} ${JSON.stringify(j).slice(0, 120)}`);
});
await story('P4', 'Wrong codes: five tries, then a new code is needed', async () => {
  const t0 = now();
  await fetch(API + '/api/auth/phone/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: FARMER }) });
  const code = await codeFor(FARMER, t0);
  const wrong = String((Number(code) + 1) % 1000000).padStart(6, '0');
  let last;
  for (let i = 0; i < 5; i++) last = await fetch(API + '/api/auth/phone/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: FARMER, code: wrong }) });
  const right = await fetch(API + '/api/auth/phone/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: FARMER, code }) });
  expect(last.status === 401 && right.status === 401, `${last.status}/${right.status}`);
});
await story('P5', 'Unknown numbers get the same answer and no SMS', async () => {
  const t0 = now();
  const r = await fetch(API + '/api/auth/phone/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: UNKNOWN }) });
  const j = await r.json(); await sleep(800);
  expect(r.status === 200 && /If this number is registered/.test(j.data?.message) && smsTo(UNKNOWN, t0).length === 0, `${r.status}`);
});
await story('P6', 'Code requests are limited per number', async () => {
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await fetch(API + '/api/auth/phone/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: FARMER }) })).status);
  expect(statuses.includes(429), statuses.join(','));
});

await db.end();
const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(3)} ${r.title}${r.note ? `  — ${String(r.note).replace(/\n/g, ' ').slice(0, 160)}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} stories passed`);
process.exit(failed.length ? 1 : 0);
