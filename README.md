# CFG → PDA Converter & Simulator

A production-ready web application that converts Context-Free Grammars (CFG) into Pushdown Automata (PDA) using the standard three-state construction, then simulates the PDA on any input string using a non-deterministic BFS engine with a full step-by-step trace player.

---

## Project Structure

```
cfg-pda-render/
├── .gitignore
├── README.md
│
├── backend/                        ← Render Web Service
│   ├── package.json
│   ├── server.js                   ← Express API server (CORS-enabled, no static files)
│   ├── routes/
│   │   └── index.js                ← POST /api/convert, /simulate, /generate
│   ├── controllers/
│   │   └── cfgController.js        ← HTTP adapter: validates input, calls services
│   └── services/
│       ├── cfgParser.js            ← Grammar parser + BFS string enumerator
│       ├── pdaConverter.js         ← Standard CFG → PDA construction (3 states)
│       └── pdaSimulator.js         ← Non-deterministic BFS PDA simulator
│
└── frontend/                       ← Render Static Site
    ├── index.html
    ├── styles/
    │   └── main.css
    └── scripts/
        ├── config.js               ← ← Set your backend URL here before deploying
        └── app.js                  ← UI logic, API calls, trace player
```

---

## Features

- **CFG input** with preset grammars (aⁿbⁿ, palindromes, aⁿbᵐ, balanced brackets)
- **CFG → PDA conversion** using the exact standard three-state construction
- **Transition table** with colour-coded rule types (init / expand / match / accept)
- **Non-deterministic BFS simulation** — finds the accepting path if one exists
- **Step-by-step trace player** with prev/next/auto-play controls
- **Live stack visualisation** showing top-of-stack highlighted
- **Sample string generator** — click any chip to auto-simulate it

---

## Running Locally

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### 1 — Start the backend

```bash
cd backend
npm install
npm start
# Server listening at http://localhost:4000
```

To use auto-restart during development:

```bash
npm run dev    # uses nodemon
```

### 2 — Open the frontend

Open `frontend/index.html` directly in your browser:

```bash
# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html

# Windows
start frontend/index.html
```

Or serve it with any static file server:

```bash
cd frontend
npx serve .
# → http://localhost:3000
```

The frontend's `scripts/config.js` already points `API_BASE` at `http://localhost:4000`, so no changes are needed for local development.

---

## API Reference

All endpoints accept and return `application/json`.

### `POST /api/convert`

Parse a CFG and produce the equivalent PDA.

**Request**
```json
{ "grammar": "S -> aSb | ε" }
```

**Response**
```json
{
  "cfg": {
    "start": "S",
    "productions": { "S": ["aSb", ""] },
    "variables": ["S"],
    "terminals": ["a", "b"]
  },
  "pda": {
    "states": ["q_start", "q_loop", "q_accept"],
    "inputAlphabet": ["a", "b"],
    "stackAlphabet": ["Z", "S", "a", "b"],
    "startState": "q_start",
    "startStack": "Z",
    "acceptState": "q_accept",
    "transitions": [ ... ]
  }
}
```

---

### `POST /api/simulate`

Run the non-deterministic BFS PDA simulation.

**Request**
```json
{ "grammar": "S -> aSb | ε", "input": "aabb" }
```

**Response**
```json
{
  "accepted": true,
  "steps": [
    {
      "state": "q_start",
      "remainingInput": "aabb",
      "stackDisplay": "Z",
      "stackRaw": ["Z"],
      "rule": "δ(q_start, ε, Z) → (q_loop, SZ)",
      "description": "Initialise stack: push S onto Z",
      "nextState": "q_loop",
      "newRemainingInput": "aabb",
      "newStackDisplay": "S Z",
      "newStackRaw": ["Z", "S"]
    }
  ],
  "allPaths": 14,
  "message": "Accepted! \"aabb\" is in the language. (14 configurations explored)"
}
```

---

### `POST /api/generate`

BFS-enumerate strings accepted by the CFG up to a given length.

**Request**
```json
{ "grammar": "S -> aSb | ε", "maxLength": 6 }
```

**Response**
```json
{ "strings": ["ε", "ab", "aabb", "aaabbb"] }
```

