/**
 * controllers/cfgController.js
 *
 * Thin HTTP adapter: validates input, calls services, returns JSON.
 * No business logic lives here.
 */

const cfgParser    = require('../services/cfgParser');
const pdaConverter = require('../services/pdaConverter');
const pdaSimulator = require('../services/pdaSimulator');

// ── POST /api/convert ─────────────────────────────────────────────────────────
exports.convert = (req, res, next) => {
  try {
    const { grammar } = req.body;
    if (!grammar || typeof grammar !== 'string') {
      return res.status(400).json({ error: 'Request body must contain a "grammar" string.' });
    }

    const cfg = cfgParser.parse(grammar);
    if (!cfg.start) {
      return res.status(400).json({ error: 'Could not parse grammar. Check your syntax.' });
    }

    const pda = pdaConverter.convert(cfg);
    res.json({ cfg, pda });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/simulate ────────────────────────────────────────────────────────
exports.simulate = (req, res, next) => {
  try {
    const { grammar, input } = req.body;
    if (!grammar || typeof grammar !== 'string') {
      return res.status(400).json({ error: 'Request body must contain a "grammar" string.' });
    }
    if (input === undefined || input === null) {
      return res.status(400).json({ error: 'Request body must contain an "input" string.' });
    }

    const cfg = cfgParser.parse(grammar);
    const pda = pdaConverter.convert(cfg);

    // Allow both '' (empty string ≡ ε) and actual strings
    const inputStr = String(input).replace(/^ε$/, '');
    const result   = pdaSimulator.simulate(pda, inputStr);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/generate ────────────────────────────────────────────────────────
exports.generate = (req, res, next) => {
  try {
    const { grammar, maxLength = 6 } = req.body;
    if (!grammar || typeof grammar !== 'string') {
      return res.status(400).json({ error: 'Request body must contain a "grammar" string.' });
    }

    const cfg     = cfgParser.parse(grammar);
    const strings = cfgParser.generateStrings(cfg, Math.min(Number(maxLength) || 6, 10));
    res.json({ strings });
  } catch (err) {
    next(err);
  }
};
