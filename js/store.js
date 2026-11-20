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
  data.appointments ||= [];
  data.audio ||= []; // { id, appointment_id, created_at, duration_s, url } (url is a data: URL in demo mode)
  return data;
}

/** Appointments with their voice notes attached, the shape gloria_data returns. */
function demoAppointments(d) {
  return d.appointments.map((a) => ({
    ...a,
    audio: d.audio.filter((n) => n.appointment_id === a.id).map(({ url, ...n }) => n),
  }));
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
    return { settings: d.settings, medications: d.medications, log: d.log, appointments: demoAppointments(d), offline: false };
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

/** Her pill log for the `days` days before `beforeKey` ('YYYY-MM-DD', not included), newest first. */
export async function loadHistory(beforeKey, days = 60) {
  if (isDemo) {
    const d = demoData();
    const entries = d.log.filter((e) => e.local_date < beforeKey).sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1));
    return { entries, more: false };
  }
  const sb = await client();
  const data = check(await sb.rpc('gloria_history', { p_code: deviceCode.get(), p_before: beforeKey, p_days: days }));
  if (!data) throw Object.assign(new Error('bad code'), { badCode: true });
  return data;
}

async function functionError(error) {
  try {
    const body = await error.context.json();
    return new Error(body.error || error.message);
  } catch {
    return new Error(error.message);
  }
}

/** Save a voice note she recorded about an appointment. */
export async function saveAudioNote({ id, appointment_id, blob, duration_s }) {
  if (isDemo) {
    const url = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const d = demoData();
    d.audio.push({ id, appointment_id, created_at: new Date().toISOString(), duration_s, url });
    localStorage.setItem(DEMO_KEY, JSON.stringify(d)); // throws if the browser is out of room
    return;
  }
  const fd = new FormData();
  fd.append('code', deviceCode.get());
  fd.append('id', id);
  fd.append('appointment_id', appointment_id);
  fd.append('duration_s', String(Math.round(duration_s || 0)));
  fd.append('file', blob, 'note');
  const sb = await client();
  const { error } = await sb.functions.invoke('gloria-notes', { body: fd });
  if (error) throw await functionError(error);
}

/** Gloria deletes one of her own audio notes. */
export async function deleteOwnAudioNote(id) {
  if (isDemo) {
    const d = demoData();
    d.audio = d.audio.filter((n) => !(n.id === id && n.added_by !== 'caregiver'));
    saveDemo(d);
    return;
  }
  const sb = await client();
  const { error } = await sb.functions.invoke('gloria-notes', { body: { action: 'delete', code: deviceCode.get(), id } });
  if (error) throw await functionError(error);
}

/** Playable links for all her voice notes: { noteId: url }. */
export async function audioNoteUrls() {
  if (isDemo) return Object.fromEntries(demoData().audio.map((n) => [n.id, n.url]));
  const sb = await client();
  const { data, error } = await sb.functions.invoke('gloria-notes', { body: { action: 'urls', code: deviceCode.get() } });
  if (error) throw await functionError(error);
  return data.urls || {};
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
    return { settings: d.settings, medications: d.medications, log: d.log, appointments: demoAppointments(d) };
  }
  const sb = await client();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const settings = check(await sb.from('settings').select('*').eq('id', 1).maybeSingle());
  if (!settings) throw new Error('Your account is not on the caregiver list. See README, step 4.');
  const medications = check(await sb.from('medications').select('*').order('sort').order('name'));
  const log = check(await sb.from('dose_log').select('*').gte('taken_at', since).order('taken_at'));
  const appointments = check(
    await sb.from('appointments').select('*, audio:audio_notes(*)').order('date').order('time')
  ).map((a) => ({ ...a, audio: (a.audio || []).sort((x, y) => (x.created_at < y.created_at ? -1 : 1)) }));
  return { settings, medications, log, appointments };
}

const APPT_FIELDS = ['date', 'time', 'doctor', 'purpose', 'place', 'details'];

