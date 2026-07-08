/* ============================================================
   UNIT TESTS — plain Node, no dependencies.
   Run with:  node tests/algorithms.test.js
   Each test is a small, hand-checkable case so correctness can be
   verified by inspection, not just "it ran without crashing".
   ============================================================ */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

global.performance = require("perf_hooks").performance;
const src = fs.readFileSync(path.join(__dirname, "../assets/js/algorithms.js"), "utf8");
eval(src);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

console.log("Floyd-Warshall / Dijkstra");
test("Floyd-Warshall finds shortest path via intermediate node", () => {
  const g = [
    [0, 4, Infinity, 1],
    [4, 0, 2, Infinity],
    [Infinity, 2, 0, 3],
    [1, Infinity, 3, 0]
  ];
  const { d } = floydWarshall(g);
  // 0 -> 3 -> 2 -> 1 costs 1+3+2=6, direct 0->1 costs 4. Shortest should be 4.
  assert.strictEqual(d[0][1], 4);
  // 0 -> 1 -> 2 costs 4+2=6, 0 -> 3 -> 2 costs 1+3=4. Shortest should be 4.
  assert.strictEqual(d[0][2], 4);
});

test("Dijkstra agrees with Floyd-Warshall from the same source", () => {
  const g = [
    [0, 4, Infinity, 1],
    [4, 0, 2, Infinity],
    [Infinity, 2, 0, 3],
    [1, Infinity, 3, 0]
  ];
  const { d } = floydWarshall(g);
  const { dist } = dijkstra(g, 0);
  assert.deepStrictEqual(dist, d[0]);
});

test("Dijkstra returns 0 distance to itself and Infinity for unreachable nodes", () => {
  const g = [
    [0, 5, Infinity],
    [5, 0, Infinity],
    [Infinity, Infinity, 0]
  ];
  const { dist } = dijkstra(g, 0);
  assert.strictEqual(dist[0], 0);
  assert.strictEqual(dist[2], Infinity);
});

console.log("Prim's MST");
test("Prim's MST picks the cheapest spanning edges, not just any edges", () => {
  const g = [
    [0, 1, 4, Infinity],
    [1, 0, 2, 6],
    [4, 2, 0, 3],
    [Infinity, 6, 3, 0]
  ];
  const { totalWeight, edges } = primMST(g, 0);
  // Cheapest spanning tree: 0-1 (1) + 1-2 (2) + 2-3 (3) = 6
  assert.strictEqual(totalWeight, 6);
  assert.strictEqual(edges.length, 3);
});

console.log("0/1 Knapsack vs Fractional Knapsack");
test("0/1 Knapsack never exceeds capacity", () => {
  const items = [
    { id: "a", weight: 10, priority: "Normal" },
    { id: "b", weight: 20, priority: "Urgent" },
    { id: "c", weight: 15, priority: "Normal" }
  ];
  const { selected } = knapsack(items, 25, 3);
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  assert.ok(totalWeight <= 25, `selected weight ${totalWeight} exceeds capacity 25`);
});

test("Fractional Knapsack value is always >= 0/1 Knapsack value (greedy is optimal for the relaxed problem)", () => {
  const items = [
    { id: "a", weight: 10, priority: "Normal" },
    { id: "b", weight: 20, priority: "Urgent" },
    { id: "c", weight: 15, priority: "Normal" },
    { id: "d", weight: 7, priority: "Urgent" }
  ];
  const dp = knapsack(items, 25, 3).totalValue;
  const frac = fractionalKnapsack(items, 25, 3).totalValue;
  assert.ok(frac >= dp, `fractional (${frac}) should be >= 0/1 DP (${dp})`);
});

test("0/1 Knapsack with zero capacity selects nothing", () => {
  const items = [{ id: "a", weight: 5, priority: "Normal" }];
  const { selected, totalValue } = knapsack(items, 0, 3);
  assert.strictEqual(selected.length, 0);
  assert.strictEqual(totalValue, 0);
});

console.log("Topological Sort");
test("Topological Sort respects a simple dependency chain", () => {
  const packages = [
    { id: "A", dependsOn: [] },
    { id: "B", dependsOn: ["A"] },
    { id: "C", dependsOn: ["B"] }
  ];
  const { ordered, hasCycle } = topoSort(packages);
  assert.strictEqual(hasCycle, false);
  const indexOf = id => ordered.findIndex(pkg => pkg.id === id);
  assert.ok(indexOf("A") < indexOf("B"));
  assert.ok(indexOf("B") < indexOf("C"));
});

test("Topological Sort detects a cycle and falls back safely", () => {
  const packages = [
    { id: "A", dependsOn: ["B"] },
    { id: "B", dependsOn: ["A"] }
  ];
  const { hasCycle } = topoSort(packages);
  assert.strictEqual(hasCycle, true);
});

console.log("TSP: Greedy / Held-Karp / Branch and Bound");
test("Held-Karp finds a cost less than or equal to Greedy's (it is the exact optimum)", () => {
  const matrix = [
    [0, 10, 15, 20, 10],
    [10, 0, 35, 25, 8],
    [15, 35, 0, 30, 20],
    [20, 25, 30, 0, 12],
    [10, 8, 20, 12, 0]
  ];
  const stops = [1, 2, 3, 4];
  const greedyCost = routeDistance(greedyTsp(stops, matrix), matrix);
  const heldKarpCost = heldKarpTsp(stops, matrix).cost;
  assert.ok(heldKarpCost <= greedyCost, `Held-Karp (${heldKarpCost}) should be <= Greedy (${greedyCost})`);
});

