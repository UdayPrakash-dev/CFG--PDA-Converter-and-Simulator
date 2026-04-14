/**
 * backend/routes/index.js
 *
 * Route declarations — thin mapping of HTTP endpoints to controller methods.
 *
 * POST /api/convert   → parse CFG text → produce PDA JSON
 * POST /api/simulate  → run non-deterministic BFS simulation
 * POST /api/generate  → BFS-enumerate accepted strings (length ≤ maxLength)
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/cfgController');

router.post('/convert',  controller.convert);
router.post('/simulate', controller.simulate);
router.post('/generate', controller.generate);

module.exports = router;
