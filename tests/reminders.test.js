import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remindersToSend, localNow } from '../supabase/functions/send-reminders/reminders.js';

const meds = [
  { id: 'a', name: 'Lisinopril', strength: '10 mg', times: ['08:00'], active: true },
  { id: 'b', name: 'Eliquis', strength: '5 mg', times: ['08:00', '20:00'], active: true },
  { id: 'c', name: 'Tylenol', times: [], as_needed: true, active: true },
];
const date = '2026-11-20';

test('sends the 8:00 reminder at 8:00 and not twice', () => {
  const r = remindersToSend({ meds, log: [], sent: [], date, minutes: 480, name: 'Gloria' });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'due');
  assert.match(r[0].title, /Gloria, it's time for your 8:00 AM medicine/);
  assert.match(r[0].body, /Lisinopril 10 mg, Eliquis 5 mg/);
  const again = remindersToSend({ meds, log: [], sent: [{ local_date: date, time: '08:00', kind: 'due' }], date, minutes: 482 });
  assert.equal(again.length, 0);
});

test('nudges at 8:30 only for what was not logged', () => {
  const log = [{ local_date: date, scheduled_for: '08:00', medication_id: 'a' }];
  const r = remindersToSend({ meds, log, sent: [], date, minutes: 510 });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'nudge');
  assert.match(r[0].body, /^Eliquis 5 mg\./);
});

test('no reminder if everything was already taken', () => {
  const log = ['a', 'b'].map((id) => ({ local_date: date, scheduled_for: '08:00', medication_id: id }));
  assert.deepEqual(remindersToSend({ meds, log, sent: [], date, minutes: 481 }), []);
});

test('localNow respects time zone', () => {
  const t = new Date('2026-11-20T13:05:00Z');
  assert.deepEqual(localNow('America/New_York', t), { date: '2026-11-20', minutes: 8 * 60 + 5 });
  assert.deepEqual(localNow('America/Los_Angeles', t), { date: '2026-11-20', minutes: 5 * 60 + 5 });
});