test("Branch and Bound matches Held-Karp's exact optimum", () => {
  const matrix = [
    [0, 10, 15, 20, 10],
    [10, 0, 35, 25, 8],
    [15, 35, 0, 30, 20],
    [20, 25, 30, 0, 12],
    [10, 8, 20, 12, 0]
  ];
  const stops = [1, 2, 3, 4];
  const heldKarpCost = heldKarpTsp(stops, matrix).cost;
  const bbCost = routeDistance(branchBoundTsp(stops, matrix), matrix);
  assert.strictEqual(bbCost, heldKarpCost);
});

test("Every TSP route starts and ends at the warehouse (node 0)", () => {
  const matrix = [
    [0, 10, 15, 20],
    [10, 0, 35, 25],
    [15, 35, 0, 30],
    [20, 25, 30, 0]
  ];
  const stops = [1, 2, 3];
  [greedyTsp(stops, matrix), branchBoundTsp(stops, matrix), heldKarpTsp(stops, matrix).route].forEach(route => {
    assert.strictEqual(route[0], 0);
    assert.strictEqual(route[route.length - 1], 0);
  });
});

console.log("Fleet Optimization: Clarke-Wright VRP / 2-opt / Deadline Feasibility");
test("Clarke-Wright VRP covers every stop exactly once", () => {
  const matrix = [
    [0, 10, 15, 20, 25, 30, 12],
    [10, 0, 35, 25, 18, 22, 14],
    [15, 35, 0, 30, 20, 16, 19],
    [20, 25, 30, 0, 12, 24, 21],
    [25, 18, 20, 12, 0, 15, 17],
    [30, 22, 16, 24, 15, 0, 13],
    [12, 14, 19, 21, 17, 13, 0]
  ];
  const stops = [1, 2, 3, 4, 5, 6];
  const demand = { 1: 20, 2: 15, 3: 25, 4: 10, 5: 30, 6: 18 };
  const vrp = clarkeWrightVRP(stops, demand, matrix, 50);
  const visited = vrp.routes.flatMap(r => r.slice(1, -1));
  assert.strictEqual(visited.length, stops.length);
  assert.strictEqual(new Set(visited).size, stops.length);
});

test("Clarke-Wright VRP never exceeds vehicle capacity on any route", () => {
  const matrix = [
    [0, 10, 15, 20, 25, 30, 12],
    [10, 0, 35, 25, 18, 22, 14],
    [15, 35, 0, 30, 20, 16, 19],
    [20, 25, 30, 0, 12, 24, 21],
    [25, 18, 20, 12, 0, 15, 17],
    [30, 22, 16, 24, 15, 0, 13],
    [12, 14, 19, 21, 17, 13, 0]
  ];
  const stops = [1, 2, 3, 4, 5, 6];
  const demand = { 1: 20, 2: 15, 3: 25, 4: 10, 5: 30, 6: 18 };
  const capacity = 50;
  const vrp = clarkeWrightVRP(stops, demand, matrix, capacity);
  vrp.routes.forEach(route => {
    const load = route.slice(1, -1).reduce((sum, node) => sum + demand[node], 0);
    assert.ok(load <= capacity, `route load ${load} exceeds capacity ${capacity}`);
  });
});

test("2-opt never makes a route longer than the input", () => {
  const matrix = [
    [0, 10, 15, 20, 25, 30, 12],
    [10, 0, 35, 25, 18, 22, 14],
    [15, 35, 0, 30, 20, 16, 19],
    [20, 25, 30, 0, 12, 24, 21],
    [25, 18, 20, 12, 0, 15, 17],
    [30, 22, 16, 24, 15, 0, 13],
    [12, 14, 19, 21, 17, 13, 0]
  ];
  const route = greedyTsp([1, 2, 3, 4, 5, 6], matrix);
  const result = twoOptImprove(route, matrix);
  assert.ok(result.endCost <= result.startCost);
});

test("2-opt finds no improvement on an already-optimal Held-Karp tour", () => {
  const matrix = [
    [0, 10, 15, 20, 25],
    [10, 0, 35, 25, 18],
    [15, 35, 0, 30, 20],
    [20, 25, 30, 0, 12],
    [25, 18, 20, 12, 0]
  ];
  const stops = [1, 2, 3, 4];
  const hk = heldKarpTsp(stops, matrix);
  const result = twoOptImprove(hk.route, matrix);
  assert.strictEqual(Math.round(result.endCost), Math.round(hk.cost));
});

test("Deadline feasibility correctly flags a stop reached after its deadline", () => {
  const matrix = [
    [0, 100],
    [100, 0]
  ];
  const route = [0, 1, 0];
  const packagesByNode = { 1: { id: "P1", deadlineMinutes: 50 } };
  // travel takes 100 minutes + 8 service = 108, well past deadline of 50
  const result = checkDeadlineFeasibility(route, matrix, packagesByNode, 0, 8);
  assert.strictEqual(result.missed, 1);
  assert.strictEqual(result.onTime, 0);
});

test("Deadline feasibility correctly passes a stop reached before its deadline", () => {
  const matrix = [
    [0, 5],
    [5, 0]
  ];
  const route = [0, 1, 0];
  const packagesByNode = { 1: { id: "P1", deadlineMinutes: 50 } };
  const result = checkDeadlineFeasibility(route, matrix, packagesByNode, 0, 8);
  assert.strictEqual(result.onTime, 1);
  assert.strictEqual(result.missed, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
