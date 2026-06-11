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
  return { selected, dp };
}

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

function routeDistance(route, matrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) total += matrix[route[i]][route[i + 1]];
  return total;
}

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

function branchBoundTsp(stops, matrix) {
  const unique = [...new Set(stops)].filter(node => node !== 0).slice(0, 9);
  if (!unique.length) return [0, 0];
  let best = greedyTsp(unique, matrix);
  let bestCost = routeDistance(best, matrix);
  function visit(path, remaining, cost) {
    if (cost >= bestCost) return;
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
  return best;
}

// Brute-force TSP for small sets of stops.
// Used only for visualization/comparison (factorial growth!).
function bruteForceTsp(stops, matrix, { maxNodes = 8 } = {}) {
  const unique = [...new Set(stops)].filter(node => node !== 0);
  const nodes = unique.slice(0, Math.max(0, Math.floor(maxNodes)));
  if (!nodes.length) return [0, 0];

  let best = [0].concat(nodes).concat(0);
  let bestCost = routeDistance(best, matrix);

  function visit(path, remaining, cost) {
    if (!remaining.length) {
      const total = cost + matrix[path[path.length - 1]][0];
      if (total < bestCost) {
        bestCost = total;
        best = path.concat(0);
      }
      return;
    }
    const current = path[path.length - 1];
    for (let i = 0; i < remaining.length; i++) {
      const node = remaining[i];
      const nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
      visit(path.concat(node), nextRemaining, cost + matrix[current][node]);
    }
  }

  visit([0], nodes, 0);
  return best;
}
