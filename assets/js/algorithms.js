/* ============================================================
   ALGORITHM MODULE
   Every function is documented with: problem class, technique,
   and time/space complexity, so it reads as a DAA project rather
   than an app that happens to call some algorithms.
   V = graph nodes, E = graph edges, n = items/stops, W = capacity.
   ============================================================ */

/* ---------- 1. ALL PAIRS SHORTEST PATH ---------- */
/* Floyd-Warshall — Dynamic Programming
   Time:  O(V^3)   Space: O(V^2)
   Chosen because the fleet needs distances between EVERY pair of
   nodes (many trucks, many destinations), not just from one source.
   Compare with dijkstra(): running Dijkstra from all V sources costs
   O(V * (E + V log V)), which is faster on sparse graphs but only
   gives single-source results per call — Floyd-Warshall trades
   raw asymptotic efficiency for simplicity and a ready-made all-pairs
   table that every truck can read from directly. */
function floydWarshall(graph) {
  const n = graph.length;
  const d = graph.map(row => row.slice());
  const next = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => graph[i][j] < Infinity && i !== j ? j : null)
  );
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (d[i][k] + d[k][j] < d[i][j]) {
          d[i][j] = d[i][k] + d[k][j];
          next[i][j] = next[i][k];
        }
      }
    }
  }
  return { d, next };
}

/* Dijkstra — Greedy, single-source shortest path
   Time:  O(V^2 + E) with linear-scan selection (acceptable for our
          small/dense graphs; O((V+E) log V) with a binary heap).
   Space: O(V)
   Provided so the Algorithm Control page can run this from one
   warehouse node and compare its runtime directly against a single
   row of the Floyd-Warshall table for the same source. */
function dijkstra(graph, source) {
  const n = graph.length;
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(null);
  const visited = Array(n).fill(false);
  dist[source] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; }
    }
    if (u === -1) break;
    visited[u] = true;
    for (let v = 0; v < n; v++) {
      if (graph[u][v] < Infinity && !visited[v] && dist[u] + graph[u][v] < dist[v]) {
        dist[v] = dist[u] + graph[u][v];
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

/* ---------- 2. MINIMUM SPANNING TREE ---------- */
/* Prim's Algorithm — Greedy
   Time:  O(V^2) with linear-scan selection (O(E log V) with a heap
          for larger sparse graphs).   Space: O(V)
   Framed in the UI as "optimal warehouse network design": the
   cheapest possible set of links connecting every node with no
   cycles. Also reused as the lower-bound function inside the TSP
   branch-and-bound below — a classic DAA technique: the MST weight
   over the remaining unvisited nodes can never exceed the cost of
   completing an optimal tour through them. */
function primMST(graph, start = 0) {
  const n = graph.length;
  const inTree = Array(n).fill(false);
  const key = Array(n).fill(Infinity);
  const parent = Array(n).fill(null);
  key[start] = 0;
  const edges = [];
  let totalWeight = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && key[i] < best) { best = key[i]; u = i; }
    }
    if (u === -1) break;
    inTree[u] = true;
    if (parent[u] !== null) {
      edges.push({ from: parent[u], to: u, weight: graph[parent[u]][u] });
      totalWeight += graph[parent[u]][u];
    }
    for (let v = 0; v < n; v++) {
      if (graph[u][v] < Infinity && !inTree[v] && graph[u][v] < key[v]) {
        key[v] = graph[u][v];
        parent[v] = u;
      }
    }
  }
  return { edges, totalWeight };
}

/* Lower-bound helper for branch-and-bound TSP: weight of the MST
   spanning {current} union {remaining unvisited nodes}. Any tour
   that still has to visit `remaining` cannot cost less than this,
   so it is an admissible (never-overestimating) bound. */
