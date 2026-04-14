/**
 * services/cfgParser.js
 *
 * Responsibilities:
 *   1. parse(grammarText) → { start, productions, variables, terminals }
 *   2. generateStrings(cfg, maxLen) → string[]  (BFS derivation)
 *
 * Grammar syntax accepted:
 *   S -> aSb | ε
 *   A -> aA | b
 *
 *   • LHS must be a single uppercase letter (variable / non-terminal).
 *   • RHS alternatives are separated by '|'.
 *   • ε or eps or lambda represents the empty string.
 *   • Whitespace around symbols is stripped.
 *   • The first rule's LHS is treated as the start symbol.
 *
 * IMPORTANT — variables and terminals are plain ARRAYS, not Sets.
 * Sets serialize to {} in JSON, losing all data. If cfg ever passes
 * through JSON.stringify/parse (e.g. logging, caching, accidental
 * res.json round-trip), Sets silently become plain objects and then
 * throw "not iterable" in the converter. Arrays are always safe.
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise epsilon representations to the empty string ''.
 * We cannot use \b word boundaries with the Unicode ε character because \b
 * only applies to ASCII [a-zA-Z0-9_] boundaries.  Use explicit patterns.
 */
function normaliseEpsilon(str) {
  return str
    .replace(/ε/g, '')           // Unicode epsilon
    .replace(/\beps\b/gi, '')    // 'eps' / 'EPS' (ASCII, \b is fine here)
    .replace(/\blambda\b/gi, '') // 'lambda' (ASCII)
    .trim();
}

/** True if a single character is an uppercase letter (variable). */
function isVariable(ch) {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}

// ── parse ─────────────────────────────────────────────────────────────────────

/**
 * Parse a multi-line CFG string into a structured object.
 *
 * @param {string} grammarText
 * @returns {{
 *   start:       string,
 *   productions: Object.<string, string[]>,
 *   variables:   string[],
 *   terminals:   string[]
 * }}
 */
function parse(grammarText) {
  const productions = {}; // { Variable: [alt1, alt2, ...] }
  let start = null;

  const lines = grammarText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  for (const line of lines) {
    // Support both '->' and unicode '→'
    const arrowMatch = line.match(/^([A-Z])\s*(?:->|→)\s*(.+)$/);
    if (!arrowMatch) continue;

    const variable = arrowMatch[1];
    const rhsRaw   = arrowMatch[2];

    if (!start) start = variable;

    // Split on '|', strip whitespace inside each alternative, normalise epsilon
    const alternatives = rhsRaw
      .split('|')
      .map(alt => normaliseEpsilon(alt.replace(/\s+/g, '')));

    if (!productions[variable]) productions[variable] = [];

    for (const alt of alternatives) {
      if (!productions[variable].includes(alt)) {
        productions[variable].push(alt);
      }
    }
  }

  // ── Build variables list (plain array, NOT Set) ───────────────────────────
  // Sets become {} when JSON-serialized, causing downstream "not iterable"
  // errors. Arrays survive serialization and are iterable everywhere.
  const variableArr = Object.keys(productions);          // string[]
  const variableSet = new Set(variableArr);              // local Set for O(1) lookup only

  // ── Build terminals list (plain array, NOT Set) ───────────────────────────
  const terminalSet = new Set();
  for (const alts of Object.values(productions)) {
    for (const alt of alts) {
      for (const ch of alt) {
        // Skip: empty string, stray ε, or any variable
        if (!ch || ch === 'ε' || variableSet.has(ch)) continue;
        terminalSet.add(ch);
      }
    }
  }
  const terminalArr = [...terminalSet].sort();           // string[], sorted

  return {
    start,
    productions,
    variables: variableArr,   // plain string[]
    terminals: terminalArr,   // plain string[]
  };
}

// ── generateStrings ───────────────────────────────────────────────────────────

/**
 * BFS over sentential forms to enumerate terminal strings derived by the CFG.
 * Expands the LEFTMOST variable at each step (canonical leftmost derivation).
 *
 * @param {{ start: string, productions: Object }} cfg
 * @param {number} maxLen  Maximum length of accepted terminal strings
 * @returns {string[]}  Sorted list of accepted strings ('ε' for empty string)
 */
function generateStrings(cfg, maxLen = 6) {
  const { start, productions } = cfg;

  // Build a Set of variable names for O(1) lookup (safe: local use only)
  const variableSet = new Set(Object.keys(productions));

  // Prune: a sentential form longer than this can never yield a string <= maxLen
  const maxFormLen = maxLen + variableSet.size + 2;

  const accepted     = new Set();
  const visitedForms = new Set();
  const queue        = [start];
  visitedForms.add(start);

  const BFS_LIMIT = 50_000;
  let   iterations = 0;

  while (queue.length > 0 && iterations < BFS_LIMIT) {
    iterations++;
    const form = queue.shift();

    // Find leftmost variable
    let varIdx = -1;
    for (let i = 0; i < form.length; i++) {
      if (variableSet.has(form[i])) { varIdx = i; break; }
    }

    if (varIdx === -1) {
      // Pure terminal string
      if (form.length <= maxLen) accepted.add(form);
      continue;
    }

    if (form.length > maxFormLen) continue; // prune

    const variable = form[varIdx];
    for (const production of productions[variable]) {
      const newForm = form.slice(0, varIdx) + production + form.slice(varIdx + 1);
      if (!visitedForms.has(newForm)) {
        visitedForms.add(newForm);
        queue.push(newForm);
      }
    }
  }

  // Sort: shortest first, then lexicographic; '' displayed as 'ε'
  return [...accepted]
    .sort((a, b) => a.length !== b.length ? a.length - b.length : a.localeCompare(b))
    .map(s => s === '' ? 'ε' : s);
}

module.exports = { parse, generateStrings, isVariable };
