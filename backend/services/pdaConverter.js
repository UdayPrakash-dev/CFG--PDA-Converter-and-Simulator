/**
 * services/pdaConverter.js
 *
 * Implements the STANDARD CFG → PDA construction.
 *
 * The resulting PDA accepts by FINAL STATE.
 * It has exactly three states: q_start, q_loop, q_accept.
 *
 * Construction rules:
 *   1. δ(q_start, ε, Z)  → (q_loop,   [S, Z])   push start symbol on Z
 *   2. δ(q_loop,  ε, A)  → (q_loop,   α)         for each production A → α
 *   3. δ(q_loop,  a, a)  → (q_loop,   [])         for each terminal a
 *   4. δ(q_loop,  ε, Z)  → (q_accept, [Z])        accept when only Z remains
 *
 * Stack convention:
 *   stack array is bottom→top  (index 0 = bottom, last index = top).
 *   pushStack in a transition descriptor is TOP→BOTTOM order, so the
 *   simulator reverses it before pushing onto the stack array.
 *
 * Example — production S → aSb:
 *   pushStack = ['a', 'S', 'b']
 *   Simulator pushes 'b', 'S', 'a'  → top of stack becomes 'a'  ✓
 */

'use strict';

const { isVariable } = require('./cfgParser');

/**
 * Convert a parsed CFG to a PDA descriptor object.
 *
 * Defensively coerces variables/terminals to arrays so the function works
 * whether the caller passes Sets, Arrays, or any other iterable.
 *
 * @param {{ start: string, productions: Object, variables: string[]|Set, terminals: string[]|Set }} cfg
 * @returns {Object}  PDA descriptor
 */
function convert(cfg) {
  const { start, productions } = cfg;

  // ── Defensive coercion ─────────────────────────────────────────────────────
  // cfg.variables and cfg.terminals should be plain arrays (see cfgParser.js),
  // but we coerce here too so this function is robust against any caller.
  const variables = Array.isArray(cfg.variables)
    ? cfg.variables
    : (cfg.variables instanceof Set ? [...cfg.variables] : Object.keys(productions));

  const terminals = Array.isArray(cfg.terminals)
    ? cfg.terminals
    : (cfg.terminals instanceof Set ? [...cfg.terminals] : []);

  const transitions = [];

  // ── Rule 1: Initialisation ──────────────────────────────────────────────────
  // δ(q_start, ε, Z) → (q_loop, [S, Z])
  // pushStack is top-first: S will end up on top of Z.
  transitions.push({
    id:          't_init',
    from:        'q_start',
    input:       'ε',
    stackTop:    'Z',
    to:          'q_loop',
    pushStack:   [start, 'Z'],
    description: `Initialise stack: push ${start} onto Z`,
  });

  // ── Rule 2: Variable expansion ──────────────────────────────────────────────
  // For each production A → α: δ(q_loop, ε, A) → (q_loop, α)
  // ε-production (α = '') means pop A and push nothing → pushStack = []
  let ruleIdx = 0;
  for (const [variable, alternatives] of Object.entries(productions)) {
    for (const production of alternatives) {
      // Each character in the production string is one grammar symbol
      // (variables are single uppercase letters).
      const symbols = production === '' ? [] : production.split('');

      transitions.push({
        id:          `t_expand_${ruleIdx++}`,
        from:        'q_loop',
        input:       'ε',
        stackTop:    variable,
        to:          'q_loop',
        pushStack:   symbols,  // top-first: leftmost symbol goes on top
        description: production === ''
          ? `Expand ${variable} → ε (pop ${variable})`
          : `Expand ${variable} → ${production}`,
      });
    }
  }

  // ── Rule 3: Terminal matching ───────────────────────────────────────────────
  // For each terminal a: δ(q_loop, a, a) → (q_loop, [])
  for (const terminal of terminals) {
    // Extra guard: skip anything that looks like a variable or is empty
    if (!terminal || isVariable(terminal)) continue;

    transitions.push({
      id:          `t_match_${terminal}`,
      from:        'q_loop',
      input:       terminal,
      stackTop:    terminal,
      to:          'q_loop',
      pushStack:   [],  // consume input char and pop stack symbol
      description: `Match terminal '${terminal}'`,
    });
  }

  // ── Rule 4: Accept ──────────────────────────────────────────────────────────
  // δ(q_loop, ε, Z) → (q_accept, Z)
  transitions.push({
    id:          't_accept',
    from:        'q_loop',
    input:       'ε',
    stackTop:    'Z',
    to:          'q_accept',
    pushStack:   ['Z'],  // leave Z on stack (cleaner than empty-stack acceptance)
    description: 'Accepting: only stack-bottom marker Z remains',
  });

  // ── Stack alphabet ────────────────────────────────────────────────────────
  const stackAlphabetSet = new Set(['Z', ...variables, ...terminals]);

  return {
    states:        ['q_start', 'q_loop', 'q_accept'],
    inputAlphabet: [...terminals].sort(),
    stackAlphabet: [...stackAlphabetSet],
    startState:    'q_start',
    startStack:    'Z',
    acceptState:   'q_accept',
    transitions,
  };
}

module.exports = { convert };