function mstLowerBound(nodes, matrix) {
  if (nodes.length <= 1) return 0;
  const sub = Array.from({ length: nodes.length }, (_, i) =>
    Array.from({ length: nodes.length }, (_, j) => (i === j ? 0 : matrix[nodes[i]][nodes[j]]))
  );
  return primMST(sub, 0).totalWeight;
}

/* ---------- 3. 0/1 KNAPSACK (package loading) ---------- */
/* 0/1 Knapsack — Dynamic Programming
   Time:  O(n * W)   Space: O(n * W)
   Each package either fully goes on the truck or doesn't (you can't
   split a parcel), so this is a textbook 0/1 knapsack, not fractional.
   See fractionalKnapsack() below for the greedy version kept
   deliberately alongside it, to show where greedy loses value versus
   the DP optimum on the exact same package set. */
function knapsack(items, capacity, priorityMultiplier) {
  const cap = Math.max(0, Math.floor(capacity));
  const dp = Array.from({ length: items.length + 1 }, () => Array(cap + 1).fill(0));
  for (let i = 1; i <= items.length; i++) {
    const item = items[i - 1];
    const weight = Math.floor(item.weight);
    const value = item.priority === "Urgent" ? item.weight * priorityMultiplier + 60 : item.weight + 15;
    for (let c = 0; c <= cap; c++) {
      dp[i][c] = dp[i - 1][c];
      if (weight <= c) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - weight] + value);
    }
  }
  const selected = [];
  let c = cap;
  for (let i = items.length; i > 0; i--) {
    if (dp[i][c] !== dp[i - 1][c]) {
      selected.push(items[i - 1]);
      c -= Math.floor(items[i - 1].weight);
    }
  }
  const totalValue = dp[items.length][cap];
  return { selected, dp, totalValue };
}

/* Fractional Knapsack — Greedy
   Time:  O(n log n) for the sort, O(n) to fill.   Space: O(n)
   Sorts by value/weight ratio and takes as much of each item as fits,
   splitting the last one. This is the classic case where greedy IS
   provably optimal (unlike 0/1 knapsack) — but it isn't a valid model
   for physical packages, since "0.4 of a parcel" can't really be
   loaded. Kept here purely as a side-by-side comparison so the
   Algorithm Control page can show: same items, same capacity, DP
   value vs. greedy (fractional) value — and why 0/1 DP is the correct
   model here even though fractional greedy scores higher. */
function fractionalKnapsack(items, capacity, priorityMultiplier) {
  const cap = Math.max(0, capacity);
  const withRatio = items.map(item => {
    const value = item.priority === "Urgent" ? item.weight * priorityMultiplier + 60 : item.weight + 15;
    return { ...item, value, ratio: value / item.weight };
  }).sort((a, b) => b.ratio - a.ratio);
  let remaining = cap;
  let totalValue = 0;
  const taken = [];
  for (const item of withRatio) {
    if (remaining <= 0) break;
    if (item.weight <= remaining) {
      taken.push({ ...item, fraction: 1 });
      totalValue += item.value;
      remaining -= item.weight;
    } else {
      const fraction = remaining / item.weight;
      taken.push({ ...item, fraction });
      totalValue += item.value * fraction;
      remaining = 0;
    }
  }
  return { taken, totalValue };
}

/* ---------- 4. TOPOLOGICAL SORT (delivery dependencies) ---------- */
/* Kahn's Algorithm — BFS-based topological sort
   Time:  O(V + E)   Space: O(V + E)
   Some packages must be loaded after others (dependsOn). This
   guarantees a valid loading order or reports a cycle. */
