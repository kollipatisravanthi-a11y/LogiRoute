# LogiRoute

A logistics routing simulator built as a Design and Analysis of Algorithms (DAA) course
project. It uses a fictional logistics scenario (trucks, packages, delivery routes) as a
concrete setting to implement, compare, and benchmark seven classic algorithms.

## Architecture

```
LogiRoute-main/
  backend/          Node.js / Express REST API
  frontend/         Vanilla HTML + CSS + JS (no build step)
  tests/            Algorithm unit tests (plain Node)
  package.json      Root convenience scripts
```

The **backend serves the frontend** as static files on the same origin — there is no
separate dev server needed. When you start the backend, opening `http://localhost:8080`
loads the full UI and all API calls go to the same host.

The frontend also runs in **offline demo mode** (no backend required). If you open
`index.html` directly via a static server (e.g. Live Server) without the backend running,
the app detects this and falls back to an in-memory, randomly-generated dataset so the UI
is still fully interactive.

---

## Quick start (recommended — full stack)

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Start the server

From the project root:

```bash
npm start          # production mode  (node src/server.js)
npm run dev        # dev / watch mode  (node --watch src/server.js)
```

Or from the `backend/` directory directly:

```bash
npm start
npm run dev
```

### 3. Open the app

```
http://localhost:8080
```

The backend starts on port **8080** by default. You can override this with the `PORT`
environment variable:

```bash
PORT=3000 npm start
```

---

## Demo credentials

| Role     | Email                     | Password   |
|----------|---------------------------|------------|
| Owner    | owner@logiroute.in        | owner123   |
| Customer | customer@logiroute.in     | track123   |

These are seeded automatically the first time the server starts. Credentials are also
shown directly on the sign-in screen.

---

## Frontend ↔ Backend connection

The frontend auto-detects the backend at startup (`tryConnectBackend` in `utils.js`).
It probes the following origins in order:

1. **Same origin** (`""`) — used when the frontend is served by the backend itself (the
   recommended setup).
2. `http://<hostname>:8080` — used when the UI is opened via a static file server on a
   different port.
3. `http://localhost:8080` and `http://127.0.0.1:8080` — Windows / WSL fallbacks.

If none of the candidates responds successfully, the app silently falls back to the
offline/demo mode described above. The `state.backendConnected` flag reflects which mode
is active at runtime.

---

## Owner-only mode

Set the environment variable `LOGIROUTE_OWNER_ONLY=1` to restrict all non-GET API calls
to authenticated owner tokens only:

```bash
LOGIROUTE_OWNER_ONLY=1 npm start
```

---

## Run the unit tests

```bash
# From the project root
npm test

# Or directly
node tests/algorithms.test.js
```

No extra dependencies required — tests use plain Node with the built-in `assert` module.
18 tests cover correctness of every algorithm (shortest paths agreeing across two methods,
knapsack capacity constraints, cycle detection, TSP methods agreeing on the optimum, etc.).

---

## Project structure

```
backend/
  src/
    server.js        Express REST API + static frontend serving
    db.js            JSON file persistence (backend/data/db.json)
    seed.js          Synthetic city/package/truck data generator
    validation.js    Input-validation helpers
    ownerServer.js   Convenience entry-point for owner-only mode
  data/
    db.json          Created automatically on first run
  package.json

frontend/
  index.html
  assets/
    css/styles.css
    js/
      data.js          City/package/graph generation (offline demo data)
      algorithms.js    All seven algorithms, each annotated with complexity
      state.js         App state + view router
      auth.js          Login / signup flows (calls /api/auth/*)
      owner.js         Owner dashboard, Algorithm Control, Complexity Lab
      customer.js      Customer tracking flows
      maps.js          Canvas rendering (map, charts, benchmark plots)
      utils.js         Backend integration helpers + misc utilities
      bootstrap.js     Simulation loop + entry point (calls tryConnectBackend)

tests/
  algorithms.test.js
```

---

## API endpoints

