// Appointments and history: plain logic shared by Gloria's screen, Bonnie's page and the tests.
// Appointment dates and times are wall-clock ('YYYY-MM-DD', 'HH:MM') in Gloria's time zone.
import { dateKey, toMinutes, formatTime } from './schedule.js';

export const NOTE_PROMPT_AFTER = 30;   // ask for a voice note 30 minutes after it starts...
export const NOTE_PROMPT_DAYS = 3;     // ...for up to 3 days

/** Local Date for an appointment's start. */
export function startsAt(a) {
  const [y, m, d] = a.date.split('-').map(Number);
  const mins = toMinutes(a.time || '00:00');
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60);
}

/** A 'YYYY-MM-DD' key as a Date at noon (safe from DST edges). */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** "Today", "Tomorrow", "Yesterday", or "Tuesday, December 2" (adds the year if it isn't this year). */
export function dayLabel(key, now = new Date()) {
  const today = dateKey(now);
  const d = keyToDate(key);
  const diff = Math.round((d - keyToDate(today)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** Short name for the appointment: the doctor, else what it's for. */
export const apptName = (a) => a.doctor || a.purpose || 'Appointment';

/** "Dr. Patel · Heart check-up" */
export const apptLine = (a) => [a.doctor, a.purpose].filter(Boolean).join(' · ') || 'Appointment';

export const apptWhen = (a, now = new Date()) => `${dayLabel(a.date, now)}, ${formatTime(a.time)}`;

/** Upcoming appointments (soonest first) and past ones (newest first). Today's stay "upcoming" until 1 hour after they start. */
export function splitAppointments(appts, now = new Date()) {
  const cutoff = now.getTime() - 60 * 60000;
  const upcoming = [];
  const past = [];
  for (const a of appts) (startsAt(a).getTime() >= cutoff ? upcoming : past).push(a);
  upcoming.sort((a, b) => startsAt(a) - startsAt(b));
  past.sort((a, b) => startsAt(b) - startsAt(a));
  return { upcoming, past };
}

/** The next appointment within `days` days, or null. */
export function nextAppointment(appts, now = new Date(), days = 14) {
  const { upcoming } = splitAppointments(appts, now);
  const limit = now.getTime() + days * 86400000;
  return upcoming.find((a) => startsAt(a).getTime() <= limit) || null;
}

/** Recent appointments that have started and have no voice note yet, newest first. */
export function needsNote(appts, now = new Date()) {
  const t = now.getTime();
  return appts
    .filter((a) => !(a.audio || []).length)
    .filter((a) => {
      const s = startsAt(a).getTime();
      return t >= s + NOTE_PROMPT_AFTER * 60000 && t <= s + NOTE_PROMPT_DAYS * 86400000;
    })
    .sort((a, b) => startsAt(b) - startsAt(a));
}

/** "1:05" from seconds. */
export function formatDuration(s) {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/**
 * Pill entries and past appointments grouped by day, newest day first:
 * [{ key, items: [{ type: 'dose' | 'appt', sort, entry | appt }] }]
 * Only appointments on or after `fromKey` (if given) and not in the future are included.
 */
export function historyDays(entries, appts, now = new Date(), fromKey = '') {
  const days = new Map();
  const add = (key, item) => {
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(item);
  };
  for (const e of entries) {
    const t = new Date(e.taken_at);
    add(e.local_date || dateKey(t), { type: 'dose', sort: t.getHours() * 60 + t.getMinutes(), entry: e });
  }
  for (const a of appts) {
    if (startsAt(a) > now || (fromKey && a.date < fromKey)) continue;
    add(a.date, { type: 'appt', sort: toMinutes(a.time), appt: a });
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({ key, items: items.sort((x, y) => y.sort - x.sort) }));
}
