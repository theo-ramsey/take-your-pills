// Safety checks run before Gloria logs a dose.
import { identify, classesOf, normalize, RULES } from './drugs.js';
import { planDose, formatTime, formatClock, countLast24h } from './schedule.js';

let counter = 0;
const newKey = () => `item${Date.now().toString(36)}${(counter++).toString(36)}`;

/** A basket item for one of her prescribed medicines. */
export function itemFromMed(med, log, now = new Date(), amount) {
  const { ingredients, known } = identify(med.name);
  return {
    key: newKey(),
    med,
    name: med.name,
    amount: amount || med.amount || '',
    prescribed: true,
    ingredients,
    known,
    plan: planDose(med, log, now),
  };
}

/** Find a prescribed medicine matching what she typed ("Tylenol" matches "Acetaminophen"). */
export function findPrescribed(text, meds) {
  const n = normalize(text);
  if (!n) return null;
  const active = meds.filter((m) => m.active !== false);
  const byName = active.find((m) => normalize(m.name) === n);
  if (byName) return byName;
  const { ingredients } = identify(text);
  if (!ingredients.length) return null;
  const want = [...ingredients].sort().join('|');
  return active.find((m) => [...identify(m.name).ingredients].sort().join('|') === want) || null;
}

/** A basket item for something she typed in. */
export function itemFromText(text, amount, meds, log, now = new Date()) {
  const med = findPrescribed(text, meds);
  if (med) return itemFromMed(med, log, now, amount);
  const { ingredients, known, guessed } = identify(text);
  return { key: newKey(), med: null, name: text.trim(), amount: amount || '', prescribed: false, ingredients, known, guessed };
}

function fill(text, a, b) {
  return text.replaceAll('{A}', a).replaceAll('{B}', b);
}

/** All interaction warnings between two medicines (x and y have .label and .ingredients). */
export function pairWarnings(x, y) {
  const cx = classesOf(x.ingredients);
  const cy = classesOf(y.ingredients);
  const seenGroups = new Set();
  const out = [];
  for (const rule of RULES) {
    if (seenGroups.has(rule.group)) continue;
    let A = null;
    let B = null;
    if (rule.same) {
      if (cx.has(rule.same) && cy.has(rule.same)) [A, B] = [x, y];
    } else if (cx.has(rule.a) && cy.has(rule.b)) {
      [A, B] = [x, y];
    } else if (cy.has(rule.a) && cx.has(rule.b)) {
      [A, B] = [y, x];
    }
    if (!A) continue;
    seenGroups.add(rule.group);
    out.push({ level: rule.level, title: rule.title, message: fill(rule.message, A.label, B.label) });
  }
  // The exact same ingredient twice, when no specific rule already covered it.
  if (!seenGroups.has('duplicate')) {
    const shared = x.ingredients.filter((i) => y.ingredients.includes(i));
    if (shared.length) {
      out.push({
        level: 'caution',
        title: 'Same medicine twice',
        message: `${x.label} and ${y.label} both contain ${shared.join(' and ')}. Taking both doubles the dose.`,
      });
    }
  }
  return out;
}

/**
 * Check what she is about to take.
 * items: basket items (from itemFromMed / itemFromText)
 * meds: all her prescriptions; log: recent log entries
 * Returns [{ level: 'danger'|'caution', title, message, itemKey }], most serious first.
 */
export function checkBasket({ items, meds, log, now = new Date() }) {
  const warnings = [];
  const add = (item, w) => warnings.push({ ...w, itemKey: item.key });

  for (const item of items) {
    if (!item.prescribed) continue;
    const { plan, med } = item;
    if (plan?.alreadyTaken) {
      add(item, {
        level: 'danger',
        title: 'Already taken',
        message: `You already took your ${formatTime(plan.alreadyTaken.scheduled_for)} ${item.name} today, at ${formatClock(new Date(plan.alreadyTaken.taken_at))}. Taking it again would be a double dose.`,
      });
    } else if (plan?.notDue) {
      add(item, {
        level: 'caution',
        title: 'Not time for this one',
        message: `${item.name} is for ${plan.times.map(formatTime).join(' and ')}. It isn't time for it now. If you missed a dose, ask Bonnie or your pharmacist before taking it late.`,
      });
    }
    if (med.as_needed && med.max_per_day) {
      const count = countLast24h(log, med.id, now);
      if (count >= med.max_per_day) {
        add(item, {
          level: 'danger',
          title: 'Too many today',
          message: `You have taken ${item.name} ${count} time${count === 1 ? '' : 's'} in the last 24 hours. The most you should take is ${med.max_per_day}.`,
        });
      }
    }
  }

  // Everything she is taking, or is already taking, that a new medicine could clash with.
  const inBasket = new Set(items.filter((i) => i.med).map((i) => i.med.id));
  const others = [
    ...items.map((i) => ({ key: i.key, label: i.name, ingredients: i.ingredients })),
    ...meds
      .filter((m) => m.active !== false && !inBasket.has(m.id))
      .map((m) => ({ key: `med:${m.id}`, label: m.name, ingredients: identify(m.name).ingredients })),
    ...log
      .filter((e) => !e.prescribed && now.getTime() - new Date(e.taken_at).getTime() < 24 * 3600 * 1000)
      .map((e) => ({
        key: `log:${e.id}`,
        label: `${e.name} (which you took at ${formatClock(new Date(e.taken_at))})`,
        ingredients: identify(e.name).ingredients,
      })),
  ];

  const checkedPairs = new Set();
  for (const item of items) {
    if (item.prescribed) continue;
    if (!item.known) {
      add(item, {
        level: 'caution',
        title: 'Not on your list',
        message: `${item.name} is not one of your prescribed medicines, and this app doesn't recognise it, so it can't check it against your other medicines. Please ask your pharmacist before taking it.`,
      });
      continue;
    }
    add(item, {
      level: 'caution',
      title: 'Not on your list',
      message: `${item.name} is not one of the medicines your doctor prescribed.${item.guessed ? ` (We think you mean ${item.guessed}.)` : ''}`,
    });
    const me = { key: item.key, label: item.name, ingredients: item.ingredients };
    for (const other of others) {
      if (other.key === item.key) continue;
      const pairKey = [item.key, other.key].sort().join('~');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);
      for (const w of pairWarnings(me, other)) add(item, w);
    }
  }

  const rank = { danger: 0, caution: 1 };
  return warnings.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Interactions between her prescribed medicines, for Bonnie to double-check with the doctor. */
export function checkPrescriptions(meds) {
  const active = meds
    .filter((m) => m.active !== false)
    .map((m) => ({ med: m, label: m.name, ...identify(m.name) }));
  const out = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      for (const w of pairWarnings(active[i], active[j])) out.push({ ...w, a: active[i].med, b: active[j].med });
    }
  }
  const unknown = active.filter((a) => !a.known).map((a) => a.med);
  return { warnings: out, unknown };
}
