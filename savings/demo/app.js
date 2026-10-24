/**
 * Demo dashboard for the savings recommendations.
 *
 * This is the reference wiring, not the production dashboard. It shows how
 * the four pieces fit together — recommendations, protected treats, sourced
 * offers and selected actions — against one import from the engine.
 *
 * Everything the student does is kept in localStorage so the demo survives a
 * refresh. Swap the adapter for one that talks to the API and nothing else
 * in this file has to change.
 */

import {
  analyseStatement,
  createTreat,
  createActionStore,
  localStorageAdapter,
  money,
  STATUS,
} from '../engine/index.js';

const TREATS_KEY = 'ledger.savings.treats';

const store = createActionStore(localStorageAdapter());

let statement = null;
let treats = loadTreats();
let result = null;

const el = {
  totals: document.getElementById('totals'),
  recommendations: document.getElementById('recommendations'),
  protectedNote: document.getElementById('protected-note'),
  treats: document.getElementById('treats'),
  suggested: document.getElementById('suggested-treats'),
  actions: document.getElementById('actions'),
  progress: document.getElementById('progress'),
  treatForm: document.getElementById('treat-form'),
  fileInput: document.getElementById('file-input'),
};

/* ---------- persistence for treats ---------- */

function loadTreats() {
  try {
    const raw = localStorage.getItem(TREATS_KEY);
    return raw ? JSON.parse(raw) : defaultTreats();
  } catch {
    return defaultTreats();
  }
}

function saveTreats() {
  try {
    localStorage.setItem(TREATS_KEY, JSON.stringify(treats));
  } catch {
    // Not worth interrupting the student over.
  }
}

/** One treat out of the box, so the guardrail is visible from the first load. */
function defaultTreats() {
  return [
    createTreat({
      id: 'demo-coffee',
      label: 'your Costa run',
      match: { merchants: ['costa'], keywords: ['coffee'] },
      monthlyCap: 25,
      reason: 'The small ritual that makes the morning work.',
    }),
  ];
}

/* ---------- rendering ---------- */

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderTotals() {
  const { totals, potentialMonthlySaving, lifestyleAsk } = result;
  el.totals.innerHTML = `
    <dl class="stat">
      <dt>Spent this month</dt>
      <dd>${money(totals.spend)}</dd>
    </dl>
    <dl class="stat stat-accent">
      <dt>Could be saved</dt>
      <dd>${money(potentialMonthlySaving)}
        <small>${money(lifestyleAsk)} of that asks you to change a habit</small>
      </dd>
    </dl>
    <dl class="stat stat-protect">
      <dt>Protected from advice</dt>
      <dd>${money(totals.protected)}
        <small>${result.protection.entries.length} treat${result.protection.entries.length === 1 ? '' : 's'} ring-fenced</small>
      </dd>
    </dl>
    <dl class="stat">
      <dt>On your list</dt>
      <dd>${money(store.progress().targetMonthlySaving)}
        <small>${store.progress().doneCount} done of ${store.progress().selectedCount}</small>
      </dd>
    </dl>
  `;
}

function renderRecommendations() {
  el.protectedNote.textContent = result.protection.note || '';

  if (!result.recommendations.length) {
    el.recommendations.innerHTML = '<p class="empty">Nothing to suggest this month. That is a good sign.</p>';
    return;
  }

  el.recommendations.innerHTML = result.recommendations.map((rec) => {
    const answered = rec.state.selected || rec.state.dismissed;
    const support = rec.offers.some((o) => o.supportOnly);

    const classes = [
      'card',
      answered ? 'card-answered' : '',
      support ? 'card-support' : '',
      rec.kind === 'encouragement' ? 'card-encouragement' : '',
    ].filter(Boolean).join(' ');

    const saving = rec.estimatedMonthlySavingLabel
      ? `<span class="saving">${rec.estimatedMonthlySavingLabel} / month</span>`
      : '';

    const sources = rec.offers.map((offer) => `
      <a class="source" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">
        <span>${escapeHtml(offer.title)}</span>
        <span class="provider">· ${escapeHtml(offer.provider)}</span>
        ${offer.verify ? '<span class="pill pill-check">check yours</span>' : ''}
      </a>
    `).join('');

    const evidence = rec.evidence.transactionCount
      ? `<p class="evidence">Based on ${rec.evidence.transactionCount} transaction${rec.evidence.transactionCount === 1 ? '' : 's'} totalling ${money(rec.evidence.total)}.</p>`
      : '';

    // Encouragement is not something to accept or decline.
    const buttons = rec.kind === 'encouragement'
      ? ''
      : answered
        ? `<p class="answered-flag">${rec.state.selected ? 'On your list' : 'Not for you — we will leave it out'}</p>`
        : `<div class="card-buttons">
             <button class="primary" data-select="${escapeHtml(rec.id)}">I'll do this</button>
             <button data-dismiss="${escapeHtml(rec.id)}">Not for me</button>
           </div>`;

    return `
      <article class="${classes}">
        <p class="card-opener">${escapeHtml(rec.opener)}</p>
        <div class="card-head">
          <h3>${escapeHtml(rec.title)}</h3>
          ${saving}
        </div>
        <p class="message">${escapeHtml(rec.message)}</p>
        ${sources ? `<div class="sources">${sources}</div>` : ''}
        ${evidence}
        ${buttons}
      </article>
    `;
  }).join('');
}

