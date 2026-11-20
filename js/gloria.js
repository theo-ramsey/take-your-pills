// Gloria's screen: what to take now, add something else, warnings, and today's list.
import { VAPID_PUBLIC_KEY } from './config.js';
import { isDemo, deviceCode, loadForGloria, tryDeviceCode, logDoses, savePushSubscription, uuid } from './store.js';
import { dueNow, nextUp, dayReport, dateKey, entriesOn, formatTime, formatClock } from './schedule.js';
import { itemFromMed, itemFromText, checkBasket } from './checks.js';
import { suggest } from './drugs.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

const state = {
  view: 'loading',          // loading | setup | home | add | done | error
  settings: {},
  meds: [],
  log: [],
  offline: false,
  extras: [],               // things she added with "Take something else"
  unchecked: new Set(),     // due medicines she un-ticked
  justTaken: [],
  modalOpen: false,
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const caregiver = () => state.settings.caregiver_name || 'Bonnie';

// ------------------------------------------------------------------ data
async function load() {
  const params = new URLSearchParams(location.search);
  if (params.get('code')) {
    deviceCode.set(params.get('code'));
    history.replaceState(null, '', location.pathname);
  }
  if (!isDemo && !deviceCode.get()) {
    state.view = 'setup';
    return render();
  }
  try {
    const data = await loadForGloria();
    state.settings = data.settings || {};
    state.meds = data.medications || [];
    state.log = data.log || [];
    state.offline = data.offline;
    if (state.view === 'loading' || state.view === 'setup' || state.view === 'error') state.view = 'home';
  } catch (err) {
    if (err.badCode) {
      deviceCode.clear();
      state.view = 'setup';
      state.setupError = 'That setup code no longer works. Ask ' + caregiver() + ' for the new one.';
    } else {
      state.view = 'error';
      state.error = err.message;
    }
  }
  render();
  if (!isDemo && 'Notification' in window && Notification.permission === 'granted') subscribeForPush(false);
}

// ------------------------------------------------------------------ helpers
function medLine(med) {
  return [med.strength, med.amount].filter(Boolean).join(' · ');
}

function dueList(now = new Date()) {
  return dueNow(state.meds, state.log, now).map((d) => ({ key: `due:${d.med.id}:${d.time}`, med: d.med, time: d.time }));
}

function basketItems(now = new Date()) {
  const due = dueList(now)
    .filter((d) => !state.unchecked.has(d.key))
    .map((d) => ({ ...itemFromMed(d.med, state.log, now), dueKey: d.key }));
  const extras = state.extras.map((e) => (e.med ? { ...itemFromMed(e.med, state.log, now, e.amount), key: e.key } : e));
  return [...due, ...extras];
}

function header() {
  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = state.settings.gloria_name || '';
  document.getElementById('greeting').textContent = name ? `${part}, ${name}` : part;
  document.getElementById('now').textContent =
    now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' + formatClock(now);
}

// ------------------------------------------------------------------ views
function render() {
  header();
  if (state.view === 'setup') return renderSetup();
  if (state.view === 'error') {
    app.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${esc(state.error)}</p>
      <button class="btn" data-action="reload">Try again</button></div>`;
    return;
  }
  if (state.view === 'add') return renderAdd();
  if (state.view === 'done') return renderDone();
  if (state.view === 'home') return renderHome();
}

function renderSetup() {
  app.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Welcome!</h2>
      <p>Type in the setup code from ${esc(caregiver())}. You only need to do this once.</p>
      ${state.setupError ? `<p class="tag red" style="display:block;padding:8px 12px;border-radius:10px">${esc(state.setupError)}</p>` : ''}
      <label class="field" for="code">Setup code</label>
      <input class="big" id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM">
      <button class="btn" data-action="setup">Continue</button>
    </div>`;
}

function renderHome() {
  const now = new Date();
  const due = dueList(now);
  const extras = state.extras;
  const selectedCount = due.filter((d) => !state.unchecked.has(d.key)).length + extras.length;
  let html = '';

  if (isDemo) {
    html += `<div class="banner">Demo mode — examples only, saved on this device. <a href="admin.html">Open ${esc(caregiver())}'s page</a> to change the schedule.</div>`;
  }
  if (state.offline) {
    html += `<div class="banner warn">No internet right now. What you take will be saved and sent later.</div>`;
  }

  if (due.length || extras.length) {
    html += `<h2 class="section">Time to take</h2>`;
    for (const d of due) {
      const off = state.unchecked.has(d.key);
      html += `
        <button class="pill ${off ? 'off' : ''}" data-action="toggle" data-key="${esc(d.key)}" aria-pressed="${!off}">
          <span class="tick" aria-hidden="true">✓</span>
          <span class="info">
            <span class="name">${esc(d.med.name)}</span>
            <span class="amount">${esc(medLine(d.med))}</span>
            <span class="detail"><span class="tag">${formatTime(d.time)}</span> ${esc(d.med.purpose || "")}</span>
            ${d.med.appearance ? `<span class="detail">${esc(d.med.appearance)}</span>` : ''}
            ${d.med.instructions ? `<span class="note">${esc(d.med.instructions)}</span>` : ''}
          </span>
        </button>`;
    }
    for (const e of extras) {
      const sub = e.med ? medLine(e.med) : e.amount;
      html += `
        <div class="pill">
          <span class="tick" aria-hidden="true">✓</span>
          <span class="info">
            <span class="name">${esc(e.name)}</span>
            ${sub ? `<span class="amount">${esc(sub)}</span>` : ''}
            <span class="detail">${e.prescribed ? '<span class="tag green">On your list</span>' : '<span class="tag red">Not prescribed</span>'}</span>
            <button class="link-btn" data-action="remove-extra" data-key="${esc(e.key)}">Remove</button>
          </span>
        </div>`;
    }
    html += `<button class="btn" data-action="take" ${selectedCount ? '' : 'disabled'}>✓ I'm taking ${selectedCount === 1 ? 'this' : 'these'} now</button>`;
    if (due.length > 1) html += `<p class="detail" style="color:var(--muted);font-size:18px;margin:0 4px">Tap a medicine to leave it out.</p>`;
  } else {
    const next = nextUp(state.meds, state.log, now);
    html += `<div class="card allset">
      <div class="big" aria-hidden="true">😊</div>
      <h3>You're all caught up</h3>
      ${next ? `<p>Next medicine: <strong>${next.tomorrow ? 'tomorrow at ' : ''}${formatTime(next.time)}</strong></p>
                <p>${esc(next.meds.map((m) => m.name).join(', '))}</p>` : '<p>No medicines are scheduled.</p>'}
    </div>`;
  }

  html += `<button class="btn secondary" data-action="add">＋ Take something else</button>`;
  html += renderReminderCard();
  html += renderToday(now);
  html += `<p class="footer-link"><a href="admin.html">For ${esc(caregiver())}: change the schedule</a></p>`;
  app.innerHTML = html;
}

function renderToday(now) {
  const key = dateKey(now);
  const rows = [];
  for (const e of entriesOn(state.log, key)) {
    rows.push({
      sort: new Date(e.taken_at).getTime(),
      html: `<li><span class="when">${formatClock(new Date(e.taken_at))}</span>
        <span class="what">✓ ${esc(e.name)}${e.amount ? ` <span style="color:var(--muted)">(${esc(e.amount)})</span>` : ''}
        ${e.prescribed ? '' : ' <span class="tag red">not prescribed</span>'}</span></li>`,
    });
  }
  for (const r of dayReport(state.meds, state.log, key, now)) {
    if (r.status !== 'missed') continue;
    const [h, m] = r.time.split(':').map(Number);
    rows.push({
      sort: new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime(),
      html: `<li><span class="when">${formatTime(r.time)}</span><span class="what missed">✗ Missed: ${esc(r.med.name)}</span></li>`,
    });
  }
  if (!rows.length) return `<h2 class="section">Today</h2><div class="card"><p style="margin:0;color:var(--muted)">Nothing taken yet today.</p></div>`;
  rows.sort((a, b) => a.sort - b.sort);
  return `<h2 class="section">Today</h2><div class="card"><ul class="today">${rows.map((r) => r.html).join('')}</ul></div>`;
}

function renderReminderCard() {
  if (isDemo || !('serviceWorker' in navigator)) return '';
  if (isIOS && !isStandalone()) {
    return `<div class="card" style="border-color:var(--blue)">
      <b>To get reminders on this iPhone and Apple Watch:</b>
      <ol style="margin:8px 0 0;padding-left:26px;font-size:20px">
        <li>Tap the Share button <span aria-hidden="true">⬆︎</span> at the bottom of Safari.</li>
        <li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open <b>My Pills</b> from the Home Screen.</li>
      </ol></div>`;
  }
  if (!('PushManager' in window) || !('Notification' in window) || !VAPID_PUBLIC_KEY) return '';
  if (Notification.permission === 'default') {
    return `<button class="btn blue" data-action="notify">🔔 Turn on reminders</button>`;
  }
  if (Notification.permission === 'denied') {
    return `<div class="banner warn">Reminders are turned off. To turn them on: Settings → Notifications → My Pills → Allow Notifications.</div>`;
  }
  return '';
}

function renderAdd() {
  const now = new Date();
  const dueIds = new Set(dueList(now).map((d) => d.med.id));
  const addedIds = new Set(state.extras.filter((e) => e.med).map((e) => e.med.id));
  const mine = state.meds
    .filter((m) => m.active !== false && !dueIds.has(m.id) && !addedIds.has(m.id))
    .sort((a, b) => Number(!!b.as_needed) - Number(!!a.as_needed));
  app.innerHTML = `
    <button class="link-btn" data-action="home" style="font-size:22px">‹ Back</button>
    <h2 class="section" style="margin-top:6px">What are you taking?</h2>
    ${mine.length ? `<p style="margin:0 0 10px;color:var(--muted)">Your medicines:</p>` : ''}
    ${mine
      .map(
        (m) => `<button class="choice" data-action="add-med" data-id="${esc(m.id)}">
          <b>${esc(m.name)}</b> ${esc(medLine(m))}
          <small>${m.as_needed ? 'When needed' : 'Usually at ' + (m.times || []).map(formatTime).join(', ')}${m.purpose ? ' · ' + esc(m.purpose) : ''}</small>
        </button>`
      )
      .join('')}
    <h2 class="section">Something else</h2>
    <div class="card">
      <label class="field" for="other-name" style="margin-top:0">Name of the medicine</label>
      <input class="big" id="other-name" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="e.g. Advil">
      <div class="suggestions" id="suggestions"></div>
      <label class="field" for="other-amount">How much? (optional)</label>
      <input class="big" id="other-amount" autocomplete="off" placeholder="e.g. 2 pills">
      <button class="btn" data-action="add-other">Add</button>
    </div>`;
}

function renderDone() {
  const items = state.justTaken;
  app.innerHTML = `
    <div class="done">
      <div class="check" aria-hidden="true">✓</div>
      <h2>Done!</h2>
      <p style="color:var(--muted);margin:0">Saved at ${formatClock(new Date())}</p>
      <ul>${items.map((i) => `<li>${esc(i.name)}${i.amount ? ` — ${esc(i.amount)}` : ''}</li>`).join('')}</ul>
      <button class="btn" data-action="home">OK</button>
    </div>`;
  clearTimeout(state.doneTimer);
  state.doneTimer = setTimeout(() => {
    if (state.view === 'done') go('home');
  }, 20000);
}

// ------------------------------------------------------------------ warning pop-up
function showWarnings(items, warnings) {
  state.modalOpen = true;
  const byItem = new Map();
  for (const w of warnings) {
    if (!byItem.has(w.itemKey)) byItem.set(w.itemKey, []);
    byItem.get(w.itemKey).push(w);
  }
  const hasDanger = warnings.some((w) => w.level === 'danger');
  const phone = (state.settings.caregiver_phone || '').replace(/[^\d+]/g, '');
  const blocks = items
    .filter((i) => byItem.has(i.key))
    .map((i) => {
      const ws = byItem.get(i.key);
      const danger = ws.some((w) => w.level === 'danger');
      return `<div class="warn-item ${danger ? 'danger' : ''}">
        <h3>${danger ? '⛔' : '⚠️'} ${esc(i.name)}</h3>
        ${ws.map((w) => `<div class="warning ${w.level}"><div class="wt">${esc(w.title)}</div><p>${esc(w.message)}</p></div>`).join('')}
        <button class="btn small ${danger ? 'red' : ''}" data-action="skip-item" data-key="${esc(i.key)}">Don't take ${esc(i.name)}</button>
      </div>`;
    })
    .join('');

  modalRoot.innerHTML = `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="warn-title">
      <div class="sheet">
        <h2 id="warn-title">${hasDanger ? '⛔ Stop and read' : '⚠️ Please read first'}</h2>
        <p class="lead">Before you take ${items.length === 1 ? 'this' : 'these'}:</p>
        ${blocks}
        ${phone ? `<a class="btn blue" href="tel:${esc(phone)}" style="text-align:center;text-decoration:none">📞 Call ${esc(caregiver())}</a>` : ''}
        <button class="btn secondary" data-action="close-modal">Go back</button>
        <button class="btn secondary small" data-action="take-anyway" style="border-color:${hasDanger ? 'var(--red)' : '#b9b3a6'}">
          I understand. Take ${items.length === 1 ? 'it' : 'all ' + items.length} anyway
        </button>
      </div>
    </div>`;
  modalRoot.querySelector('.sheet').scrollTop = 0;
  state.pending = { items, warnings };
}

function closeModal() {
  modalRoot.innerHTML = '';
  state.modalOpen = false;
  state.pending = null;
}

// ------------------------------------------------------------------ actions
function go(view) {
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

async function take(skipChecks = false) {
  const now = new Date();
  const items = basketItems(now);
  if (!items.length) return;
  const warnings = checkBasket({ items, meds: state.meds, log: state.log, now });
  if (warnings.length && !skipChecks) return showWarnings(items, warnings);

  const entries = items.map((i) => ({
    id: uuid(),
    taken_at: now.toISOString(),
    local_date: dateKey(now),
    medication_id: i.med?.id ?? null,
    name: i.name,
    amount: i.med ? [i.med.strength, i.amount].filter(Boolean).join(' · ') : i.amount || '',
    prescribed: i.prescribed,
    scheduled_for: i.plan?.slot ?? null,
    warnings: warnings.filter((w) => w.itemKey === i.key).map((w) => w.title),
  }));
  state.log.push(...entries);
  state.justTaken = entries;
  state.extras = [];
  state.unchecked.clear();
  closeModal();
  go('done');
  try {
    await logDoses(entries);
  } catch {
    /* kept in the outbox; will retry */
  }
}

function skipItem(key) {
  const item = state.pending?.items.find((i) => i.key === key);
  if (!item) return;
  if (item.dueKey) state.unchecked.add(item.dueKey);
  state.extras = state.extras.filter((e) => e.key !== key);
  closeModal();
  const items = basketItems();
  const warnings = checkBasket({ items, meds: state.meds, log: state.log });
  if (items.length && warnings.length) showWarnings(items, warnings);
  render();
}

function addOther() {
  const name = document.getElementById('other-name').value.trim();
  const amount = document.getElementById('other-amount').value.trim();
  if (!name) {
    document.getElementById('other-name').focus();
    return;
  }
  state.extras.push(itemFromText(name, amount, state.meds, state.log));
  go('home');
}

async function subscribeForPush(interactive) {
  try {
    if (interactive) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return render();
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) });
    }
    await savePushSubscription(sub.toJSON());
    if (interactive) {
      reg.showNotification('Reminders are on', {
        body: "You'll get a message like this when it's time for your medicine.",
        icon: 'icons/icon-192.png',
      });
    }
  } catch (err) {
    if (interactive) alert('Could not turn on reminders: ' + err.message);
  }
  render();
}

