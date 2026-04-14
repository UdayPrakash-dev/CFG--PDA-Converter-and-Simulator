/**
 * frontend/scripts/app.js
 *
 * Frontend logic for CFG → PDA Converter & Simulator.
 *
 * The backend URL comes from window.APP_CONFIG.API_BASE (set in config.js).
 * To point at a different backend, only config.js needs to change.
 *
 * Sections:
 *   A. DOM references
 *   B. API helpers        ← uses APP_CONFIG.API_BASE, not hardcoded '/api'
 *   C. Convert flow
 *   D. Simulate flow
 *   E. Trace player
 *   F. Rendering helpers
 *   G. Event wiring
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// A. DOM REFERENCES
// ══════════════════════════════════════════════════════════════════════════════
const grammarInput   = document.getElementById('grammar-input');
const btnConvert     = document.getElementById('btn-convert');
const btnClear       = document.getElementById('btn-clear');
const simInput       = document.getElementById('sim-input');
const btnSimulate    = document.getElementById('btn-simulate');
const simulateArea   = document.getElementById('simulate-area');
const loadingOverlay = document.getElementById('loading-overlay');

// PDA display
const pdaOverview    = document.getElementById('pda-overview');
const pdaSummary     = document.getElementById('pda-summary');
const pdaTransSect   = document.getElementById('pda-transitions-section');
const transTableBody = document.querySelector('#transition-table tbody');

// Simulation
const simulationResult = document.getElementById('simulation-result');
const verdictBanner    = document.getElementById('verdict-banner');
const traceContainer   = document.getElementById('trace-container');
const traceCounter     = document.getElementById('trace-counter');
const btnPrev          = document.getElementById('btn-prev');
const btnNext          = document.getElementById('btn-next');
const btnPlay          = document.getElementById('btn-play');
const stackCells       = document.getElementById('stack-cells');
const sfState          = document.getElementById('sf-state');
const sfInput          = document.getElementById('sf-input');
const sfStack          = document.getElementById('sf-stack');
const sfRule           = document.getElementById('sf-rule');
const sfDesc           = document.getElementById('sf-desc');
const fullTraceList    = document.getElementById('full-trace-list');
const genStrings       = document.getElementById('generated-strings');
const stringChips      = document.getElementById('string-chips');

// ══════════════════════════════════════════════════════════════════════════════
// B. API HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve the API base URL from config.js.
 * Falls back to localhost:4000 if config.js failed to load.
 */
function getApiBase() {
  return (window.APP_CONFIG && window.APP_CONFIG.API_BASE)
    ? window.APP_CONFIG.API_BASE.replace(/\/$/, '') // strip trailing slash
    : 'http://localhost:4000';
}

/**
 * POST to a backend endpoint and return parsed JSON.
 * Throws if the server returns a non-2xx status.
 */
