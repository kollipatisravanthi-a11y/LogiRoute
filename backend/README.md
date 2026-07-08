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

## Destination Auto-Validation

Package create/update endpoints now validate destination serviceability automatically:

- Destination must match a known node in the logistics network.
- If `lat` and `lng` are provided, destination must be within the BLR service radius.
- Out-of-network destinations are rejected with a `400` response.

Optional environment variables:

- `LR_BLR_CENTER_LAT` (default: `13.1986`)
- `LR_BLR_CENTER_LNG` (default: `77.7066`)
- `LR_BLR_RADIUS_KM` (default: `45`)

When the `frontend/` folder exists at the repo root, this server also serves the static frontend at:

- `GET /` (opens the UI)

## Endpoints

- `GET /health`
- `GET /api/state`
- `POST /api/seed` (body: `{ "force": true, "packageCount": 30 }`)

Entities:
- `GET /api/nodes`
- `POST /api/nodes` (body: `{ "name": "Near BLR Hub" }` or `{ "name": "Near BLR Hub", "lat": 13.12, "lng": 77.64 }`)
- `GET/POST/PATCH/DELETE /api/trucks`
- `GET/POST/PATCH/DELETE /api/packages`
- `PATCH /api/packages/bulk` (body: `{ "updates": [{ "id": "LR24000", "status": "In Transit", "eta": "10:30 AM" }] }`)
- `POST /api/packages/:id/assign` (body: `{ "truckId": "TRK-101" }` or empty to unassign)
- `GET/POST /api/incidents`
- `POST /api/incidents/:id/resolve`

Auth:
- `POST /api/auth/signup` (body: `{ "role": "owner"|"customer", "id": "email", "password": "...", "name": "optional" }`)
- `POST /api/auth/login` (body: `{ "role": "owner"|"customer", "id": "email", "password": "..." }`)

Package destination fields:
- `node` and/or `destination` should point to a known serviceable node.
- Optional `lat`, `lng` can be sent to enforce BLR-radius geofence checks.

Node creation fields:
- `name` is required for `POST /api/nodes`.
- `lat`, `lng` are optional.
- If `lat`, `lng` are omitted, backend identifies the closest known BLR network area by name and infers coordinates.
- Node is accepted only when inside BLR service radius.
- Duplicate node names are rejected.

Demo seeded users:
- Owner: `owner@logiroute.in` / `owner123`
- Customer: `customer@logiroute.in` / `track123`