function base64ToBytes(b64) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const { action, key, id } = el.dataset;
  switch (action) {
    case 'toggle':
      state.unchecked.has(key) ? state.unchecked.delete(key) : state.unchecked.add(key);
      return render();
    case 'take': return take(false);
    case 'take-anyway': return take(true);
    case 'skip-item': return skipItem(key);
    case 'close-modal': closeModal(); return render();
    case 'add': return go('add');
    case 'home': return go('home');
    case 'remove-extra':
      state.extras = state.extras.filter((e) => e.key !== key);
      return render();
    case 'add-med': {
      const med = state.meds.find((m) => m.id === id);
      if (med) state.extras.push(itemFromMed(med, state.log));
      return go('home');
    }
    case 'add-other': return addOther();
    case 'suggest':
      document.getElementById('other-name').value = el.textContent;
      document.getElementById('suggestions').innerHTML = '';
      document.getElementById('other-amount').focus();
      return;
    case 'notify': return subscribeForPush(true);
    case 'reload': return load();
    case 'setup': {
      const input = document.getElementById('code');
      el.disabled = true;
      el.textContent = 'Checking…';
      try {
        if (await tryDeviceCode(input.value)) {
          deviceCode.set(input.value);
          state.setupError = '';
          state.view = 'loading';
          return load();
        }
        state.setupError = "That code didn't work. Please check it and try again.";
      } catch (err) {
        state.setupError = 'Could not check the code: ' + err.message;
      }
      return render();
    }
  }
});

document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'other-name') return;
  const box = document.getElementById('suggestions');
  box.innerHTML = suggest(ev.target.value)
    .map((s) => `<button type="button" data-action="suggest">${esc(s)}</button>`)
    .join('');
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'other-name' || ev.target.id === 'other-amount') addOther();
  if (ev.target.id === 'code') document.querySelector('[data-action=setup]')?.click();
});

// Keep the clock and "due now" list fresh, and reload when she comes back to the app.
setInterval(() => {
  if (state.view === 'home' && !state.modalOpen && !document.hidden) render();
  else header();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !state.modalOpen && (state.view === 'home' || state.view === 'done')) {
    if (state.view === 'done') state.view = 'home';
    load();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
// Exposed for the automated screen tests.
window.__typ = { state, render };
