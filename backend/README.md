# LogiRoute Backend

Simple Node/Express backend for LogiRoute.

## Run

```bash
cd backend
npm install
npm run dev
```

### Owner-only backend (no customer actions)

Run with owner-only enforcement enabled:

```bash
cd backend
npm install
npm run dev:owner
```

In owner-only mode:
- `POST/PATCH/DELETE` requests under `/api/*` require an **owner** token.
- `/api/auth/login` and `/api/auth/signup` only allow `role: "owner"`.

Example login + call:

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
	-H "Content-Type: application/json" \
	-d "{\"role\":\"owner\",\"id\":\"owner@logiroute.in\",\"password\":\"owner123\"}"

# then use:  -H "Authorization: Bearer <token>"
```

Server starts on `http://localhost:8080` by default.

When the `frontend/` folder exists at the repo root, this server also serves the static frontend at:

- `GET /` (opens the UI)

## Endpoints

- `GET /health`
- `GET /api/state`
- `POST /api/seed` (body: `{ "force": true, "packageCount": 30 }`)

Entities:
- `GET /api/nodes`
- `GET/POST/PATCH/DELETE /api/trucks`
- `GET/POST/PATCH/DELETE /api/packages`
- `PATCH /api/packages/bulk` (body: `{ "updates": [{ "id": "LR24000", "status": "In Transit", "eta": "10:30 AM" }] }`)
- `POST /api/packages/:id/assign` (body: `{ "truckId": "TRK-101" }` or empty to unassign)
- `GET/POST /api/incidents`
- `POST /api/incidents/:id/resolve`

Auth:
- `POST /api/auth/signup` (body: `{ "role": "owner"|"customer", "id": "email", "password": "...", "name": "optional" }`)
- `POST /api/auth/login` (body: `{ "role": "owner"|"customer", "id": "email", "password": "..." }`)

Demo seeded users:
- Owner: `owner@logiroute.in` / `owner123`
- Customer: `customer@logiroute.in` / `track123`
