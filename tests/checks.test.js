import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identify } from '../js/drugs.js';
import { itemFromMed, itemFromText, checkBasket, checkPrescriptions } from '../js/checks.js';
import { dueNow, nextUp, dayReport, planDose, dateKey } from '../js/schedule.js';
import { EXAMPLE_MEDICATIONS } from '../js/examples.js';

const meds = EXAMPLE_MEDICATIONS.map((m, i) => ({ id: `m${i}`, active: true, ...m }));
const byName = (n) => meds.find((m) => m.name === n);
const at = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, 20, h, m);
};
const logEntry = (med, slot, time, extra = {}) => ({
  id: `l${Math.random()}`,
  taken_at: at(time).toISOString(),
  local_date: dateKey(at(time)),
  medication_id: med?.id ?? null,
  name: med?.name ?? extra.name,
  prescribed: !!med,
  scheduled_for: slot,
  ...extra,
});

test('recognises brands, combinations and misspellings', () => {
  assert.deepEqual(identify('Advil PM').ingredients.sort(), ['diphenhydramine', 'ibuprofen']);
  assert.deepEqual(identify('Percocet 5/325').ingredients.sort(), ['acetaminophen', 'oxycodone']);
  assert.equal(identify('advill').guessed, 'Advil');
  assert.equal(identify('mystery tea').known, false);
});

test('morning medicines are due at 8:00 and then not after logging', () => {
  const due = dueNow(meds, [], at('08:10')).map((d) => d.med.name);
  assert.deepEqual(due.sort(), ['Eliquis', 'Levothyroxine', 'Lisinopril', 'Metformin']);
  const log = due.map((n) => logEntry(byName(n), byName(n).times[0], '08:12'));
  assert.deepEqual(dueNow(meds, log, at('08:15')), []);
  const next = nextUp(meds, log, at('08:15'));
  assert.equal(next.time, '18:00');
});

test('warns about a double dose', () => {
  const eliquis = byName('Eliquis');
  const log = [logEntry(eliquis, '08:00', '08:05')];
  assert.ok(planDose(eliquis, log, at('09:00')).alreadyTaken);
  const warnings = checkBasket({ items: [itemFromMed(eliquis, log, at('09:00'))], meds, log, now: at('09:00') });
  assert.equal(warnings[0].title, 'Already taken');
  assert.equal(warnings[0].level, 'danger');
});

test('warns when a prescribed medicine is not due', () => {
  const statin = byName('Atorvastatin');
  const warnings = checkBasket({ items: [itemFromMed(statin, [], at('10:00'))], meds, log: [], now: at('10:00') });
  assert.equal(warnings[0].title, 'Not time for this one');
});

test('on-time prescribed medicines produce no warnings', () => {
  const items = ['Lisinopril', 'Eliquis', 'Metformin'].map((n) => itemFromMed(byName(n), [], at('08:00')));
  assert.deepEqual(checkBasket({ items, meds, log: [], now: at('08:00') }), []);
});

test('Advil with Eliquis is a danger warning', () => {
  const advil = itemFromText('Advil', '2', meds, [], at('12:00'));
  assert.equal(advil.prescribed, false);
  const warnings = checkBasket({ items: [advil], meds, log: [], now: at('12:00') });
  assert.equal(warnings[0].level, 'danger');
  assert.match(warnings[0].message, /Advil and Eliquis/);
  assert.ok(warnings.some((w) => w.title === 'Not on your list'));
  assert.ok(warnings.some((w) => /Lisinopril/.test(w.message)), 'also mentions blood pressure medicine');
});

test('NyQuil doubles up acetaminophen with prescribed Tylenol', () => {
  const nyquil = itemFromText('NyQuil', '', meds, [], at('21:00'));
  const warnings = checkBasket({ items: [nyquil], meds, log: [], now: at('21:00') });
  assert.ok(warnings.some((w) => w.title === 'Too much acetaminophen'));
});

test('typing a brand of a prescribed generic counts as prescribed', () => {
  const item = itemFromText('acetaminophen', '1', meds, [], at('12:00'));
  assert.equal(item.prescribed, true);
  assert.equal(item.med.name, 'Tylenol');
});

test('as-needed limit per day', () => {
  const tylenol = byName('Tylenol');
  const log = ['06:00', '10:00', '14:00'].map((t) => logEntry(tylenol, null, t));
  const warnings = checkBasket({ items: [itemFromMed(tylenol, log, at('18:00'))], meds, log, now: at('18:00') });
  assert.equal(warnings[0].title, 'Too many today');
});

test('Tums is flagged for spacing from levothyroxine', () => {
  const warnings = checkBasket({ items: [itemFromText('Tums', '', meds, [], at('07:00'))], meds, log: [], now: at('07:00') });
  assert.ok(warnings.some((w) => w.title === 'Take at a different time' && /Levothyroxine/.test(w.message)));
});

test('unknown medicine gets one clear warning', () => {
  const warnings = checkBasket({ items: [itemFromText('Grandma tonic', '', meds, [], at('12:00'))], meds, log: [], now: at('12:00') });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /doesn't recognise/);
});

test('earlier unprescribed medicine is considered', () => {
  const log = [logEntry(null, null, '13:00', { name: 'Tylenol PM' })];
  const warnings = checkBasket({ items: [itemFromText('Benadryl', '', meds, log, at('15:00'))], meds, log, now: at('15:00') });
  assert.ok(warnings.some((w) => /which you took at 1:00 PM/.test(w.message)));
});

test('day report marks missed doses', () => {
  const report = dayReport(meds, [], dateKey(at('23:00')), at('23:00'));
  assert.ok(report.filter((r) => r.time < '20:00').every((r) => r.status === 'missed'));
  assert.ok(report.filter((r) => r.time >= '20:00').every((r) => r.status === 'due'));
});

test('prescription check finds Eliquis + nothing dangerous in examples', () => {
  const { warnings, unknown } = checkPrescriptions(meds);
  assert.deepEqual(unknown, []);
  assert.ok(warnings.every((w) => w.level !== 'danger'), JSON.stringify(warnings));
});