---

### `GET /health`

Health-check endpoint used by Render.

**Response**
```json
{ "status": "ok" }
```

---

## Grammar Syntax

```
S -> aSb | ε          # ε-production; '|' separates alternatives
A -> aA | a           # multiple alternatives
B -> bB | b
S -> AB               # variable sequences (multi-variable grammars)
```

| Rule | Meaning |
|------|---------|
| `A -> α \| β` | Variable A derives α or β |
| `ε` / `eps` / `lambda` | Empty string |
| Single uppercase letter | Variable (non-terminal) |
| Lowercase or digit | Terminal |
| Lines starting with `#` | Comments (ignored) |
| Same variable on multiple lines | Alternatives are merged |

---

## CFG → PDA Construction

Standard three-state construction:

| Transition | Meaning |
|---|---|
| `δ(q_start, ε, Z) → (q_loop, SZ)` | Push start symbol onto bottom marker |
| `δ(q_loop, ε, A) → (q_loop, α)` | For every production A → α |
| `δ(q_loop, a, a) → (q_loop, ε)` | For every terminal a — consume and pop |
| `δ(q_loop, ε, Z) → (q_accept, Z)` | Only Z remains → accept |

Stack convention: RHS symbols are pushed in **reverse order** so the leftmost symbol ends up on top. For `S → aSb`, after expansion the stack is `[a, S, b]` top-to-bottom.

---

## Deploying on Render

### Step 1 — Push to GitHub

```bash
cd cfg-pda-render
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/cfg-pda-render.git
git push -u origin main
```

---

### Step 2 — Deploy the backend as a Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `cfg-pda-backend` (or any name) |
| **Root Directory** | `backend` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

4. Click **Create Web Service**
5. Wait for the first deploy to finish
6. Copy the assigned URL — it will look like:
   ```
   https://cfg-pda-backend.onrender.com
   ```

**Optional — restrict CORS to your frontend only:**

Add an environment variable in Render → **Environment**:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGIN` | `https://cfg-pda-frontend.onrender.com` |

---

### Step 3 — Update `config.js` with the backend URL

Edit `frontend/scripts/config.js`:

```js
window.APP_CONFIG = {
  API_BASE: 'https://cfg-pda-backend.onrender.com',  // ← your actual URL
};
```

Commit and push this change:

```bash
git add frontend/scripts/config.js
git commit -m "set render backend URL"
git push
```

---

### Step 4 — Deploy the frontend as a Static Site

1. Go to [render.com](https://render.com) → **New** → **Static Site**
2. Connect the same GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `cfg-pda-frontend` (or any name) |
| **Root Directory** | `frontend` |
| **Build Command** | *(leave blank)* |
| **Publish Directory** | `.` |

4. Click **Create Static Site**
5. Your app is live at the assigned URL, e.g.:
   ```
   https://cfg-pda-frontend.onrender.com
   ```

---

## Architecture Decisions

| Decision | Reason |
|----------|--------|
| Backend and frontend in separate Render services | Clean separation; frontend can be CDN-cached while backend scales independently |
| `config.js` for API URL | Single file to change when switching environments — no build step required |
| BFS over DFS for simulation | Guarantees shortest accepting path; cycle detection via visited-set is exact for BFS |
| `variables`/`terminals` as plain arrays | Sets serialize to `{}` in JSON; arrays survive `JSON.stringify/parse` transparently |
| Stateless backend | No session or DB; every request is self-contained; trivially scalable |
| 100k BFS node limit | Prevents hangs on highly ambiguous grammars with long inputs |

---

## Preset Grammars Reference

| Preset | Grammar | Language |
|--------|---------|---------|
| aⁿbⁿ | `S -> aSb \| ε` | Equal a's then b's |
| Palindromes | `S -> aSa \| bSb \| a \| b \| ε` | Even/odd palindromes over {a,b} |
| aⁿbᵐ | `S -> AB` / `A -> aA \| a` / `B -> bB \| b` | One+ a's followed by one+ b's |
| a*b* | `S -> aS \| bS \| ε` | Any string over {a,b} |
| Balanced | `S -> SS \| aSb \| ε` | Balanced a/b bracket pairs |