export async function saveAppointment(appt) {
  const row = Object.fromEntries(APPT_FIELDS.map((k) => [k, appt[k] ?? '']));
  row.id = appt.id || uuid();
  row.updated_at = new Date().toISOString();
  if (isDemo) {
    const d = demoData();
    const i = d.appointments.findIndex((a) => a.id === row.id);
    if (i >= 0) d.appointments[i] = row;
    else d.appointments.push(row);
    saveDemo(d);
    return demoAppointments(d).find((a) => a.id === row.id);
  }
  const sb = await client();
  return check(await sb.from('appointments').upsert(row).select('*, audio:audio_notes(*)').single());
}

/** Deletes the appointment and its voice notes. */
export async function deleteAppointment(appt) {
  if (isDemo) {
    const d = demoData();
    d.appointments = d.appointments.filter((a) => a.id !== appt.id);
    d.audio = d.audio.filter((n) => n.appointment_id !== appt.id);
    saveDemo(d);
    return;
  }
  const sb = await client();
  const paths = (appt.audio || []).map((n) => n.path).filter(Boolean);
  if (paths.length) check(await sb.storage.from('audio-notes').remove(paths));
  check(await sb.from('appointments').delete().eq('id', appt.id));
}

export async function deleteAudioNote(note) {
  if (isDemo) {
    const d = demoData();
    d.audio = d.audio.filter((n) => n.id !== note.id);
    saveDemo(d);
    return;
  }
  const sb = await client();
  if (note.path) check(await sb.storage.from('audio-notes').remove([note.path]));
  check(await sb.from('audio_notes').delete().eq('id', note.id));
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const AUDIO_TYPES = { m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', caf: 'audio/x-caf' };

/** Bonnie saves an audio note she recorded (a Blob from the recorder). Returns the new audio_notes row. */
export function saveCaregiverRecording(appt, blob, duration_s) {
  const ext = /webm/.test(blob.type) ? 'webm' : /ogg/.test(blob.type) ? 'ogg' : 'm4a';
  return attachAudio(appt, new File([blob], `audio-note.${ext}`, { type: blob.type || 'audio/mp4' }), duration_s);
}

/** Bonnie attaches an audio file to an appointment. Returns the new audio_notes row. */
export async function attachAudio(appt, file, duration_s) {
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'm4a').toLowerCase();
  const mime = (file.type || AUDIO_TYPES[ext] || 'audio/mp4').split(';')[0];
  if (!mime.startsWith('audio/') && !mime.startsWith('video/mp4')) throw new Error('That file is not an audio recording.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That recording is over 50 MB. Try a shorter or compressed one.');
  const id = uuid();
  const row = {
    id, appointment_id: appt.id, path: `${appt.id}/${id}.${ext}`, mime, duration_s: duration_s ? Math.round(duration_s) : null,
    added_by: 'caregiver', label: file.name.slice(0, 200), created_at: new Date().toISOString(),
  };
  if (isDemo) {
    const url = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const d = demoData();
    d.audio.push({ ...row, url });
    localStorage.setItem(DEMO_KEY, JSON.stringify(d)); // throws if the browser is out of room
    return row;
  }
  const sb = await client();
  check(await sb.storage.from('audio-notes').upload(row.path, file, { contentType: mime }));
  const { created_at, ...insert } = row;
  try {
    return check(await sb.from('audio_notes').insert(insert).select().single());
  } catch (err) {
    await sb.storage.from('audio-notes').remove([row.path]);
    throw err;
  }
}

/** Playable links for voice notes, for Bonnie: { noteId: url }. */
export async function adminAudioUrls(appointments) {
  if (isDemo) return Object.fromEntries(demoData().audio.map((n) => [n.id, n.url]));
  const notes = appointments.flatMap((a) => a.audio || []);
  if (!notes.length) return {};
  const sb = await client();
  const signed = check(await sb.storage.from('audio-notes').createSignedUrls(notes.map((n) => n.path), 6 * 3600));
  const byPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return Object.fromEntries(notes.map((n) => [n.id, byPath.get(n.path)]).filter(([, u]) => u));
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