function topoSort(packages) {
  const byId = new Map(packages.map(pkg => [pkg.id, pkg]));
  const inDegree = new Map(packages.map(pkg => [pkg.id, 0]));
  const edges = new Map(packages.map(pkg => [pkg.id, []]));
  packages.forEach(pkg => {
    pkg.dependsOn.forEach(dep => {
      if (byId.has(dep)) {
        edges.get(dep).push(pkg.id);
        inDegree.set(pkg.id, inDegree.get(pkg.id) + 1);
      }
    });
  });
  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const ordered = [];
  while (queue.length) {
    const id = queue.shift();
    ordered.push(byId.get(id));
    edges.get(id).forEach(to => {
      inDegree.set(to, inDegree.get(to) - 1);
      if (inDegree.get(to) === 0) queue.push(to);
    });
  }
  return { ordered: ordered.length === packages.length ? ordered : packages, hasCycle: ordered.length !== packages.length };
}

/* ---------- 5. TRAVELLING SALESMAN (route planning) ---------- */
function routeDistance(route, matrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) total += matrix[route[i]][route[i + 1]];
  return total;
}

/* Greedy Nearest Neighbour
   Time:  O(n^2)   Space: O(n)
   Fast, simple, but not optimal — always picks the closest unvisited
   stop next with no lookahead. */
function greedyTsp(stops, matrix) {
  const remaining = [...new Set(stops)].filter(node => node !== 0);
  const route = [0];
  while (remaining.length) {
    const current = route[route.length - 1];
    remaining.sort((a, b) => matrix[current][a] - matrix[current][b]);
    route.push(remaining.shift());
  }
  route.push(0);
  return route;
}

/* Held-Karp — Dynamic Programming, EXACT optimum
   Time:  O(2^n * n^2)   Space: O(2^n * n)
   Only tractable for small n (capped at 13 stops here — 2^13 * 13^2
   is already ~1.4M operations). Included so small routes can be
   checked against a *provably optimal* answer, not just "whatever
   branch-and-bound happened to find". */
function heldKarpTsp(stops, matrix) {
  const unique = [...new Set(stops)].filter(node => node !== 0).slice(0, 13);
  const n = unique.length;
  if (n === 0) return { route: [0, 0], cost: 0 };
  if (n === 1) return { route: [0, unique[0], 0], cost: routeDistance([0, unique[0], 0], matrix) };

  const full = 1 << n;
  const dp = Array.from({ length: full }, () => Array(n).fill(Infinity));
  const parent = Array.from({ length: full }, () => Array(n).fill(-1));
  for (let i = 0; i < n; i++) dp[1 << i][i] = matrix[0][unique[i]];

  for (let mask = 1; mask < full; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last)) || dp[mask][last] === Infinity) continue;
      for (let next = 0; next < n; next++) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const cost = dp[mask][last] + matrix[unique[last]][unique[next]];
        if (cost < dp[nextMask][next]) {
          dp[nextMask][next] = cost;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  let bestCost = Infinity;
  let bestLast = -1;
  const fullMask = full - 1;
  for (let last = 0; last < n; last++) {
    const cost = dp[fullMask][last] + matrix[unique[last]][0];
    if (cost < bestCost) { bestCost = cost; bestLast = last; }
  }

  const order = [];
  let mask = fullMask;
  let last = bestLast;
  while (last !== -1) {
    order.push(unique[last]);
    const p = parent[mask][last];
    mask ^= (1 << last);
    last = p;
  }
  order.reverse();
  return { route: [0, ...order, 0], cost: bestCost };
}

/* Branch and Bound
   Time:  worst case O(n!), heavily pruned in practice.   Space: O(n)
   Explores the same permutation tree as brute force, but at every
   partial path it computes an MST-based lower bound on the remaining
   unvisited nodes (mstLowerBound). If partial cost + bound already
   exceeds the best full tour found so far, that whole branch is
   discarded unexplored — this is what makes it a real
   branch-and-bound rather than "greedy search with a cutoff". */
