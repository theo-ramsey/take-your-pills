import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentRemindersToSend, addDays } from '../supabase/functions/send-reminders/reminders.js';
import { splitAppointments, nextAppointment, needsNote, historyDays, dayLabel, formatDuration } from '../js/appointments.js';

const date = '2026-11-20';
const appt = { id: '11111111-1111-4111-8111-111111111111', date: '2026-11-21', time: '10:30', doctor: 'Dr. Patel', purpose: 'Heart check-up', place: 'Main St Clinic', details: 'Bring your medicine list.' };
const today = { ...appt, id: '22222222-2222-4222-8222-222222222222', date };

test('addDays crosses month ends', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('day-before reminder at 4 PM, once', () => {
  const r = appointmentRemindersToSend({ appts: [appt], sent: [], date, minutes: 16 * 60 + 2 });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'appt-day-before');
  assert.match(r[0].title, /Tomorrow: appointment at 10:30 AM/);
  assert.match(r[0].body, /Dr\. Patel \(Heart check-up\) at Main St Clinic\. Bring your medicine list\./);
  const sent = [{ local_date: date, time: appt.id, kind: 'appt-day-before' }];
  assert.deepEqual(appointmentRemindersToSend({ appts: [appt], sent, date, minutes: 16 * 60 + 3 }), []);
  assert.deepEqual(appointmentRemindersToSend({ appts: [appt], sent: [], date, minutes: 15 * 60 }), []);
});

test('2 hours before, and a note reminder 1 hour after unless she already recorded one', () => {
  const soon = appointmentRemindersToSend({ appts: [today], sent: [], date, minutes: 8 * 60 + 30 });
  assert.deepEqual(soon.map((r) => r.kind), ['appt-soon']);
  const after = appointmentRemindersToSend({ appts: [today], sent: [], date, minutes: 11 * 60 + 30 });
  assert.deepEqual(after.map((r) => r.kind), ['appt-note']);
  assert.equal(after[0].url, `./#record=${today.id}`);
  const recorded = appointmentRemindersToSend({ appts: [today], notes: [{ appointment_id: today.id }], sent: [], date, minutes: 11 * 60 + 30 });
  assert.deepEqual(recorded, []);
});

test('no reminders before 7 AM or after 9 PM', () => {
  const early = { ...today, time: '08:00' }; // 2 hours before would be 6:00, so it comes at 7:00
  assert.deepEqual(appointmentRemindersToSend({ appts: [early], sent: [], date, minutes: 6 * 60 }), []);
  assert.deepEqual(appointmentRemindersToSend({ appts: [early], sent: [], date, minutes: 7 * 60 }).map((r) => r.kind), ['appt-soon']);
  const late = { ...today, time: '20:30' }; // note reminder would be 9:30 PM
  assert.deepEqual(appointmentRemindersToSend({ appts: [late], sent: [], date, minutes: 21 * 60 + 30 }), []);
});

test('splits upcoming and past; today stays upcoming for an hour', () => {
  const now = new Date(2026, 10, 20, 11, 0);
  const past = { ...today, id: 'p', date: '2026-11-10' };
  const { upcoming, past: done } = splitAppointments([appt, today, past], now);
  assert.deepEqual(upcoming.map((a) => a.id), [today.id, appt.id]);
  assert.deepEqual(done.map((a) => a.id), ['p']);
  assert.equal(nextAppointment([appt, past], now).id, appt.id);
  assert.equal(nextAppointment([{ ...appt, date: '2027-01-30' }], now), null);
});

test('asks for a note 30 minutes after it starts, for 3 days, until there is one', () => {
  assert.deepEqual(needsNote([today], new Date(2026, 10, 20, 10, 45)), []);
  assert.deepEqual(needsNote([today], new Date(2026, 10, 20, 11, 0)).map((a) => a.id), [today.id]);
  assert.deepEqual(needsNote([{ ...today, audio: [{ id: 'n' }] }], new Date(2026, 10, 20, 11, 0)), []);
  assert.deepEqual(needsNote([today], new Date(2026, 10, 24, 11, 0)), []);
});

test("a recording the caregiver attached doesn't count as her note", () => {
  const withBonnies = { ...today, audio: [{ id: 'b', added_by: 'caregiver' }] };
  assert.deepEqual(needsNote([withBonnies], new Date(2026, 10, 20, 11, 0)).map((a) => a.id), [today.id]);
  const r = appointmentRemindersToSend({
    appts: [today], notes: [{ appointment_id: today.id, added_by: 'caregiver' }], sent: [], date, minutes: 11 * 60 + 30,
  });
  assert.deepEqual(r.map((x) => x.kind), ['appt-note']);
});

test('history groups doses and past appointments by day, newest first', () => {
  const now = new Date(2026, 10, 21, 18, 0);
  const entries = [
    { id: 'a', local_date: '2026-11-20', taken_at: new Date(2026, 10, 20, 8, 5).toISOString(), name: 'Lisinopril' },
    { id: 'b', local_date: '2026-11-21', taken_at: new Date(2026, 10, 21, 8, 1).toISOString(), name: 'Eliquis' },
  ];
  const future = { ...appt, id: 'f', date: '2026-11-25' };
  const days = historyDays(entries, [today, future], now);
  assert.deepEqual(days.map((d) => d.key), ['2026-11-21', '2026-11-20']);
  assert.deepEqual(days[1].items.map((i) => i.type), ['appt', 'dose']); // 10:30 appointment above the 8:05 dose
});

test('labels and durations', () => {
  const now = new Date(2026, 10, 20, 9, 0);
  assert.equal(dayLabel('2026-11-20', now), 'Today');
  assert.equal(dayLabel('2026-11-21', now), 'Tomorrow');
  assert.equal(dayLabel('2026-11-19', now), 'Yesterday');
  assert.equal(formatDuration(65.4), '1:05');
});
