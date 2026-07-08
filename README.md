# LogiRoute

A logistics routing simulator built as a Design and Analysis of Algorithms (DAA) course
project. It uses a fictional logistics scenario (trucks, packages, delivery routes) as a
concrete setting to implement, compare, and benchmark seven classic algorithms.

## Run locally

```bash
cd frontend       # if this README sits above the frontend/ folder in your submission
python -m http.server 5173
```

Then open `http://localhost:5173/`.

Login demo credentials are shown directly on the sign-in screen (password, email OTP, and
mobile OTP flows are all available; OTP code is always `123456`).

Once inside as Owner, go to **Algorithm Control** and **Complexity Lab** in the sidebar —
that's where the DAA content lives.

## Run the unit tests

```bash
node tests/algorithms.test.js
```

No dependencies required — this is plain Node with the built-in `assert` module. 18 tests
cover correctness of every algorithm (shortest paths agreeing across two methods, knapsack
capacity constraints, cycle detection, TSP methods agreeing on the optimum, etc).

## Project structure

```
frontend/
  index.html
  assets/
    css/styles.css
    js/
      data.js          city/package/graph generation
      algorithms.js     all seven algorithms, each annotated with complexity
      benchmarks.js     runtime measurement harness for the Complexity Lab
      state.js          app state + view router
      auth.js           login flows
      owner.js           owner dashboard, Algorithm Control, Complexity Lab
      customer.js        customer tracking flows
      maps.js            canvas rendering (map, charts, benchmark plots)
      utils.js           misc helpers
      bootstrap.js       simulation loop + entry point
tests/
  algorithms.test.js
```

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


## Complexity Lab

A dedicated page that generates synthetic inputs of increasing size, times each algorithm with
`performance.now()`, and plots empirical runtime against input size — so the Big-O table isn't
just asserted, it's backed by measurements taken in the browser. Exact TSP algorithms use
deliberately small input sizes since they're exponential; everything else scales much further
to make the polynomial growth curves visible.

## Notes

This project is static (no backend). Data is generated and held in the frontend for the
simulation; there is no persistent storage.
