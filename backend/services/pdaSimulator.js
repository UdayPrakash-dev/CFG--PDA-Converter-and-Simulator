/**
 * services/pdaSimulator.js
 *
 * Non-deterministic PDA simulator using BFS.
 *
 * ── Configuration representation ─────────────────────────────────────────────
 *   A configuration is: (state, inputPos, stack)
 *   where stack[0] = bottom, stack[stack.length-1] = top.
 *
 * ── Acceptance ────────────────────────────────────────────────────────────────
 *   A configuration is accepting when:
 *     state === 'q_accept'  AND  inputPos === inputString.length
 *
 * ── Anti-loop protection ──────────────────────────────────────────────────────
 *   We hash each configuration as "state|inputPos|stack" and refuse to
 *   re-enqueue a configuration we have already seen.  This is correct for BFS
 *   because BFS explores shortest-step paths first; if we already processed a
 *   config, any future encounter can only be via a longer path.
 *
 * ── Stack push order ─────────────────────────────────────────────────────────
 *   A transition's pushStack is TOP-FIRST (as produced by pdaConverter).
 *   To push it onto the stack (array with last = top) we must push symbols
 *   in REVERSE order, so that pushStack[0] ends up on top.
 *
 *   Example: pushStack = ['a', 'S', 'b']
 *   We push 'b', 'S', 'a'  → top of stack is 'a'  ✓
 */

// Maximum BFS nodes explored before giving up (prevents infinite loops on
// ambiguous/recursive grammars with large input).
const BFS_NODE_LIMIT = 100_000;

// ── Configuration key ─────────────────────────────────────────────────────────

/** Produce a string key that uniquely identifies a PDA configuration. */
function configKey(state, inputPos, stack) {
  return `${state}|${inputPos}|${stack.join(',')}`;
}

// ── Transition lookup ─────────────────────────────────────────────────────────

/**
 * Return all transitions applicable to the current configuration.
 *
 * A transition matches when:
 *   t.from     === state           (must be in the right state)
 *   t.stackTop === stackTopSymbol  (must match the top of the stack)
 *   t.input    === 'ε'             (epsilon — don't consume input)
 *     OR
 *   t.input    === currentInputChar (terminal — consume one input char)
 */
function applicableTransitions(pda, state, inputPos, stack, inputString) {
  if (stack.length === 0) return []; // empty stack — nothing can fire

  const stackTop = stack[stack.length - 1];
  const currentChar = inputPos < inputString.length ? inputString[inputPos] : null;

  return pda.transitions.filter(t => {
    if (t.from !== state)         return false;
    if (t.stackTop !== stackTop)  return false;
    if (t.input === 'ε')          return true;
    if (t.input === currentChar)  return true;
    return false;
  });
}

// ── Apply a transition ────────────────────────────────────────────────────────

/**
 * Apply a transition to a configuration and return the successor configuration.
 *
 * @param {string[]} stack     Current stack (bottom at [0], top at [last])
 * @param {number}   inputPos  Current input pointer
 * @param {Object}   t         Transition to apply
 * @returns {{ newStack: string[], newInputPos: number }}
 */
function applyTransition(stack, inputPos, t) {
  // Pop the top symbol
  const newStack = stack.slice(0, -1);

  // Push pushStack symbols in REVERSE order (so pushStack[0] ends up on top)
  const toPush = [...t.pushStack].reverse();
  newStack.push(...toPush);

  // Advance input pointer only if this transition consumes a terminal
  const newInputPos = t.input !== 'ε' ? inputPos + 1 : inputPos;

  return { newStack, newInputPos };
}

// ── Format a step for the trace output ───────────────────────────────────────

/**
 * Produce a human-readable step record.
 *
 * @param {string}   state         State before transition
 * @param {number}   inputPos      Input position before transition
 * @param {string[]} stack         Stack before transition (bottom at [0])
 * @param {string}   inputString   Full input string
 * @param {Object}   transition    The transition being applied
 * @param {string[]} newStack      Stack after transition
 * @param {number}   newInputPos   Input position after transition
 */
function makeStep(state, inputPos, stack, inputString, transition, newStack, newInputPos) {
  const remainingInput = inputString.slice(inputPos) || 'ε';
  const newRemainingInput = inputString.slice(newInputPos) || 'ε';

  // Display stack top-first for readability
  const stackDisplay    = stack.length > 0
    ? [...stack].reverse().join(' ')
    : '∅';
  const newStackDisplay = newStack.length > 0
    ? [...newStack].reverse().join(' ')
    : '∅';

  const pushDisplay = transition.pushStack.length > 0
    ? transition.pushStack.join('')
    : 'ε';

  return {
    state,
    remainingInput,
    stackDisplay,          // top-first display
    stackRaw: [...stack],  // bottom-first raw (for visualisation)
    rule: `δ(${state}, ${transition.input}, ${transition.stackTop}) → (${transition.to}, ${pushDisplay})`,
    description: transition.description,
    transitionId: transition.id,
    // After-transition snapshot
    nextState: transition.to,
    newRemainingInput,
    newStackDisplay,
    newStackRaw: [...newStack],
  };
}

// ── Main BFS simulation ───────────────────────────────────────────────────────

/**
 * Simulate the PDA on inputString using BFS.
 *
 * Returns:
 *   {
 *     accepted:   boolean,
 *     steps:      Step[],          // trace for the accepting path (if found)
 *     allPaths:   number,          // total BFS nodes explored
 *     message:    string,
 *   }
 */
function simulate(pda, inputString) {
  // Each BFS node: { state, inputPos, stack, steps[] }
  const initial = {
    state:    pda.startState,
    inputPos: 0,
    stack:    [pda.startStack], // ['Z']
    steps:    [],
  };

  const queue   = [initial];
  const visited = new Set([configKey(initial.state, initial.inputPos, initial.stack)]);
  let   nodesExplored = 0;

  while (queue.length > 0) {
    nodesExplored++;

    if (nodesExplored > BFS_NODE_LIMIT) {
      return {
        accepted:     false,
        steps:        [],
        allPaths:     nodesExplored,
        message:      `Search limit (${BFS_NODE_LIMIT} nodes) reached without finding an accepting path.`,
      };
    }

    const { state, inputPos, stack, steps } = queue.shift();

    // ── Check acceptance ────────────────────────────────────────────────────
    if (state === pda.acceptState && inputPos === inputString.length) {
      return {
        accepted:   true,
        steps,
        allPaths:   nodesExplored,
        message:    `Accepted! "${inputString || 'ε'}" is in the language. (${nodesExplored} configurations explored)`,
      };
    }

    // ── Expand successors ────────────────────────────────────────────────────
    const applicable = applicableTransitions(pda, state, inputPos, stack, inputString);

    for (const t of applicable) {
      const { newStack, newInputPos } = applyTransition(stack, inputPos, t);

      const key = configKey(t.to, newInputPos, newStack);
      if (visited.has(key)) continue; // already explored this configuration
      visited.add(key);

      const step = makeStep(state, inputPos, stack, inputString, t, newStack, newInputPos);

      queue.push({
        state:    t.to,
        inputPos: newInputPos,
        stack:    newStack,
        steps:    [...steps, step],
      });
    }
  }

  // Exhausted all reachable configurations without acceptance
  return {
    accepted:   false,
    steps:      [],
    allPaths:   nodesExplored,
    message:    `Rejected. "${inputString || 'ε'}" is NOT in the language. (${nodesExplored} configurations explored)`,
  };
}

module.exports = { simulate };
