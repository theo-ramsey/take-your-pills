// Schedule logic: what is due now, what was already taken, what was missed.
// Times are wall-clock "HH:MM" strings in Gloria's local time.

export const WINDOW_BEFORE = 60; // a dose shows as "due" from 60 minutes before...
export const WINDOW_AFTER = 180; // ...until 3 hours after its time. After that it counts as missed.

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesNow(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTime(hhmm) {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatClock(date) {
  return formatTime(`${date.getHours()}:${date.getMinutes()}`);
}

export function sortedTimes(med) {
  return [...(med.times || [])].sort((a, b) => toMinutes(a) - toMinutes(b));
}

export function isScheduled(med) {
  return med.active !== false && !med.as_needed && (med.times || []).length > 0;
}

/** Log entries from a given local day. */
export function entriesOn(log, key) {
  return log.filter((e) => (e.local_date || dateKey(new Date(e.taken_at))) === key);
}

function takenEntry(log, med, time, key) {
  return entriesOn(log, key).find((e) => e.medication_id === med.id && e.scheduled_for === time);
}

/**
 * For a prescribed medicine she is about to take now, decide which scheduled
 * time it counts for.
 *  - { slot: '08:00' }                     on time, not yet taken
 *  - { slot: null, alreadyTaken: entry }    every dose due around now is already logged
 *  - { slot: null, notDue: true, times }    nothing scheduled around now
 *  - { slot: null }                         as-needed medicine
 */
export function planDose(med, log, now = new Date()) {
  if (med.as_needed || !(med.times || []).length) return { slot: null };
  const key = dateKey(now);
  const mins = minutesNow(now);
  const inWindow = sortedTimes(med).filter((t) => {
    const tm = toMinutes(t);
    return mins >= tm - WINDOW_BEFORE && mins <= tm + WINDOW_AFTER;
  });
  if (!inWindow.length) return { slot: null, notDue: true, times: sortedTimes(med) };
  const open = inWindow.find((t) => !takenEntry(log, med, t, key));
  if (open) return { slot: open };
  return { slot: null, alreadyTaken: takenEntry(log, med, inWindow[inWindow.length - 1], key) };
}

/** Medicines that are due right now and not yet taken: [{ med, time }]. */
export function dueNow(meds, log, now = new Date()) {
  const key = dateKey(now);
  const mins = minutesNow(now);
  const out = [];
  for (const med of meds.filter(isScheduled)) {
    for (const t of sortedTimes(med)) {
      const tm = toMinutes(t);
      if (mins >= tm - WINDOW_BEFORE && mins <= tm + WINDOW_AFTER && !takenEntry(log, med, t, key)) {
        out.push({ med, time: t });
        break; // at most one dose of a medicine at once
      }
    }
  }
  return out.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

/** The next time something is due (after the current due window): { time, meds, tomorrow } or null. */
export function nextUp(meds, log, now = new Date()) {
  const key = dateKey(now);
  const mins = minutesNow(now);
  const byTime = new Map();
  for (const med of meds.filter(isScheduled)) {
    for (const t of med.times) {
      if (!byTime.has(t)) byTime.set(t, []);
      byTime.get(t).push(med);
    }
  }
  const times = [...byTime.keys()].sort((a, b) => toMinutes(a) - toMinutes(b));
  if (!times.length) return null;
  const later = times.find(
    (t) => toMinutes(t) - WINDOW_BEFORE > mins && byTime.get(t).some((m) => !takenEntry(log, m, t, key))
  );
  if (later) return { time: later, meds: byTime.get(later), tomorrow: false };
  return { time: times[0], meds: byTime.get(times[0]), tomorrow: true };
}

/**
 * Every scheduled dose for a day with its status:
 * [{ time, med, status: 'taken' | 'missed' | 'due' | 'later', entry }]
 * For past days, anything not taken is 'missed'.
 */
export function dayReport(meds, log, key, now = new Date()) {
  const today = dateKey(now);
  const mins = minutesNow(now);
  const rows = [];
  for (const med of meds.filter(isScheduled)) {
    for (const t of med.times) {
      const entry = takenEntry(log, med, t, key);
      let status;
      if (entry) status = 'taken';
      else if (key < today) status = 'missed';
      else if (key > today) status = 'later';
      else if (mins > toMinutes(t) + WINDOW_AFTER) status = 'missed';
      else if (mins >= toMinutes(t) - WINDOW_BEFORE) status = 'due';
      else status = 'later';
      rows.push({ time: t, med, status, entry });
    }
  }
  return rows.sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || a.med.name.localeCompare(b.med.name));
}

/** How many times a medicine was logged in the last 24 hours. */
export function countLast24h(log, medId, now = new Date()) {
  const since = now.getTime() - 24 * 3600 * 1000;
  return log.filter((e) => e.medication_id === medId && new Date(e.taken_at).getTime() >= since).length;
}
