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
