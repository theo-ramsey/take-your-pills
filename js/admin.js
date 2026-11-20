// Bonnie's page: edit the schedule, see history, settings.
import * as store from './store.js';
import { describe } from './drugs.js';
import { checkPrescriptions } from './checks.js';
import { formatTime, formatClock, dayReport, dateKey, toMinutes } from './schedule.js';
import { splitAppointments, apptLine, dayLabel, formatDuration, startsAt } from './appointments.js';
import { canRecord, startRecording, noteStamp } from './recorder.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const dialog = document.getElementById('med-dialog');
const form = document.getElementById('med-form');
const f = form.elements;
const apptDialog = document.getElementById('appt-dialog');
const apptForm = document.getElementById('appt-form');

const state = { tab: 'schedule', settings: {}, meds: [], log: [], appts: [], audioUrls: {}, editing: null, editingAppt: null, rec: null };

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const gloria = () => state.settings.gloria_name || 'Gloria';

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ------------------------------------------------------------------ loading / login
async function start() {
  const user = await store.adminSession();
  if (!user) return renderLogin();
  try {
    const data = await store.adminLoad(14);
    state.settings = data.settings;
    state.meds = data.medications;
    state.log = data.log;
    state.appts = data.appointments || [];
    refreshAudioUrls();
  } catch (err) {
    main.innerHTML = `<div class="alert danger"><b>Could not load the schedule</b>${esc(err.message)}</div>
      <button class="abtn" data-action="sign-out">Sign out</button>`;
    return;
  }
  nav.hidden = false;
  document.getElementById('sign-out').hidden = store.isDemo;
  document.getElementById('title').textContent = `${gloria()}'s medicine schedule`;
  render();
}

