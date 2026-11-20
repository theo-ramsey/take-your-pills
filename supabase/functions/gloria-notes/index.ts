// Supabase Edge Function: voice notes from Gloria's phone.
// Her phone has no login, only the setup code, so it can't use storage directly.
//   POST multipart (code, id, appointment_id, duration_s, file) -> saves a note
//   POST JSON { action: 'urls', code }                       -> { urls: { noteId: playableUrl } }
//   POST JSON { action: 'delete', code, id }                 -> deletes one of HER notes
// Deploy with --no-verify-jwt: the setup code is the check.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const BUCKET = 'audio-notes';
const MAX_BYTES = 25 * 1024 * 1024; // about 25 minutes of iPhone audio
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function extension(mime: string) {
  if (/mp4|m4a|aac/.test(mime)) return 'm4a';
  if (/webm/.test(mime)) return 'webm';
  if (/ogg/.test(mime)) return 'ogg';
  if (/mpeg|mp3/.test(mime)) return 'mp3';
  return 'wav';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const isForm = (req.headers.get('content-type') || '').includes('multipart/form-data');
  let form: FormData | null = null;
  let body: Record<string, unknown> = {};
  try {
    if (isForm) form = await req.formData();
    else body = await req.json();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  const code = String((form ? form.get('code') : body.code) ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const { data: settings } = await sb.from('settings').select('device_code').eq('id', 1).single();
  if (code.length < 10 || !settings?.device_code || settings.device_code !== code) {
    return json({ error: 'invalid setup code' }, 403);
  }

  if (!form && body.action === 'urls') {
    const { data: rows, error } = await sb.from('audio_notes').select('id, path');
    if (error) return json({ error: error.message }, 500);
    if (!rows?.length) return json({ urls: {} });
    const { data: signed, error: e2 } = await sb.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 6 * 3600);
    if (e2) return json({ error: e2.message }, 500);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return json({ urls: Object.fromEntries(rows.map((r) => [r.id, byPath.get(r.path)]).filter(([, u]) => u)) });
  }

  if (!form && body.action === 'delete') {
    // She can delete only her own notes, not ones the caregiver recorded.
    const id = String(body.id ?? '');
    if (!UUID.test(id)) return json({ error: 'bad id' }, 400);
    const { data: note } = await sb.from('audio_notes').select('id, path, added_by').eq('id', id).maybeSingle();
    if (!note) return json({ ok: true }); // already gone
    if (note.added_by === 'caregiver') return json({ error: "that note isn't yours to delete" }, 403);
    const rm = await sb.storage.from(BUCKET).remove([note.path]);
    if (rm.error) return json({ error: rm.error.message }, 500);
    const del = await sb.from('audio_notes').delete().eq('id', id);
    if (del.error) return json({ error: del.error.message }, 500);
    return json({ ok: true });
  }

  if (form) {
    const file = form.get('file');
    const id = String(form.get('id') ?? '');
    const appointmentId = String(form.get('appointment_id') ?? '');
    const duration = Number(form.get('duration_s')) || null;
    if (!(file instanceof File) || !file.size) return json({ error: 'no recording' }, 400);
    if (file.size > MAX_BYTES) return json({ error: 'recording is too long' }, 413);
    if (!UUID.test(id) || !UUID.test(appointmentId)) return json({ error: 'bad id' }, 400);
    const mime = (file.type || 'audio/mp4').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('audio/')) return json({ error: 'not audio' }, 400);
    const { data: appt } = await sb.from('appointments').select('id').eq('id', appointmentId).maybeSingle();
    if (!appt) return json({ error: 'appointment not found' }, 404);

    const path = `${appointmentId}/${id}.${extension(mime)}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: true });
    if (up.error) return json({ error: up.error.message }, 500);
    const ins = await sb.from('audio_notes')
      .upsert({ id, appointment_id: appointmentId, path, mime, duration_s: duration }, { onConflict: 'id', ignoreDuplicates: true });
    if (ins.error) return json({ error: ins.error.message }, 500);
    return json({ ok: true, id });
  }

  return json({ error: 'unknown action' }, 400);
});
