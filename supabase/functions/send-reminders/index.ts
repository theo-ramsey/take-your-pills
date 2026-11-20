// Supabase Edge Function: sends medicine reminders to Gloria's iPhone (and so her Apple Watch).
// Called every minute by the cron job in supabase/cron.sql.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { localNow, remindersToSend, appointmentRemindersToSend, addDays } from './reminders.js';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminders@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  );

  const { data: settings, error } = await sb.from('settings').select('*').eq('id', 1).single();
  if (error) return new Response(error.message, { status: 500 });
  const { date, minutes } = localNow(settings.timezone || 'America/New_York');

  const [meds, log, sent, subs, appts] = await Promise.all([
    sb.from('medications').select('*').eq('active', true),
    sb.from('dose_log').select('medication_id, scheduled_for, local_date').eq('local_date', date),
    sb.from('reminders_sent').select('*').eq('local_date', date),
    sb.from('push_subscriptions').select('*'),
    sb.from('appointments').select('*').in('date', [date, addDays(date, 1)]),
  ]);
  const apptIds = (appts.data ?? []).map((a) => a.id);
  const notes = apptIds.length
    ? await sb.from('audio_notes').select('appointment_id').in('appointment_id', apptIds)
    : { data: [] };

  const reminders = [
    ...remindersToSend({
      meds: meds.data ?? [], log: log.data ?? [], sent: sent.data ?? [], date, minutes, name: settings.gloria_name,
    }).map((r) => ({ ...r, slot: r.time, tag: `${date}-${r.time}`, url: './' })),
    ...appointmentRemindersToSend({ appts: appts.data ?? [], notes: notes.data ?? [], sent: sent.data ?? [], date, minutes }),
  ];

  const results: string[] = [];
  for (const r of reminders) {
    // Record first, so two overlapping runs can't both send it.
    const { error: dup } = await sb.from('reminders_sent').insert({ local_date: date, time: r.slot, kind: r.kind });
    if (dup) continue;
    for (const s of subs.data ?? []) {
      try {
        await webpush.sendNotification(
          s.subscription,
          JSON.stringify({ title: r.title, body: r.body, tag: r.tag, url: r.url }),
          { TTL: 3600, urgency: 'high' },
        );
        results.push(`${r.kind} ${r.slot} sent`);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint); // phone unsubscribed
        } else {
          console.error('push failed', status, e);
        }
        results.push(`${r.kind} ${r.slot} failed (${status})`);
      }
    }
  }
  return Response.json({ date, minutes, results });
});
