// Decides which reminder notifications to send right now. Plain JavaScript so it
// runs both in the Supabase function (Deno) and in the tests (Node).

export const DUE_WINDOW = 10; // send the reminder within 10 minutes of the dose time
export const NUDGE_AFTER = 30; // send a second reminder 30 minutes later if not logged

/** Current date and minutes-since-midnight in a time zone. */
export function localNow(timeZone, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function formatTime(t) {
  const mins = toMinutes(t);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * meds: active medications; log: dose_log rows for `date`; sent: reminders_sent rows for `date`.
 * Returns [{ kind, time, title, body }].
 */
export function remindersToSend({ meds, log, sent, date, minutes, name = '' }) {
  const byTime = new Map();
  for (const med of meds) {
    if (med.active === false || med.as_needed) continue;
    for (const t of med.times || []) {
      if (!byTime.has(t)) byTime.set(t, []);
      byTime.get(t).push(med);
    }
  }
  const alreadySent = new Set(sent.map((s) => `${s.local_date}|${s.time}|${s.kind}`));
  const out = [];
  for (const [time, list] of byTime) {
    const tm = toMinutes(time);
    const untaken = list.filter(
      (m) => !log.some((e) => e.local_date === date && e.scheduled_for === time && e.medication_id === m.id)
    );
    if (!untaken.length) continue;
    const names = untaken.map((m) => [m.name, m.strength].filter(Boolean).join(' ')).join(', ');
    if (minutes >= tm && minutes < tm + DUE_WINDOW && !alreadySent.has(`${date}|${time}|due`)) {
      out.push({
        kind: 'due',
        time,
        title: `${name ? `${name}, it's` : "It's"} time for your ${formatTime(time)} medicine`,
        body: `${names}. Open the app before you take them.`,
      });
    }
    const n = tm + NUDGE_AFTER;
    if (minutes >= n && minutes < n + DUE_WINDOW && !alreadySent.has(`${date}|${time}|nudge`)) {
      out.push({
        kind: 'nudge',
        time,
        title: `Did you take your ${formatTime(time)} medicine?`,
        body: `${names}. Open the app to check off what you took.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- appointments
export const APPT_DAY_BEFORE_AT = 16 * 60; // 4:00 PM the day before
export const APPT_SOON_BEFORE = 120;       // 2 hours before
export const APPT_NOTE_AFTER = 60;         // 1 hour after it starts, ask for a voice note
export const QUIET_BEFORE = 7 * 60;        // no reminders before 7:00 AM...
export const QUIET_AFTER = 21 * 60;        // ...or after 9:00 PM

/** 'YYYY-MM-DD' plus n days. */
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const who = (a) => a.doctor || a.purpose || 'your appointment';
const whereAndWhat = (a) =>
  [a.doctor && a.purpose ? `${a.doctor} (${a.purpose})` : who(a), a.place && `at ${a.place}`].filter(Boolean).join(' ');

/**
 * appts: appointments dated today or tomorrow; notes: audio_notes rows ({ appointment_id }) for them;
 * sent: reminders_sent rows for `date`. Returns [{ kind, slot, tag, url, title, body }].
 */
export function appointmentRemindersToSend({ appts, notes = [], sent, date, minutes, name = 'Gloria' }) {
  const tomorrow = addDays(date, 1);
  const alreadySent = new Set(sent.filter((s) => s.local_date === date).map((s) => `${s.time}|${s.kind}`));
  // Only her own voice notes count; a recording the caregiver attached doesn't stop the reminder.
  const hasNote = new Set(notes.filter((n) => n.added_by !== 'caregiver').map((n) => n.appointment_id));
  const now = (at) => minutes >= at && minutes < at + DUE_WINDOW;
  const out = [];
  const add = (a, kind, title, body, url = './') => {
    if (!alreadySent.has(`${a.id}|${kind}`)) out.push({ kind, slot: a.id, tag: `appt-${a.id}-${kind}`, url, title, body });
  };
  for (const a of appts) {
    const t = toMinutes(a.time);
    const extra = a.details ? ` ${a.details}` : '';
    if (a.date === tomorrow && now(APPT_DAY_BEFORE_AT)) {
      add(a, 'appt-day-before', `Tomorrow: appointment at ${formatTime(a.time)}`, `${whereAndWhat(a)}.${extra}`);
    }
    if (a.date !== date) continue;
    const soon = Math.max(t - APPT_SOON_BEFORE, QUIET_BEFORE);
    if (soon < t && now(soon)) {
      add(a, 'appt-soon', `Appointment today at ${formatTime(a.time)}`, `${whereAndWhat(a)}. Time to get ready.${extra}`);
    }
    const after = t + APPT_NOTE_AFTER;
    if (after <= QUIET_AFTER && now(after) && !hasNote.has(a.id)) {
      add(
        a, 'appt-note', `How did it go with ${who(a)}?`,
        `Open My Pills and tap "${name} audio note" to save what the doctor said.`,
        `./#record=${a.id}`,
      );
    }
  }
  return out;
}