function branchBoundTsp(stops, matrix) {
  const unique = [...new Set(stops)].filter(node => node !== 0).slice(0, 12);
  if (!unique.length) return [0, 0];

  let best = greedyTsp(unique, matrix);
  let bestCost = routeDistance(best, matrix);
  let nodesExplored = 0;
  let nodesPruned = 0;

  function visit(path, remaining, cost) {
    nodesExplored++;
    const bound = cost + mstLowerBound([path[path.length - 1], ...remaining], matrix);
    if (bound >= bestCost) { nodesPruned++; return; }

    if (!remaining.length) {
      const total = cost + matrix[path[path.length - 1]][0];
      if (total < bestCost) {
        bestCost = total;
        best = path.concat(0);
      }
      return;
    }
    const current = path[path.length - 1];
    remaining
      .map(node => ({ node, weight: matrix[current][node] }))
      .sort((a, b) => a.weight - b.weight)
      .forEach(({ node, weight }) => {
        visit(path.concat(node), remaining.filter(value => value !== node), cost + weight);
      });
  }
  visit([0], unique, 0);
  branchBoundTsp.lastStats = { nodesExplored, nodesPruned };
  return best;
}

/* ---------- 6. FLEET-LEVEL ROUTE OPTIMIZATION ---------- */
/* These three address a real gap in a single-vehicle TSP demo: a fleet
   with several trucks needs routes built JOINTLY (not one truck at a
   time), those routes benefit from local-search cleanup, and packages
   with delivery deadlines need those deadlines actually checked against
   the route rather than just displayed. */

/* Clarke-Wright Savings Algorithm — Constructive heuristic for the
   Capacitated Vehicle Routing Problem (CVRP)
   Time:  O(n^2 log n)   Space: O(n^2)
   The standard first-heuristic for CVRP, still used as a baseline in
   real dispatch systems. Unlike knapsack-then-independent-TSP (assign
   packages to a truck, then solve that truck's tour alone), this
   builds routes for the WHOLE fleet jointly: start with one
   depot-node-depot route per stop, then repeatedly merge the two
   routes whose endpoints have the highest "savings" — the distance
   saved by visiting both nodes on one trip instead of two separate
   round trips from the depot — as long as the merge doesn't exceed
   vehicle capacity. Demonstrates that greedy per-vehicle assignment
   (as done elsewhere in this app) can leave real distance savings on
   the table compared to solving the fleet as one coordinated problem. */
function clarkeWrightVRP(stops, demand, matrix, capacity) {
  const unique = [...new Set(stops)].filter(n => n !== 0);
  if (!unique.length) return { routes: [], totalDistance: 0 };

  const routes = unique.map(node => ({ nodes: [node], load: demand[node] || 0 }));
  const routeOf = new Map(unique.map(node => [node, routes.find(r => r.nodes.includes(node))]));

  const savings = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i], b = unique[j];
      const s = matrix[0][a] + matrix[0][b] - matrix[a][b];
      savings.push({ a, b, s });
    }
  }
  savings.sort((x, y) => y.s - x.s);

  savings.forEach(({ a, b }) => {
    const routeA = routeOf.get(a);
    const routeB = routeOf.get(b);
    if (!routeA || !routeB || routeA === routeB) return;
    const aIsEnd = routeA.nodes[routeA.nodes.length - 1] === a;
    const aIsStart = routeA.nodes[0] === a;
    const bIsEnd = routeB.nodes[routeB.nodes.length - 1] === b;
    const bIsStart = routeB.nodes[0] === b;
    if (!(aIsEnd || aIsStart) || !(bIsEnd || bIsStart)) return;
    if (routeA.load + routeB.load > capacity) return;

    let merged = null;
    if (aIsEnd && bIsStart) merged = routeA.nodes.concat(routeB.nodes);
    else if (bIsEnd && aIsStart) merged = routeB.nodes.concat(routeA.nodes);
    else if (aIsEnd && bIsEnd) merged = routeA.nodes.concat(routeB.nodes.slice().reverse());
    else if (aIsStart && bIsStart) merged = routeA.nodes.slice().reverse().concat(routeB.nodes);
    if (!merged) return;

    const mergedRoute = { nodes: merged, load: routeA.load + routeB.load };
    routes.splice(routes.indexOf(routeA), 1);
    routes.splice(routes.indexOf(routeB), 1);
    routes.push(mergedRoute);
    merged.forEach(node => routeOf.set(node, mergedRoute));
  });

  const fullRoutes = routes.map(r => [0, ...r.nodes, 0]);
  const totalDistance = fullRoutes.reduce((sum, route) => sum + routeDistance(route, matrix), 0);
  return { routes: fullRoutes, totalDistance, vehiclesUsed: fullRoutes.length };
}