function renderLogin(error = '') {
  nav.hidden = true;
  main.innerHTML = `
    <div class="card" style="max-width:420px;margin:40px auto">
      <h2>Sign in</h2>
      ${error ? `<div class="alert danger">${esc(error)}</div>` : ''}
      <form id="login-form">
        <label for="l-email">Email</label>
        <input type="email" id="l-email" required autocomplete="username">
        <label for="l-pass" style="margin-top:12px">Password</label>
        <input type="password" id="l-pass" required autocomplete="current-password">
        <button class="abtn primary" style="margin-top:16px;width:100%">Sign in</button>
      </form>
    </div>`;
  document.getElementById('login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await store.adminSignIn(document.getElementById('l-email').value, document.getElementById('l-pass').value);
      start();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

// ------------------------------------------------------------------ tabs
function render() {
  nav.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  let html = '';
  if (store.isDemo) {
    html += `<div class="banner">Demo mode: changes are saved only in this browser. Open <a href="./">${esc(gloria())}'s screen</a> in this same browser to see them. See README.md to put it online.</div>`;
  }
  if (state.tab === 'schedule') html += renderSchedule();
  if (state.tab === 'appointments') html += renderAppointments();
  if (state.tab === 'history') html += renderHistory();
  if (state.tab === 'settings') html += renderSettings();
  main.innerHTML = html;
  if (state.tab === 'settings') bindSettings();
}

function medSummary(m) {
  return [m.strength, m.amount].filter(Boolean).join(' · ');
}

function renderSchedule() {
  const active = state.meds.filter((m) => m.active !== false);
  const byTime = new Map();
  for (const m of active.filter((m) => !m.as_needed)) {
    for (const t of m.times || []) {
      if (!byTime.has(t)) byTime.set(t, []);
      byTime.get(t).push(m);
    }
  }
  const times = [...byTime.keys()].sort((a, b) => toMinutes(a) - toMinutes(b));
  const asNeeded = active.filter((m) => m.as_needed);

  const { warnings, unknown } = checkPrescriptions(state.meds);
  let alerts = '';
  if (unknown.length) {
    alerts += `<div class="alert"><b>Not recognised: ${unknown.map((m) => esc(m.name)).join(', ')}</b>
      The app can't check these against other medicines. Try the generic name or check the spelling.</div>`;
  }
  for (const w of warnings) {
    alerts += `<div class="alert ${w.level === 'danger' ? 'danger' : ''}"><b>${esc(w.a.name)} + ${esc(w.b.name)}: ${esc(w.title)}</b>${esc(w.message)}
      <div class="hint">Both are prescribed, so ${esc(gloria())} won't be warned about this. Worth confirming with the doctor or pharmacist that it's intended.</div></div>`;
  }

  return `
    <div class="row"><h2 style="margin:8px 0">Daily schedule</h2><span class="spacer"></span>
      <button class="abtn primary" data-action="add-med">＋ Add medicine</button></div>
    <div class="card">
      ${times.length ? `<ul class="timeline">${times
        .map((t) => `<li><span class="t">${formatTime(t)}</span><span>${byTime.get(t).map((m) => `<b>${esc(m.name)}</b> ${esc(medSummary(m))}`).join('<br>')}</span></li>`)
        .join('')}</ul>` : '<p class="muted">No scheduled medicines yet.</p>'}
      ${asNeeded.length ? `<p class="muted" style="margin-bottom:0">When needed: ${asNeeded.map((m) => esc(m.name)).join(', ')}</p>` : ''}
    </div>
    ${alerts ? `<h2>Things to double-check</h2>${alerts}` : ''}
    <h2>All medicines</h2>
    <div class="card">
      <table class="med-table">
        <thead><tr><th>Medicine</th><th>When</th><th>For</th><th></th></tr></thead>
        <tbody>
        ${state.meds
          .map((m) => {
            const d = describe(m.name);
            return `<tr class="${m.active === false ? 'paused' : ''}">
              <td><div class="mname">${esc(m.name)} ${m.active === false ? '<span class="tag amber">stopped</span>' : ''}</div>
                <div>${esc(medSummary(m))}</div>
                ${d ? `<div class="hint">${esc(d.text)}</div>` : '<div class="hint bad">Not recognised by the safety check</div>'}</td>
              <td>${m.as_needed ? `When needed${m.max_per_day ? `<div class="hint">max ${m.max_per_day} a day</div>` : ''}` : (m.times || []).slice().sort().map(formatTime).join('<br>')}</td>
              <td>${esc(m.purpose)}${m.instructions ? `<div class="hint">${esc(m.instructions)}</div>` : ''}</td>
              <td class="actions">
                <button class="abtn" data-action="edit-med" data-id="${esc(m.id)}">Edit</button>
                <button class="abtn quiet" data-action="toggle-med" data-id="${esc(m.id)}">${m.active === false ? 'Restart' : 'Stop'}</button>
              </td></tr>`;
          })
          .join('')}
        </tbody>
      </table>
      ${state.meds.length ? '' : '<p class="muted">No medicines yet. Click "Add medicine".</p>'}
    </div>`;
}

// ------------------------------------------------------------------ appointments
function refreshAudioUrls() {
  store.adminAudioUrls(state.appts)
    .then((urls) => {
      state.audioUrls = urls;
      if (state.tab === 'appointments') render();
    })
    .catch(() => {});
}

const caregiverName = () => state.settings.caregiver_name || 'Bonnie';

function apptRow(a, now, past) {
  const notes = [...(a.audio || [])]
    .sort((x, y) => (x.created_at < y.created_at ? -1 : 1))
    .map((n) => {
      const url = state.audioUrls[n.id];
      const mine = n.added_by === 'caregiver';
      return `<div class="audio-row">
        <span class="tag ${mine ? '' : 'green'}">🎤 ${esc(mine ? caregiverName() : gloria())}</span>
        <span class="stamp">${esc(noteStamp(n.created_at))}${n.duration_s ? ` · ${formatDuration(n.duration_s)}` : ''}</span>
        ${url ? `<audio controls preload="none" src="${esc(url)}"></audio>` : '<span class="muted">Loading…</span>'}
        <button class="abtn quiet" data-action="delete-note" data-appt="${esc(a.id)}" data-id="${esc(n.id)}">Delete</button>
      </div>`;
    })
    .join('');
  const canRecord = past || now >= startsAt(a);
  return `<div class="entry">
    <span class="t wide">${esc(dayLabel(a.date, now))}<br><span class="muted">${formatTime(a.time)}</span></span>
    <span class="w"><b>${esc(apptLine(a))}</b>
      ${a.place ? `<div class="hint">📍 ${esc(a.place)}</div>` : ''}
      ${a.details ? `<div class="hint">Note for ${esc(gloria())}: ${esc(a.details)}</div>` : ''}
      ${notes}
      ${canRecord ? recordControls(a) : ''}
    </span>
    <button class="abtn" data-action="edit-appt" data-id="${esc(a.id)}">Edit</button>
  </div>`;
}

function recordControls(a) {
  const r = state.rec;
  if (r && r.apptId === a.id) {
    if (r.phase === 'starting') return `<div class="rec-inline">Starting the microphone… If the browser asks, click <b>Allow</b>.</div>`;
    if (r.phase === 'saving') return `<div class="rec-inline">Saving…</div>`;
    return `<div class="rec-inline"><span class="dot" aria-hidden="true"></span> Recording
      <span id="admin-rec-time">${formatDuration((Date.now() - r.startedAt) / 1000)}</span>
      <button class="abtn primary" data-action="admin-rec-done">✓ Done</button>
      <button class="abtn quiet" data-action="admin-rec-cancel">Cancel</button></div>`;
  }
  return `<button class="abtn primary rec-start" data-action="admin-rec" data-id="${esc(a.id)}" ${r ? 'disabled' : ''}>
    🎤 ${esc(caregiverName())} audio note</button>`;
}

// Bonnie records an audio note right in the page (on her phone or computer).
async function adminRecStart(appt) {
  if (state.rec) return;
  if (!canRecord()) return alert("This browser can't record audio. Try Safari on an iPhone or Chrome on a computer.");
  const r = { apptId: appt.id, phase: 'starting' };
  state.rec = r;
  render();
  try {
    r.ctl = await startRecording({
      onTick: (s) => {
        const el = document.getElementById('admin-rec-time');
        if (el) el.textContent = formatDuration(s);
      },
      onAutoStop: () => adminRecDone(),
    });
    if (state.rec !== r) return r.ctl.cancel();
    Object.assign(r, { phase: 'recording', startedAt: r.ctl.startedAt });
  } catch {
    state.rec = null;
    alert('The microphone is not allowed. Allow it for this site in the browser settings, then try again.');
  }
  render();
}

async function adminRecDone() {
  const r = state.rec;
  if (!r?.ctl || r.phase !== 'recording') return;
  r.phase = 'saving';
  render();
  const { blob, seconds } = await r.ctl.finish();
  const appt = state.appts.find((a) => a.id === r.apptId);
  for (;;) {
    try {
      if (!blob.size) throw new Error('nothing was recorded');
      const row = await store.saveCaregiverRecording(appt, blob, seconds);
      appt.audio = [...(appt.audio || []), row];
      state.audioUrls[row.id] = URL.createObjectURL(blob);
      toast(`Saved. ${gloria()} can listen to it under Appointments.`);
      refreshAudioUrls();
      break;
    } catch (err) {
      if (!blob.size || !confirm(`Could not save the recording (${err.message}). Try again?`)) break;
    }
  }
  state.rec = null;
  render();
}

function adminRecCancel() {
  state.rec?.ctl?.cancel();
  state.rec = null;
  render();
}

function renderAppointments() {
  const now = new Date();
  const { upcoming, past } = splitAppointments(state.appts, now);
  return `
    <div class="row"><h2 style="margin:8px 0">Appointments</h2><span class="spacer"></span>
      <button class="abtn primary" data-action="add-appt">＋ Add appointment</button></div>
    <div class="card">
      ${upcoming.length ? upcoming.map((a) => apptRow(a, now, false)).join('') : '<p class="muted" style="margin:0">No appointments coming up.</p>'}
    </div>
    <h2>Past appointments and audio notes</h2>
    <div class="card">
      ${past.length ? past.map((a) => apptRow(a, now, true)).join('') : '<p class="muted" style="margin:0">None yet.</p>'}
    </div>
    <p class="hint">After an appointment, tap the green button to record an audio note. ${esc(gloria())} records hers on her phone. You can both listen to each other's notes.</p>`;
}

function openAppt(a) {
  state.editingAppt = a || null;
  const e = apptForm.elements;
  document.getElementById('appt-dialog-title').textContent = a ? 'Edit appointment' : 'Add an appointment';
  e.date.value = a?.date || '';
  e.time.value = a?.time || '';
  e.doctor.value = a?.doctor || '';
  e.purpose.value = a?.purpose || '';
  e.place.value = a?.place || '';
  e.details.value = a?.details || '';
  document.getElementById('appt-delete').hidden = !a;
  apptDialog.showModal();
  if (!a) e.date.focus();
}

document.getElementById('appt-cancel').addEventListener('click', () => apptDialog.close());
document.getElementById('appt-delete').addEventListener('click', async () => {
  const a = state.editingAppt;
  if (!a) return;
  const n = (a.audio || []).length;
  if (!confirm(`Delete this appointment${n ? ` and its ${n === 1 ? 'audio note' : n + ' audio notes'}` : ''}? This can't be undone.`)) return;
  try {
    await store.deleteAppointment(a);
    state.appts = state.appts.filter((x) => x.id !== a.id);
    apptDialog.close();
    toast('Deleted');
    render();
  } catch (err) {
    alert('Could not delete: ' + err.message);
  }
});

apptForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const e = apptForm.elements;
  if (!e.doctor.value.trim() && !e.purpose.value.trim()) {
    alert(`Fill in who ${gloria()} is seeing or what it's for.`);
    return;
  }
  const appt = {
    ...(state.editingAppt || {}),
    date: e.date.value,
    time: e.time.value,
    doctor: e.doctor.value.trim(),
    purpose: e.purpose.value.trim(),
    place: e.place.value.trim(),
    details: e.details.value.trim(),
  };
  try {
    const saved = await store.saveAppointment(appt);
    const i = state.appts.findIndex((x) => x.id === saved.id);
    if (i >= 0) state.appts[i] = saved;
    else state.appts.push(saved);
    apptDialog.close();
    toast('Appointment saved');
    render();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
});

function renderHistory() {
  const now = new Date();
  let html = `<h2>Last 14 days</h2>`;
  for (let i = 0; i < 14; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKey(day);
    const report = dayReport(state.meds, state.log, key, now);
    const dayEntries = state.log.filter((e) => e.local_date === key);
    const reportIds = new Set(report.filter((r) => r.entry).map((r) => r.entry.id));
    const extra = dayEntries.filter((e) => !reportIds.has(e.id));
    if (!report.length && !extra.length) continue;

    const rows = [];
    for (const r of report) {
      if (r.status === 'later') continue;
      const label = { taken: '✓', missed: '✗ Missed', due: '… Due now' }[r.status];
      const cls = r.status === 'missed' ? 'style="color:var(--red);font-weight:600"' : '';
      rows.push({
        sort: toMinutes(r.time),
        html: `<div class="entry"><span class="t">${formatTime(r.time)}</span>
          <span class="w" ${cls}>${label} ${esc(r.med.name)}
          ${r.entry ? `<span class="muted">— taken at ${formatClock(new Date(r.entry.taken_at))}</span>` : ''}
          ${warningsHtml(r.entry)}</span>
          ${r.entry ? deleteBtn(r.entry) : ''}</div>`,
      });
    }
    for (const e of extra) {
      const t = new Date(e.taken_at);
      rows.push({
        sort: t.getHours() * 60 + t.getMinutes(),
        html: `<div class="entry"><span class="t">${formatClock(t)}</span>
          <span class="w">✓ ${esc(e.name)} ${e.amount ? `<span class="muted">(${esc(e.amount)})</span>` : ''}
          ${e.prescribed ? '' : '<span class="tag red">not prescribed</span>'}
          ${warningsHtml(e)}</span>${deleteBtn(e)}</div>`,
      });
    }
    rows.sort((a, b) => a.sort - b.sort);
    const missed = report.filter((r) => r.status === 'missed').length;
    const title = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    html += `<div class="card day"><h3>${title} ${missed ? `<span class="tag red">${missed} missed</span>` : ''}</h3>${rows.map((r) => r.html).join('')}</div>`;
  }
  if (!state.log.length) html += `<p class="muted">Nothing has been logged yet.</p>`;
  html += `<p class="hint">"Missed" uses today's schedule, so it may be off for days before a schedule change.</p>`;
  return html;
}

function warningsHtml(entry) {
  if (!entry || !entry.warnings || !entry.warnings.length) return '';
  return `<div class="warns">⚠ Took it after warning: ${entry.warnings.map(esc).join('; ')}</div>`;
}
function deleteBtn(entry) {
  return `<button class="abtn quiet" data-action="delete-entry" data-id="${esc(entry.id)}" title="Remove this entry">Remove</button>`;
}

function renderSettings() {
  const s = state.settings;
  let zones = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [s.timezone];
  }
  if (!zones.includes(s.timezone)) zones.unshift(s.timezone);
  const base = location.href.replace(/admin\.html.*$/, '');
  const link = s.device_code ? `${base}?code=${s.device_code}` : '';
  const pretty = (s.device_code || '').replace(/(.{4})(?=.)/g, '$1-');

  return `
    <h2>Settings</h2>
    <form id="settings-form" class="card">
      <div class="form-grid">
        <div><label for="s-gloria">Her name</label><input type="text" id="s-gloria" name="gloria_name" value="${esc(s.gloria_name)}"></div>
        <div><label for="s-tz">Her time zone</label><select id="s-tz" name="timezone">${zones
          .map((z) => `<option ${z === s.timezone ? 'selected' : ''}>${esc(z)}</option>`)
          .join('')}</select></div>
        <div><label for="s-cg">Caregiver name</label><input type="text" id="s-cg" name="caregiver_name" value="${esc(s.caregiver_name)}"></div>
        <div><label for="s-phone">Caregiver phone</label><input type="tel" id="s-phone" name="caregiver_phone" value="${esc(s.caregiver_phone)}" placeholder="Shows a 'Call' button on warnings"></div>
      </div>
      <button class="abtn primary" style="margin-top:14px">Save settings</button>
    </form>

    <h2>Set up ${esc(gloria())}'s iPhone</h2>
    <div class="card">
      ${store.isDemo
        ? `<p>In demo mode there is nothing to set up. Once the app is online (README.md), a setup code appears here.</p>
           <button class="abtn danger" data-action="reset-demo">Reset demo data</button>`
        : s.device_code
          ? `<p>On ${esc(gloria())}'s iPhone, open this link in <b>Safari</b>:</p>
             <p><a href="${esc(link)}" style="word-break:break-all">${esc(link)}</a>
             <button class="abtn" data-action="copy-link" data-link="${esc(link)}">Copy link</button></p>
             <p>Or open <b>${esc(base)}</b> and type this code: <span class="code">${esc(pretty)}</span></p>
             <ol>
               <li>In Safari, tap Share ⬆︎, then <b>Add to Home Screen</b>.</li>
               <li>Open <b>My Pills</b> from the Home Screen. If it asks for the code, type it in.</li>
               <li>Tap <b>Turn on reminders</b> and then <b>Allow</b>.</li>
               <li>On the Apple Watch app on the iPhone, make sure Notifications → My Pills mirrors the iPhone.</li>
             </ol>
             <button class="abtn danger" data-action="new-code">Make a new code</button>
             <div class="hint">A new code signs out any phone using the old one.</div>`
          : `<p>Create a setup code to connect ${esc(gloria())}'s phone.</p>
             <button class="abtn primary" data-action="new-code">Create setup code</button>`}
    </div>`;
}

