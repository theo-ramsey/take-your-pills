// Where data lives. Demo mode keeps everything in this browser; otherwise Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { EXAMPLE_MEDICATIONS, EXAMPLE_SETTINGS } from './examples.js';

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const DEMO_KEY = 'typ-demo-v1';
const CODE_KEY = 'typ-device-code';
const CACHE_KEY = 'typ-cache';
const OUTBOX_KEY = 'typ-outbox';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

export const uuid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const MED_DEFAULTS = {
  strength: '', amount: '', times: [], as_needed: false, max_per_day: null,
  purpose: '', instructions: '', appearance: '', active: true,
};

// ---------------------------------------------------------------- demo mode
function demoData() {
  let data = readJSON(DEMO_KEY, null);
  if (!data) {
    data = {
      settings: { ...EXAMPLE_SETTINGS, device_code: 'DEMO' },
      medications: EXAMPLE_MEDICATIONS.map((m, i) => ({ ...MED_DEFAULTS, ...m, id: uuid(), sort: i })),
      log: [],
    };
    writeJSON(DEMO_KEY, data);
  }
  return data;
}
const saveDemo = (data) => writeJSON(DEMO_KEY, data);

export function resetDemo() {
  localStorage.removeItem(DEMO_KEY);
}

// ---------------------------------------------------------------- supabase
let clientPromise;
function client() {
  if (!clientPromise) {
    clientPromise = import(SUPABASE_JS).then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } })
    );
  }
  return clientPromise;
}
function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ================================================================ Gloria's phone
export const deviceCode = {
  get: () => (isDemo ? 'DEMO' : localStorage.getItem(CODE_KEY)),
  set: (code) => localStorage.setItem(CODE_KEY, code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()),
  clear: () => localStorage.removeItem(CODE_KEY),
};

/** Everything Gloria's screen needs. Falls back to the last copy if offline. */
export async function loadForGloria() {
  if (isDemo) {
    const d = demoData();
    return { settings: d.settings, medications: d.medications, log: d.log, offline: false };
  }
  await flushOutbox();
  try {
    const sb = await client();
    const data = check(await sb.rpc('gloria_data', { p_code: deviceCode.get() }));
    if (!data) throw Object.assign(new Error('bad code'), { badCode: true });
    writeJSON(CACHE_KEY, data);
    const pending = readJSON(OUTBOX_KEY, []);
    return { ...data, log: [...data.log, ...pending], offline: false };
  } catch (err) {
    if (err.badCode) throw err;
    const cached = readJSON(CACHE_KEY, null);
    if (!cached) throw err;
    return { ...cached, log: [...cached.log, ...readJSON(OUTBOX_KEY, [])], offline: true };
  }
}

/** Check a setup code typed on Gloria's phone. */
export async function tryDeviceCode(code) {
  const sb = await client();
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const data = check(await sb.rpc('gloria_data', { p_code: clean }));
  return !!data;
}

/** Save doses she took. Queued and retried if the phone is offline. */
export async function logDoses(entries) {
  if (isDemo) {
    const d = demoData();
    d.log.push(...entries);
    saveDemo(d);
    return;
  }
  writeJSON(OUTBOX_KEY, [...readJSON(OUTBOX_KEY, []), ...entries]);
  await flushOutbox();
}

async function flushOutbox() {
  const pending = readJSON(OUTBOX_KEY, []);
  if (!pending.length || isDemo) return;
  try {
    const sb = await client();
    check(await sb.rpc('gloria_log', { p_code: deviceCode.get(), p_entries: pending }));
    const sent = new Set(pending.map((e) => e.id));
    writeJSON(OUTBOX_KEY, readJSON(OUTBOX_KEY, []).filter((e) => !sent.has(e.id)));
  } catch {
    /* still offline; try again next time */
  }
}

export async function savePushSubscription(subscription) {
  if (isDemo) return;
  const sb = await client();
  check(await sb.rpc('gloria_subscribe', { p_code: deviceCode.get(), p_subscription: subscription }));
}

// ================================================================ Bonnie's page
export async function adminSession() {
  if (isDemo) return { email: 'demo' };
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.user || null;
}

export async function adminSignIn(email, password) {
  const sb = await client();
  check(await sb.auth.signInWithPassword({ email, password }));
}

export async function adminSignOut() {
  if (isDemo) return;
  const sb = await client();
  await sb.auth.signOut();
}

export async function adminLoad(days = 14) {
  if (isDemo) {
    const d = demoData();
    return { settings: d.settings, medications: d.medications, log: d.log };
  }
  const sb = await client();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const settings = check(await sb.from('settings').select('*').eq('id', 1).maybeSingle());
  if (!settings) throw new Error('Your account is not on the caregiver list. See README, step 4.');
  const medications = check(await sb.from('medications').select('*').order('sort').order('name'));
  const log = check(await sb.from('dose_log').select('*').gte('taken_at', since).order('taken_at'));
  return { settings, medications, log };
}

export async function saveMedication(med) {
  const row = { ...MED_DEFAULTS, ...med, updated_at: new Date().toISOString() };
  if (!row.id) row.id = uuid();
  if (isDemo) {
    const d = demoData();
    const i = d.medications.findIndex((m) => m.id === row.id);
    if (i >= 0) d.medications[i] = row;
    else d.medications.push({ ...row, sort: d.medications.length });
    saveDemo(d);
    return row;
  }
  const sb = await client();
  return check(await sb.from('medications').upsert(row).select().single());
}

export async function deleteMedication(id) {
  if (isDemo) {
    const d = demoData();
    d.medications = d.medications.filter((m) => m.id !== id);
    saveDemo(d);
    return;
  }
  const sb = await client();
  check(await sb.from('medications').delete().eq('id', id));
}

export async function deleteLogEntry(id) {
  if (isDemo) {
    const d = demoData();
    d.log = d.log.filter((e) => e.id !== id);
    saveDemo(d);
    return;
  }
  const sb = await client();
  check(await sb.from('dose_log').delete().eq('id', id));
}

export async function saveSettings(settings) {
  if (isDemo) {
    const d = demoData();
    d.settings = { ...d.settings, ...settings };
    saveDemo(d);
    return d.settings;
  }
  const sb = await client();
  return check(await sb.from('settings').update(settings).eq('id', 1).select().single());
}

/** A new random setup code for Gloria's phone, like "K7MP2QXR9HTA". */
export function newDeviceCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