| Method | Path                        | Description                          |
|--------|-----------------------------|--------------------------------------|
| GET    | `/health`                   | Health check                         |
| GET    | `/api/state`                | Full DB snapshot (nodes, trucks, packages, incidents) |
| POST   | `/api/seed`                 | Re-seed the database                 |
| GET    | `/api/nodes`                | List all city nodes                  |
| GET    | `/api/trucks`               | List all trucks                      |
| POST   | `/api/trucks`               | Add a truck                          |
| GET    | `/api/trucks/:id`           | Get a single truck                   |
| PATCH  | `/api/trucks/:id`           | Update a truck                       |
| DELETE | `/api/trucks/:id`           | Remove a truck                       |
| GET    | `/api/packages`             | List packages (filterable by status/truckId/q) |
| POST   | `/api/packages`             | Add a package                        |
| GET    | `/api/packages/:id`         | Get a single package                 |
| PATCH  | `/api/packages/:id`         | Update a package                     |
| DELETE | `/api/packages/:id`         | Remove a package                     |
| PATCH  | `/api/packages/bulk`        | Bulk-update packages                 |
| POST   | `/api/packages/:id/assign`  | Assign a package to a truck          |
| GET    | `/api/incidents`            | List all incidents                   |
| POST   | `/api/incidents`            | Create an incident                   |
| POST   | `/api/incidents/:id/resolve`| Mark an incident as resolved         |
| POST   | `/api/auth/signup`          | Create a user account                |
| POST   | `/api/auth/login`           | Login and receive a Bearer token     |

---

## Algorithms

Every algorithm below runs live on real (or synthetically generated) data — nothing on the
**Algorithm Control** or **Complexity Lab** pages is a canned/staged demo.

### 1. Floyd-Warshall — All-Pairs Shortest Path
**Technique:** Dynamic Programming &nbsp; **Time:** O(V³) &nbsp; **Space:** O(V²)

Computes shortest distances between *every* pair of city nodes at once. Chosen over running
Dijkstra from every node because the fleet needs a ready-made distance table that any truck,
from any position, can look up in O(1) — the app can't predict in advance which node any
given truck will be nearest to when routes are recomputed.

### 2. Dijkstra — Single-Source Shortest Path
**Technique:** Greedy &nbsp; **Time:** O(V² + E) &nbsp; **Space:** O(V)

Included specifically to compare against Floyd-Warshall on the Algorithm Control page: same
graph, same source node, and the app checks live that the two agree exactly. Dijkstra is
faster for one source; Floyd-Warshall wins once you need all sources, which is why the app
uses Floyd-Warshall for actual routing but keeps Dijkstra as the comparison baseline.

### 3. Prim's Algorithm — Minimum Spanning Tree
**Technique:** Greedy &nbsp; **Time:** O(V²) &nbsp; **Space:** O(V)

Framed in the UI as "optimal warehouse network design" — the cheapest possible set of links
connecting every area with no cycles. It's also reused internally as the lower-bound function
for the TSP branch-and-bound below (a standard DAA technique: the weight of an MST over the
remaining unvisited nodes can never exceed the cost of finishing an optimal tour through them).

### 4. 0/1 Knapsack — Package Loading
**Technique:** Dynamic Programming &nbsp; **Time:** O(n·W) &nbsp; **Space:** O(n·W)

Decides which packages fit on a truck's remaining capacity. Modeled as 0/1 (not fractional)
because a physical parcel can't be split. The DP table backs out the actual optimal subset,
not just the optimal value.

### 5. Fractional Knapsack — Comparison Baseline
**Technique:** Greedy (highest value/weight ratio first) &nbsp; **Time:** O(n log n) &nbsp;
**Space:** O(n)

Kept deliberately alongside the 0/1 DP version to make a specific DAA point: fractional
knapsack is a case where greedy **is** provably optimal — but only because it's allowed to
split items. The Algorithm Control page shows both totals on the same package set: greedy's
total is always ≥ the 0/1 DP total, and the gap is exactly the value that would require
loading a fraction of a parcel, which isn't physically valid. This is the textbook
justification for why 0/1 DP, not greedy, is the correct model for this problem.

### 6. Kahn's Algorithm — Topological Sort
**Technique:** BFS-based topological sort &nbsp; **Time:** O(V + E) &nbsp; **Space:** O(V + E)