function bindSettings() {
  document.getElementById('settings-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      state.settings = await store.saveSettings(Object.fromEntries(fd.entries()));
      toast('Settings saved');
      document.getElementById('title').textContent = `${gloria()}'s medicine schedule`;
      render();
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
  });
}

// ------------------------------------------------------------------ medicine form
function timeRow(value = '') {
  return `<span class="t"><input type="time" value="${esc(value)}" required>
    <button type="button" class="abtn quiet" data-action="remove-time" aria-label="Remove time">✕</button></span>`;
}

function openMed(med) {
  state.editing = med || null;
  const m = med || { name: '', strength: '', amount: '1 tablet', times: ['08:00'], as_needed: false, active: true };
  document.getElementById('med-dialog-title').textContent = med ? `Edit ${med.name}` : 'Add a medicine';
  f.name.value = m.name || '';
  f.strength.value = m.strength || '';
  f.amount.value = m.amount || '';
  f.as_needed.checked = !!m.as_needed;
  f.max_per_day.value = m.max_per_day || '';
  f.purpose.value = m.purpose || '';
  f.appearance.value = m.appearance || '';
  f.instructions.value = m.instructions || '';
  f.active.checked = m.active !== false;
  const times = (m.times || []).slice().sort();
  document.getElementById('f-times').innerHTML =
    (times.length ? times : ['08:00']).map(timeRow).join('') +
    `<button type="button" class="abtn" data-action="add-time">＋ Add a time</button>`;
  document.getElementById('med-delete').hidden = !med;
  updateFormBits();
  dialog.showModal();
  if (!med) f.name.focus();
}