/* 2-opt Local Search — Iterative improvement
   Time:  O(n^2) per full pass over all edge pairs, repeated until no
          improving swap is found (bounded here at 200 passes as a
          practical cap).   Space: O(n)
   Takes a complete tour and repeatedly reverses a segment between two
   edges whenever doing so shortens the tour (removes an edge
   "crossing"). This is the actual improvement step real routing
   engines run after a fast construction heuristic (Greedy or
   Clarke-Wright) — and running it on an already-optimal Held-Karp
   tour should find zero improvement, which is a live cross-check on
   Held-Karp's optimality. */
function twoOptImprove(route, matrix) {
  let improved = true;
  let current = route.slice();
  let passes = 0;
  const startCost = routeDistance(current, matrix);
  while (improved && passes < 200) {
    improved = false;
    passes++;
    for (let i = 1; i < current.length - 2; i++) {
      for (let j = i + 1; j < current.length - 1; j++) {
        const a = current[i - 1], b = current[i], c = current[j], d = current[j + 1];
        const before = matrix[a][b] + matrix[c][d];
        const after = matrix[a][c] + matrix[b][d];
        if (after < before - 1e-9) {
          const reversed = current.slice(i, j + 1).reverse();
          current = current.slice(0, i).concat(reversed, current.slice(j + 1));
          improved = true;
        }
      }
    }
  }
  const endCost = routeDistance(current, matrix);
  return { route: current, startCost, endCost, improvementPct: startCost > 0 ? ((startCost - endCost) / startCost) * 100 : 0, passes };
}

/* Earliest-Deadline-First feasibility check — Greedy scheduling
   Time:  O(n log n)   Space: O(n)
   A distance-optimal route is not necessarily a deadline-feasible
   route — this is a real, separate objective from "shortest total
   distance". Given a route, walks it in order accumulating travel
   time (matrix weight treated as minutes, plus a fixed per-stop
   service time) and flags any stop reached after its package's
   deadline. Also builds an alternative EDF route (stops visited in
   deadline order rather than distance order) so the two can be
   compared directly: EDF typically reduces missed deadlines at the
   cost of extra total distance — a genuine, honest trade-off, not a
   strict improvement. */
function checkDeadlineFeasibility(route, matrix, packagesByNode, startMinutes = 540, serviceMinutes = 8) {
  let clock = startMinutes;
  const results = [];
  for (let i = 1; i < route.length - 1; i++) {
    const travelMinutes = matrix[route[i - 1]][route[i]];
    clock += travelMinutes + serviceMinutes;
    const pkg = packagesByNode[route[i]];
    if (pkg) results.push({ node: route[i], packageId: pkg.id, arrival: clock, deadline: pkg.deadlineMinutes, onTime: clock <= pkg.deadlineMinutes });
  }
  return { stops: results, missed: results.filter(r => !r.onTime).length, onTime: results.filter(r => r.onTime).length };
}

function earliestDeadlineFirstRoute(stops, matrix, packagesByNode) {
  const unique = [...new Set(stops)].filter(n => n !== 0);
  const ordered = unique.slice().sort((a, b) => {
    const da = packagesByNode[a] ? packagesByNode[a].deadlineMinutes : Infinity;
    const db = packagesByNode[b] ? packagesByNode[b].deadlineMinutes : Infinity;
    return da - db;
  });
  return [0, ...ordered, 0];
}