function renderTreats() {
  el.treats.innerHTML = treats.length
    ? treats.map((treat) => {
      const entry = result.protection.entries.find((e) => e.treatId === treat.id);
      const cap = treat.monthlyCap === null
        ? 'fully protected'
        : `protected up to ${money(treat.monthlyCap)}`;
      const used = entry ? ` · ${money(entry.protectedAmount)} used` : ' · nothing matched yet';
      const over = entry && entry.overflowAmount > 0
        ? ` · ${money(entry.overflowAmount)} above the cap`
        : '';
      return `
        <div class="treat">
          <div class="treat-head">
            <strong>${escapeHtml(treat.label)}</strong>
            <button data-remove-treat="${escapeHtml(treat.id)}" title="Stop protecting this">remove</button>
          </div>
          <div class="treat-meta">${escapeHtml(cap)}${escapeHtml(used)}${escapeHtml(over)}</div>
          ${treat.reason ? `<div class="treat-meta">${escapeHtml(treat.reason)}</div>` : ''}
        </div>
      `;
    }).join('')
    : '<p class="empty">Nothing protected yet. Anything you add here is left out of the advice completely.</p>';

  const available = (result.suggestedTreats || []).filter(
    (s) => !treats.some((t) => t.label === s.label),
  );

  el.suggested.innerHTML = available.length
    ? `<h3>Common ones</h3><div class="chips">${available.map((s) => `
        <button class="chip" data-add-suggested="${escapeHtml(s.id)}">+ ${escapeHtml(s.label)}</button>
      `).join('')}</div>`
    : '';
}

function renderActions() {
  const progress = store.progress();

  el.progress.innerHTML = `
    <div>Chosen: <strong>${progress.selectedCount}</strong> · Done: <strong>${progress.doneCount}</strong></div>
    <div>Target: <strong>${money(progress.targetMonthlySaving)}</strong> a month</div>
    <div>Achieved: <strong>${money(progress.achievedMonthlySaving)}</strong> a month</div>
  `;

  const actions = store.list().filter((a) => a.status !== STATUS.DISMISSED);

  el.actions.innerHTML = actions.length
    ? actions.map((action) => `
        <div class="action ${action.status === STATUS.DONE ? 'action-done' : ''}">
          <div class="action-head">
            <strong>${escapeHtml(action.title)}</strong>
            <span class="target">${money(action.targetMonthlySaving)}</span>
          </div>
          <div class="status-row">
            ${[
              [STATUS.SELECTED, 'To do'],
              [STATUS.IN_PROGRESS, 'Started'],
              [STATUS.DONE, 'Done'],
            ].map(([status, label]) => `
              <button data-status="${status}" data-action-id="${escapeHtml(action.id)}"
                      aria-pressed="${action.status === status}">${label}</button>
            `).join('')}
          </div>
        </div>
      `).join('')
    : '<p class="empty">Nothing chosen yet. Pick anything on the left that sounds doable.</p>';
}

function refresh() {
  result = analyseStatement({
    transactions: statement?.transactions || [],
    treats,
    actionStore: store,
  });
  renderTotals();
  renderRecommendations();
  renderTreats();
  renderActions();
}

/* ---------- interactions ---------- */

function findRecommendation(id) {
  return result.recommendations.find((r) => r.id === id) || null;
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  const { select, dismiss, removeTreat, addSuggested, status, actionId } = target.dataset;

  if (select) {
    const rec = findRecommendation(select);
    if (rec) store.select(rec);
    refresh();
  } else if (dismiss) {
    const rec = findRecommendation(dismiss);
    if (rec) {
      store.dismiss(rec);
      // Turning the same advice down repeatedly is an answer, so we offer to
      // protect it rather than keep raising it.
      for (const suggestion of store.suggestTreatsFromDismissals()) {
        if (treats.some((t) => t.label === suggestion.label)) continue;
        if (confirm(`You have said no to this more than once. Protect ${suggestion.label} so we stop suggesting it?`)) {
          treats = [...treats, createTreat(suggestion)];
          saveTreats();
        }
      }
    }
    refresh();
  } else if (removeTreat) {
    treats = treats.filter((t) => t.id !== removeTreat);
    saveTreats();
    refresh();
  } else if (addSuggested) {
    const suggestion = result.suggestedTreats.find((s) => s.id === addSuggested);
    if (suggestion) {
      treats = [...treats, createTreat(suggestion)];
      saveTreats();
    }
    refresh();
  } else if (status && actionId) {
    store.setStatus(actionId, status);
    refresh();
  }
});

el.treatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = document.getElementById('treat-label').value.trim();
  const matchRaw = document.getElementById('treat-match').value.trim();
  const capRaw = document.getElementById('treat-cap').value.trim();
  if (!label || !matchRaw) return;

  treats = [...treats, createTreat({
    label,
    match: { keywords: matchRaw.split(',').map((s) => s.trim()).filter(Boolean) },
    monthlyCap: capRaw === '' ? null : Number(capRaw),
    reason: 'You told us this one matters.',
  })];
  saveTreats();
  event.target.reset();
  refresh();
});

el.fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    // Accept either the sample's wrapper shape or a bare array.
    statement = Array.isArray(parsed) ? { transactions: parsed } : parsed;
    refresh();
  } catch {
    alert('That file could not be read. It should be JSON with a "transactions" array.');
  }
});

/* ---------- start ---------- */

const response = await fetch('../data/sample-statement.json');
statement = await response.json();
refresh();