function updateFormBits() {
  const asNeeded = f.as_needed.checked;
  document.getElementById('times-wrap').hidden = asNeeded;
  document.getElementById('max-wrap').hidden = !asNeeded;
  document.querySelectorAll('#f-times input[type=time]').forEach((i) => (i.required = !asNeeded));
  const hint = document.getElementById('f-name-hint');
  const name = f.name.value.trim();
  if (!name) {
    hint.textContent = '';
    return;
  }
  const d = describe(name);
  hint.className = 'hint ' + (d ? 'ok' : 'bad');
  hint.textContent = d
    ? `✓ Safety check recognises: ${d.text}${d.guessed ? ` (matched “${d.guessed}” — check the spelling)` : ''}`
    : 'The safety check doesn\'t recognise this name. Try the generic name, or it will still be saved but not checked.';
}

form.addEventListener('input', updateFormBits);
document.getElementById('med-cancel').addEventListener('click', () => dialog.close());
document.getElementById('med-delete').addEventListener('click', async () => {
  if (!state.editing) return;
  if (!confirm(`Delete ${state.editing.name}? To keep its history, use "Stop" instead.`)) return;
  await store.deleteMedication(state.editing.id);
  state.meds = state.meds.filter((m) => m.id !== state.editing.id);
  dialog.close();
  toast('Deleted');
  render();
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const asNeeded = f.as_needed.checked;
  const times = asNeeded
    ? []
    : [...new Set([...document.querySelectorAll('#f-times input[type=time]')].map((i) => i.value).filter(Boolean))].sort();
  if (!asNeeded && !times.length) {
    alert('Add at least one time, or tick "Only when needed".');
    return;
  }
  const med = {
    ...(state.editing || {}),
    name: f.name.value.trim(),
    strength: f.strength.value.trim(),
    amount: f.amount.value.trim(),
    times,
    as_needed: asNeeded,
    max_per_day: asNeeded && f.max_per_day.value ? Number(f.max_per_day.value) : null,
    purpose: f.purpose.value.trim(),
    appearance: f.appearance.value.trim(),
    instructions: f.instructions.value.trim(),
    active: f.active.checked,
  };
  if (!state.editing) med.sort = state.meds.length;
  try {
    const saved = await store.saveMedication(med);
    const i = state.meds.findIndex((m) => m.id === saved.id);
    if (i >= 0) state.meds[i] = saved;
    else state.meds.push(saved);
    dialog.close();
    toast(`Saved ${saved.name}`);
    render();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
});

// ------------------------------------------------------------------ clicks
document.addEventListener('click', async (ev) => {
  const tab = ev.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    return render();
  }
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  switch (action) {
    case 'admin-rec': return adminRecStart(state.appts.find((a) => a.id === id));
    case 'admin-rec-done': return adminRecDone();
    case 'admin-rec-cancel': return adminRecCancel();
    case 'add-appt': return openAppt(null);
    case 'edit-appt': return openAppt(state.appts.find((a) => a.id === id));
    case 'delete-note': {
      const appt = state.appts.find((a) => a.id === el.dataset.appt);
      const note = appt?.audio.find((n) => n.id === id);
      const whose = note?.added_by === 'caregiver' ? 'your' : `${gloria()}'s`;
      if (!note || !confirm(`Delete ${whose} audio note from ${noteStamp(note.created_at)}? This can't be undone.`)) return;
      try {
        await store.deleteAudioNote(note);
        appt.audio = appt.audio.filter((n) => n.id !== id);
        toast('Audio note deleted');
      } catch (err) {
        alert('Could not delete: ' + err.message);
      }
      return render();
    }
    case 'add-med': return openMed(null);
    case 'edit-med': return openMed(state.meds.find((m) => m.id === id));
    case 'toggle-med': {
      const med = state.meds.find((m) => m.id === id);
      const saved = await store.saveMedication({ ...med, active: med.active === false });
      Object.assign(med, saved);
      toast(saved.active ? `Restarted ${med.name}` : `Stopped ${med.name}`);
      return render();
    }
    case 'add-time':
      el.insertAdjacentHTML('beforebegin', timeRow(''));
      return;
    case 'remove-time':
      el.closest('.t').remove();
      return;
    case 'delete-entry': {
      const entry = state.log.find((e) => e.id === id);
      if (!confirm(`Remove "${entry.name}" from the log? Do this only if it was logged by mistake.`)) return;
      await store.deleteLogEntry(id);
      state.log = state.log.filter((e) => e.id !== id);
      return render();
    }
    case 'new-code': {
      if (state.settings.device_code && !confirm('Make a new code? The phone will need the new code to keep working.')) return;
      state.settings = await store.saveSettings({ device_code: store.newDeviceCode() });
      return render();
    }
    case 'copy-link':
      await navigator.clipboard.writeText(el.dataset.link);
      return toast('Link copied');
    case 'reset-demo':
      if (!confirm('Put the example medicines back and clear the history?')) return;
      store.resetDemo();
      return start();
    case 'sign-out':
      await store.adminSignOut();
      return start();
  }
});

start();
