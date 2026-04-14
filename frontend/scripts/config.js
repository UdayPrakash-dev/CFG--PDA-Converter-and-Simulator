/**
 * frontend/scripts/config.js
 *
 * Single source of truth for the backend API base URL.
 *
 * ── Local development ──────────────────────────────────────────────────────
 *   Backend runs on http://localhost:4000
 *   Frontend is opened from the filesystem (file://) or a local static server.
 *   API_BASE = 'http://localhost:4000'
 *
 * ── Render deployment ──────────────────────────────────────────────────────
 *   1. Deploy backend/ as a Render Web Service.
 *      Render assigns a URL like: https://cfg-pda-backend.onrender.com
 *   2. Replace the API_BASE value below with that URL.
 *   3. Deploy frontend/ as a Render Static Site.
 *
 * No other file needs to change to switch environments.
 */

window.APP_CONFIG = {
  // ← Change this to your Render backend URL before deploying
  API_BASE: 'https://cfg-pda-backend.onrender.com',
};
