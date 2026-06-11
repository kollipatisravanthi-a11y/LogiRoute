# LogiRoute

A simple logistics frontend prototype with role-based entry points (Owner / Customer) and supporting JS modules.

## Backend (Node/Express)

The backend lives in `backend/` and provides REST endpoints for nodes, trucks, packages, and incidents.

```bash
cd backend
npm install
npm run dev
```

Then check:

- http://localhost:8080/health

## Run frontend + backend together (recommended)

The backend now serves the static frontend automatically.

```bash
npm run dev
```

Then open:

- http://localhost:8080/

Demo accounts (stored in backend DB):

- Owner: `owner@logiroute.in` / `owner123`
- Customer: `customer@logiroute.in` / `track123`

You can also create new accounts from the UI using **Sign up**.

API stays available at the same origin:

- http://localhost:8080/api

## Test

```bash
npm test
```

The test suite starts the backend on a temporary port with an isolated JSON database and verifies health, seeded state, login, and bulk package updates.

## Run locally

Option A (Python):

```bash
cd frontend
python -m http.server 5173
```

Then open:

- http://localhost:5173/

If the backend is running, the UI will auto-connect to it on `http://localhost:8080`.

Option B (VS Code Live Server):

- Open `frontend/index.html`
- Click **Go Live**

If the backend is running, the UI will auto-connect to it on `http://localhost:8080`.

## Project structure

- `frontend/index.html` - app entry
- `frontend/assets/css/styles.css` - styling
- `frontend/assets/js/` - application logic (auth, state, owner/customer flows, maps)
- `backend/src/` - Express API, JSON database helpers, seed data, and validation helpers

## Notes

The frontend can run as a static site. A simple Node/Express backend is available under `backend/` (see "Backend" above) and exposes REST endpoints at `http://localhost:8080`.