Some packages must be loaded after others (`dependsOn`). Kahn's algorithm produces a valid
loading order, or reports that no valid order exists (a dependency cycle).

### 7. Travelling Salesman Problem — Route Planning
Three different algorithms solve the same problem, so their trade-offs can be compared
directly on the Algorithm Control page, on the same stop set:

- **Greedy Nearest-Neighbour** — O(n²). Always steps to the closest unvisited stop. Fast,
  simple, no optimality guarantee.
- **Held-Karp** — O(2ⁿ·n²) time, O(2ⁿ·n) space. Dynamic programming over subsets; finds the
  *provably* optimal route. Only tractable for small n, so it's capped at 13 stops — the cap
  itself is the point being demonstrated (exponential growth makes exact solving infeasible
  past a fairly small size).
- **Branch and Bound** — worst case O(n!), but heavily pruned in practice. Explores the same
  search tree as brute force, but at every partial route it computes an MST-based lower bound
  on the cost of finishing the tour (see Prim's above). If a partial route's cost-so-far plus
  that bound already exceeds the best complete tour found so far, the whole branch is
  discarded unexplored. The Algorithm Control page reports how many branches were explored
  vs. pruned for the current stop set, so the pruning is visible, not just claimed.

---

## Fleet Optimization — what actually differs from a single-vehicle TSP demo

A single-vehicle TSP is a classroom exercise. A fleet of vehicles, each with a capacity limit,
serving many delivery points while some of them have deadlines, is the actual Vehicle Routing
Problem the logistics industry spends real engineering effort on. The **Fleet Optimization**
page adds three pieces that close that gap, all running on real fleet/package data, not a
canned example:

### Clarke-Wright Savings Algorithm — Capacitated Vehicle Routing (CVRP)
**Technique:** Greedy merge heuristic &nbsp; **Time:** O(n² log n) &nbsp; **Space:** O(n²)

Elsewhere in the app, packages are assigned to trucks via knapsack and then each truck solves
its own TSP independently — there is no coordination across trucks. Clarke-Wright instead
builds routes for the **whole fleet at once**: start every stop as its own route, then
repeatedly merge the pair of routes with the highest "savings" (the distance saved by visiting
both stops on one trip instead of two separate round-trips from the depot), as long as the
merge stays within vehicle capacity. This is literally the standard first-heuristic taught for
CVRP and still used as a real dispatch baseline. The page directly compares its total distance
against the current independent-per-truck total, so the value of joint optimization is a real
number, not an assertion.

### 2-opt Local Search
**Technique:** Iterative improvement &nbsp; **Time:** O(n²) per pass &nbsp; **Space:** O(n)

Takes any tour and repeatedly reverses a segment between two edges whenever that shortens the
tour — removing "crossings." This is the actual improvement step real routing engines run
after a fast construction heuristic. It also functions as a live correctness check: running
2-opt on an already-optimal Held-Karp tour finds zero further improvement, confirming Held-Karp
found the true optimum rather than just claiming to.

### Earliest-Deadline-First Feasibility Checking
**Technique:** Greedy scheduling &nbsp; **Time:** O(n log n) &nbsp; **Space:** O(n)

Every package has always carried a `deadlineMinutes` field that, before this addition, no
algorithm in the codebase ever read. This closes that gap: given a route, it walks the stops in
order, accumulates travel + service time, and flags any stop reached after its package's
deadline. It also builds an alternative route ordered purely by deadline (EDF) and reports the
same feasibility check on that route for comparison. The honest result: EDF sometimes reduces
missed deadlines at the cost of extra distance, and sometimes makes things *worse* by ignoring
geography entirely — a genuine demonstration that distance-optimality and deadline-feasibility
are competing objectives, not one problem with one best answer.

---

## Complexity Lab

A dedicated page that generates synthetic inputs of increasing size, times each algorithm with
`performance.now()`, and plots empirical runtime against input size — so the Big-O table isn't
just asserted, it's backed by measurements taken in the browser. Exact TSP algorithms use
deliberately small input sizes since they're exponential; everything else scales much further
to make the polynomial growth curves visible.
