/* ============================================================
   BENCHMARK MODULE
   Generates synthetic inputs of increasing size and times each
   algorithm with performance.now(), so the Complexity Lab page can
   plot empirical runtime growth next to the theoretical Big-O and
   show they actually match. This is independent of the live city
   graph so it can scale sizes beyond the ~45 simulated nodes.
   ============================================================ */

const LR_BIG_O = [
  { name: "Floyd-Warshall", category: "All-pairs shortest path", technique: "Dynamic Programming", time: "O(V^3)", space: "O(V^2)" },
  { name: "Dijkstra", category: "Single-source shortest path", technique: "Greedy", time: "O(V^2 + E)", space: "O(V)" },
  { name: "Prim's MST", category: "Minimum spanning tree", technique: "Greedy", time: "O(V^2)", space: "O(V)" },
  { name: "0/1 Knapsack", category: "Package loading", technique: "Dynamic Programming", time: "O(n \u00b7 W)", space: "O(n \u00b7 W)" },
  { name: "Fractional Knapsack", category: "Package loading (comparison)", technique: "Greedy", time: "O(n log n)", space: "O(n)" },
  { name: "Topological Sort", category: "Dependency ordering", technique: "Kahn's / BFS", time: "O(V + E)", space: "O(V + E)" },
  { name: "Greedy Nearest-Neighbour TSP", category: "Route planning", technique: "Greedy", time: "O(n^2)", space: "O(n)" },
  { name: "Held-Karp TSP", category: "Route planning (exact)", technique: "Dynamic Programming", time: "O(2^n \u00b7 n^2)", space: "O(2^n \u00b7 n)" },
  { name: "Branch and Bound TSP", category: "Route planning (exact, pruned)", technique: "Branch and Bound + MST lower bound", time: "O(n!) worst case, pruned in practice", space: "O(n)" }
];

function lrSeededRandom(seed) {
  let state = seed;
  return function () {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function generateBenchGraph(n, seed = 42) {
  const rand = lrSeededRandom(seed + n);
  const graph = Array.from({ length: n }, () => Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) graph[i][i] = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const weight = Math.round(rand() * 40 + 1);
      graph[i][j] = weight;
      graph[j][i] = weight;
    }
  }
  return graph;
}

function generateBenchItems(n, seed = 7) {
  const rand = lrSeededRandom(seed + n);
  return Array.from({ length: n }, (_, i) => ({
    id: "B" + i,
    weight: Math.round(rand() * 45 + 2),
    priority: rand() > 0.7 ? "Urgent" : "Normal"
  }));
}

function generateBenchPackages(n, seed = 11) {
  const rand = lrSeededRandom(seed + n);
  return Array.from({ length: n }, (_, i) => ({
    id: "P" + i,
    dependsOn: i > 2 && rand() > 0.8 ? ["P" + Math.floor(rand() * (i - 1))] : []
  }));
}

function measureMs(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function runSizedBenchmark(sizes, buildInput, run) {
  return sizes.map(n => {
    const input = buildInput(n);
    const ms = measureMs(() => run(input, n));
    return { n, ms: Number(ms.toFixed(3)) };
  });
}

function benchmarkFloydWarshall(sizes) {
  return runSizedBenchmark(sizes, n => generateBenchGraph(n), graph => floydWarshall(graph));
}

function benchmarkDijkstra(sizes) {
  return runSizedBenchmark(sizes, n => generateBenchGraph(n), graph => dijkstra(graph, 0));
}

function benchmarkPrimMST(sizes) {
  return runSizedBenchmark(sizes, n => generateBenchGraph(n), graph => primMST(graph, 0));
}

function benchmark01Knapsack(sizes, capacity = 300) {
  return runSizedBenchmark(sizes, n => generateBenchItems(n), items => knapsack(items, capacity, 3));
}

function benchmarkFractionalKnapsack(sizes, capacity = 300) {
  return runSizedBenchmark(sizes, n => generateBenchItems(n), items => fractionalKnapsack(items, capacity, 3));
}

function benchmarkTopoSort(sizes) {
  return runSizedBenchmark(sizes, n => generateBenchPackages(n), packages => topoSort(packages));
}

function benchmarkGreedyTsp(sizes) {
  return runSizedBenchmark(sizes, n => ({ graph: generateBenchGraph(n), stops: Array.from({ length: n - 1 }, (_, i) => i + 1) }),
    ({ graph, stops }) => greedyTsp(stops, graph));
}

function benchmarkHeldKarpTsp(sizes) {
  return runSizedBenchmark(sizes, n => ({ graph: generateBenchGraph(n), stops: Array.from({ length: n - 1 }, (_, i) => i + 1) }),
    ({ graph, stops }) => heldKarpTsp(stops, graph));
}

function benchmarkBranchBoundTsp(sizes) {
  return runSizedBenchmark(sizes, n => ({ graph: generateBenchGraph(n), stops: Array.from({ length: n - 1 }, (_, i) => i + 1) }),
    ({ graph, stops }) => branchBoundTsp(stops, graph));
}

/* Runs every benchmark suite with sizes chosen per algorithm to stay
   fast in a browser (a few seconds total) while still showing clear
   growth curves. Exact TSP algorithms use small sizes since they are
   exponential; the graph-family algorithms can go much larger. */
function runAllBenchmarks() {
  return {
    "Floyd-Warshall": benchmarkFloydWarshall([10, 20, 30, 40, 60, 80]),
    "Dijkstra": benchmarkDijkstra([10, 20, 30, 40, 60, 80]),
    "Prim's MST": benchmarkPrimMST([10, 20, 30, 40, 60, 80]),
    "0/1 Knapsack": benchmark01Knapsack([20, 40, 60, 80, 120, 160]),
    "Fractional Knapsack": benchmarkFractionalKnapsack([20, 40, 60, 80, 120, 160]),
    "Topological Sort": benchmarkTopoSort([50, 100, 200, 400, 800, 1200]),
    "Greedy TSP": benchmarkGreedyTsp([5, 10, 15, 20, 30, 40]),
    "Held-Karp TSP": benchmarkHeldKarpTsp([4, 6, 8, 10, 12, 13]),
    "Branch and Bound TSP": benchmarkBranchBoundTsp([4, 6, 8, 10, 11, 12])
  };
}