async function apiPost(endpoint, body) {
  const url = `${getApiBase()}/api/${endpoint}`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/** Wraps an async handler with a loading overlay and top-level error alert. */
function withLoading(fn) {
  return async (...args) => {
    loadingOverlay.classList.remove('hidden');
    try {
      await fn(...args);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// C. CONVERT FLOW
// ══════════════════════════════════════════════════════════════════════════════

/** State shared between convert and simulate phases. */
let currentGrammar = '';
let currentPDA     = null;

const handleConvert = withLoading(async () => {
  const grammar = grammarInput.value.trim();
  if (!grammar) { alert('Please enter a grammar first.'); return; }

  const data = await apiPost('convert', { grammar });
  currentGrammar = grammar;
  currentPDA     = data.pda;

  renderPDASummary(data.cfg, data.pda);
  renderTransitionTable(data.pda.transitions);

  pdaOverview.classList.remove('hidden');
  pdaTransSect.classList.remove('hidden');
  simulateArea.classList.remove('hidden');
  simulationResult.classList.add('hidden');
  traceContainer.classList.add('hidden');
  genStrings.classList.add('hidden');

  // Load sample strings in the background (non-blocking)
  fetchGeneratedStrings(grammar);
});

async function fetchGeneratedStrings(grammar) {
  try {
    const data = await apiPost('generate', { grammar, maxLength: 6 });
    renderStringChips(data.strings);
  } catch (_) {
    /* non-critical — silently skip if it fails */
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// D. SIMULATE FLOW
// ══════════════════════════════════════════════════════════════════════════════

let traceSteps = [];
let traceIndex = 0;
let playTimer  = null;

const handleSimulate = withLoading(async () => {
  if (!currentGrammar) { alert('Please convert a grammar first.'); return; }

  // Treat 'ε' typed by the user and blank input both as the empty string
  const rawInput = simInput.value.trim();
  const input    = rawInput === 'ε' ? '' : rawInput;

  const result = await apiPost('simulate', { grammar: currentGrammar, input });

  renderVerdict(result, input);
  simulationResult.classList.remove('hidden');

  if (result.accepted && result.steps.length > 0) {
    traceSteps = result.steps;
    traceIndex = 0;
    stopAutoPlay();
    renderFullTraceList(traceSteps);
    traceContainer.classList.remove('hidden');
    renderTraceStep(traceIndex);
  } else {
    traceContainer.classList.add('hidden');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// E. TRACE PLAYER
// ══════════════════════════════════════════════════════════════════════════════

function renderTraceStep(idx) {
  if (traceSteps.length === 0) return;

  const step  = traceSteps[idx];
  const total = traceSteps.length;

  traceCounter.textContent = `Step ${idx + 1} / ${total}`;
  btnPrev.disabled = idx === 0;
  btnNext.disabled = idx === total - 1;

  sfState.textContent = step.state;
  sfInput.textContent = step.remainingInput;
  sfStack.textContent = step.stackDisplay;
  sfRule.textContent  = step.rule;
  sfDesc.textContent  = step.description;

  renderStackViz(step.stackRaw); // bottom-first array from backend
}

function renderStackViz(stackBottomFirst) {
  stackCells.innerHTML = '';

  if (!stackBottomFirst || stackBottomFirst.length === 0) {
    const cell = document.createElement('div');
    cell.className   = 'stack-cell empty';
    cell.textContent = 'empty';
    stackCells.appendChild(cell);
    return;
  }

  // Render top-first so the top of the stack appears at the top of the column
  const topFirst = [...stackBottomFirst].reverse();
  topFirst.forEach((sym, i) => {
    const cell = document.createElement('div');
    cell.className = 'stack-cell' +
      (i === 0                  ? ' top'    : '') +
      (i === topFirst.length - 1 ? ' bottom' : '');
    cell.textContent = sym;
    stackCells.appendChild(cell);
  });
}

function stopAutoPlay() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
    btnPlay.textContent = '▶ Auto-play';
  }
}

function toggleAutoPlay() {
  if (playTimer) { stopAutoPlay(); return; }

  btnPlay.textContent = '⏸ Pause';
  playTimer = setInterval(() => {
    if (traceIndex < traceSteps.length - 1) {
      traceIndex++;
      renderTraceStep(traceIndex);
    } else {
      stopAutoPlay();
    }
  }, 800);
}

// ══════════════════════════════════════════════════════════════════════════════
// F. RENDERING HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function renderPDASummary(cfg, pda) {
  pdaSummary.innerHTML = '';

  const cards = [
    ['States',         pda.states.join(', ')],
    ['Start State',    pda.startState],
    ['Accept State',   pda.acceptState],
    ['Start Stack',    pda.startStack],
    ['Input Alphabet', pda.inputAlphabet.join(', ') || '∅'],
    ['Stack Alphabet', pda.stackAlphabet.join(', ')],
    ['Variables',      [...cfg.variables].join(', ')],
    ['Transitions',    pda.transitions.length + ' rules'],
  ];

  for (const [label, value] of cards) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML =
      `<div class="card-label">${label}</div>` +
      `<div class="card-value">${esc(value)}</div>`;
    pdaSummary.appendChild(card);
  }
}

function renderTransitionTable(transitions) {
  transTableBody.innerHTML = '';

  for (const t of transitions) {
    const tr        = document.createElement('tr');
    tr.className    = classForTransition(t.id);
    const pushLabel = t.pushStack.length > 0 ? t.pushStack.join(' ') : 'ε';

    tr.innerHTML = `
      <td>${esc(t.from)}</td>
      <td>${esc(t.input)}</td>
      <td>${esc(t.stackTop)}</td>
      <td>${esc(t.to)}</td>
      <td>${esc(pushLabel)}</td>
      <td class="td-rule">${esc(t.description)}</td>
    `;
    transTableBody.appendChild(tr);
  }
}

function classForTransition(id) {
  if (id === 't_init')           return 'tr-init';
  if (id.startsWith('t_expand')) return 'tr-expand';
  if (id.startsWith('t_match'))  return 'tr-match';
  if (id === 't_accept')         return 'tr-accept';
  return '';
}

function renderVerdict(result, input) {
  const display       = input === '' ? 'ε' : `"${input}"`;
  verdictBanner.className   = result.accepted ? 'accept' : 'reject';
  verdictBanner.textContent = result.accepted
    ? `✓ ACCEPTED — ${display} is in the language.`
    : `✗ REJECTED — ${display} is NOT in the language.`;

  const stats = document.createElement('div');
  stats.style.cssText  = 'font-size:0.75rem;font-weight:400;margin-top:4px;opacity:0.8;';
  stats.textContent    = `(${result.allPaths} configurations explored)`;
  verdictBanner.appendChild(stats);
}

function renderFullTraceList(steps) {
  fullTraceList.innerHTML = '';
  steps.forEach(step => {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="tl-state">${esc(step.state)}</span>` +
      ` · input: <span class="tl-input">${esc(step.remainingInput)}</span>` +
      ` · stack: ${esc(step.stackDisplay)}` +
      ` · <span class="tl-rule">${esc(step.rule)}</span>`;
    fullTraceList.appendChild(li);
  });
}

function renderStringChips(strings) {
  stringChips.innerHTML = '';
  if (!strings || strings.length === 0) return;

  for (const s of strings) {
    const chip       = document.createElement('button');
    chip.className   = 'chip';
    chip.textContent = s;
    chip.title       = `Click to simulate "${s}"`;
    chip.addEventListener('click', () => {
      simInput.value = s === 'ε' ? '' : s;
      handleSimulate();
    });
    stringChips.appendChild(chip);
  }

  genStrings.classList.remove('hidden');
}

/** Minimal HTML escaping — prevents XSS from user-supplied grammar text. */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════════════════════════════════════
// G. EVENT WIRING
// ══════════════════════════════════════════════════════════════════════════════

btnConvert.addEventListener('click', handleConvert);
btnSimulate.addEventListener('click', handleSimulate);

btnClear.addEventListener('click', () => {
  grammarInput.value = '';
  simInput.value     = '';
  currentGrammar     = '';
  currentPDA         = null;
  traceSteps         = [];
  stopAutoPlay();

  [pdaOverview, pdaTransSect, simulateArea, simulationResult,
    traceContainer, genStrings].forEach(el => el.classList.add('hidden'));
});

btnPrev.addEventListener('click', () => {
  stopAutoPlay();
  if (traceIndex > 0) { traceIndex--; renderTraceStep(traceIndex); }
});

btnNext.addEventListener('click', () => {
  stopAutoPlay();
  if (traceIndex < traceSteps.length - 1) { traceIndex++; renderTraceStep(traceIndex); }
});

btnPlay.addEventListener('click', toggleAutoPlay);

simInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSimulate();
});

document.querySelectorAll('.btn-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    grammarInput.value = btn.dataset.grammar;
    handleConvert();
  });
});
