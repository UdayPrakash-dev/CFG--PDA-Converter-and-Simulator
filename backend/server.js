/**
 * backend/server.js
 *
 * Express entry point — CFG → PDA Converter & Simulator API.
 *
 * Deployment target: Render Web Service
 *   Build command : npm install
 *   Start command : npm start
 *   Root directory: backend/
 *
 * The frontend is a SEPARATE Render Static Site pointed at the
 * frontend/ folder.  CORS is configured to accept requests from
 * any origin in production (tighten ALLOWED_ORIGIN env-var on Render
 * if you want to restrict to your specific Static Site URL).
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const routes  = require('./routes/index');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the frontend (any origin, or set ALLOWED_ORIGIN env var on Render)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Health-check (Render pings this) ─────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 for unrecognised routes ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Must have exactly 4 params so Express treats it as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[CFG-PDA backend] listening on port ${PORT}`);
});

module.exports = app;
