function drawVisibleCanvases() {
  const owner = document.getElementById("ownerMap");
  if (owner) drawOwnerMap(owner);
  const customer = document.getElementById("customerMap");
  if (customer) drawCustomerMap(customer);
  const mst = document.getElementById("mstMap");
  if (mst) drawMstNetwork(mst);
  drawCharts();
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height, sx: rect.width / 1000, sy: rect.height / 700 };
}

function drawOwnerMap(canvas) {
  const { ctx, w, h, sx, sy } = setupCanvas(canvas);
  ctx.fillStyle = "#eef7f8";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d6e7ea";
  for (let x = 0; x < w; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  state.graph.forEach((row, i) => row.forEach((value, j) => {
    if (j <= i || value === Infinity || value > 38) return;
    const a = state.nodes[i], b = state.nodes[j];
    ctx.strokeStyle = "rgba(100,116,139,.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x * sx, a.y * sy);
    ctx.lineTo(b.x * sx, b.y * sy);
    ctx.stroke();
  }));
  state.trucks.forEach(truck => {
    ctx.strokeStyle = truck.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    truck.route.forEach((nodeId, index) => {
      const node = state.nodes[nodeId];
      if (index) ctx.lineTo(node.x * sx, node.y * sy);
      else ctx.moveTo(node.x * sx, node.y * sy);
    });
    ctx.stroke();
    ctx.fillStyle = truck.color;
    ctx.beginPath();
    ctx.arc(truck.pos.x * sx, truck.pos.y * sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#172033";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(truck.id, truck.pos.x * sx + 10, truck.pos.y * sy - 10);
  });
  state.nodes.forEach((node, index) => {
    ctx.fillStyle = index === 0 ? "#0e9f8f" : "#d8e5f3";
    ctx.beginPath();
    ctx.arc(node.x * sx, node.y * sy, index === 0 ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (index === 0 || index < 8) {
      ctx.fillStyle = "#475569";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(index === 0 ? "Warehouse" : node.name, node.x * sx + 7, node.y * sy + 4);
    }
  });
}

function drawCustomerMap(canvas) {
  const pkg = currentCustomerPackage();
  const truck = state.trucks.find(item => item.id === pkg.truckId);
  const dest = state.nodes[pkg.node];
  const { ctx, w, h, sx, sy } = setupCanvas(canvas);
  ctx.fillStyle = "#eef7f8";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d3e5e8";
  for (let x = 0; x < w; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  if (truck) {
    ctx.strokeStyle = "#0e9f8f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(truck.pos.x * sx, truck.pos.y * sy);
    ctx.lineTo(dest.x * sx, dest.y * sy);
    ctx.stroke();
    ctx.fillStyle = "#0e9f8f";
    ctx.beginPath();
    ctx.arc(truck.pos.x * sx, truck.pos.y * sy, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(dest.x * sx, dest.y * sy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#172033";
  ctx.font = "13px Inter, sans-serif";
  ctx.fillText(pkg.destination, dest.x * sx + 15, dest.y * sy + 5);
}

/* Draws Prim's MST over the actual city node layout — framed as the
   cheapest possible set of links connecting every area to the network,
   used on the Algorithm Control page's "Optimal Warehouse Network" panel. */
function drawMstNetwork(canvas) {
  const { ctx, w, h, sx, sy } = setupCanvas(canvas);
  ctx.fillStyle = "#eef7f8";
  ctx.fillRect(0, 0, w, h);
  const { edges } = primMST(state.graph, 0);
  ctx.strokeStyle = "#0e9f8f";
  ctx.lineWidth = 2.4;
  edges.forEach(edge => {
    const a = state.nodes[edge.from];
    const b = state.nodes[edge.to];
    ctx.beginPath();
    ctx.moveTo(a.x * sx, a.y * sy);
    ctx.lineTo(b.x * sx, b.y * sy);
    ctx.stroke();
  });
  state.nodes.forEach((node, index) => {
    ctx.fillStyle = index === 0 ? "#0e9f8f" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(node.x * sx, node.y * sy, index === 0 ? 7 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (index === 0 || index < 8) {
      ctx.fillStyle = "#475569";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(index === 0 ? "Warehouse" : node.name, node.x * sx + 7, node.y * sy + 4);
    }
  });
}

/* Generic multi-series line chart used by the Complexity Lab to plot
   empirical runtime (ms) against input size n for several algorithms
   on the same axes, so growth rates can be compared visually. */
function drawBenchmarkChart(canvas, series) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const padding = { left: 36, right: 10, top: 12, bottom: 22 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  const allPoints = series.flatMap(s => s.data);
  const maxN = Math.max(...allPoints.map(p => p.n), 1);
  const maxMs = Math.max(...allPoints.map(p => p.ms), 0.001);

  ctx.strokeStyle = "#dbe3ee";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + plotH);
  ctx.lineTo(padding.left + plotW, padding.top + plotH);
  ctx.stroke();
  ctx.fillStyle = "#617084";
  ctx.font = "9px Inter, sans-serif";
  ctx.fillText(maxMs.toFixed(2) + "ms", 2, padding.top + 8);
  ctx.fillText("0", 2, padding.top + plotH);
  ctx.fillText("n=" + maxN, padding.left + plotW - 24, h - 6);

  series.forEach(s => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((point, index) => {
      const x = padding.left + (point.n / maxN) * plotW;
      const y = padding.top + plotH - (point.ms / maxMs) * plotH;
      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    s.data.forEach(point => {
      const x = padding.left + (point.n / maxN) * plotW;
      const y = padding.top + plotH - (point.ms / maxMs) * plotH;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function drawCharts() {
  drawMatrix(document.getElementById("matrixChart"));
  drawDp(document.getElementById("dpChart"));
  drawTsp(document.getElementById("tspChart"));
  drawLine(document.getElementById("lineChart"));
  drawBar(document.getElementById("barChart"));
  drawHeat(document.getElementById("heatChart"));
  drawDonut(document.getElementById("donutChart"));
}

function chartSetup(canvas) {
  if (!canvas) return null;
  const setup = setupCanvas(canvas);
  setup.ctx.clearRect(0, 0, setup.w, setup.h);
  return setup;
}

function drawMatrix(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const cell = Math.min(w, h) / state.matrix.length;
  for (let i = 0; i < state.matrix.length; i++) {
    for (let j = 0; j < state.matrix.length; j++) {
      ctx.fillStyle = `rgba(14,159,143,${Math.min(.92, state.matrix[i][j] / 90)})`;
      ctx.fillRect(j * cell, i * cell, cell - 1, cell - 1);
    }
  }
}

function drawDp(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const knapItems = state.packages.filter(pkg => pkg.status !== "Delivered" && pkg.status !== "Failed").slice(0, 20);
  const table = knapsack(knapItems, state.weightLimit, state.priorityWeight).dp;
  for (let i = 0; i < table.length; i++) {
    for (let j = 0; j < 30; j++) {
      ctx.fillStyle = `rgba(56,189,248,${Math.min(.9, (table[i][j * 4] || 0) / 240)})`;
      ctx.fillRect(j * w / 30, i * h / table.length, w / 30 - 1, h / table.length - 1);
    }
  }
}

function drawTsp(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const stops = state.trucks[0] ? state.trucks[0].packages.map(pkg => pkg.node) : state.packages.slice(0, 8).map(pkg => pkg.node);
  const unique = [...new Set(stops)].filter(n => n !== 0);
  const labels = ["Greedy", "Held-Karp", "B&B"];
  const values = [
    routeDistance(greedyTsp(stops, state.matrix), state.matrix),
    unique.length <= 13 ? heldKarpTsp(stops, state.matrix).cost : null,
    routeDistance(branchBoundTsp(stops, state.matrix), state.matrix)
  ];
  const maxValue = Math.max(...values.filter(v => v !== null), 1);
  labels.forEach((label, index) => {
    const value = values[index];
    ctx.fillStyle = "#172033";
    ctx.font = "11px Inter, sans-serif";
    if (value === null) {
      ctx.fillText(label + " (n>13)", 20 + index * w / 3, h - 10);
      return;
    }
    const height = Math.max(18, h * (value / maxValue) * .68);
    ctx.fillStyle = LR_COLORS[index];
    ctx.fillRect(25 + index * w / 3, h - height - 28, w / 4, height);
    ctx.fillStyle = "#172033";
    ctx.fillText(`${label}: ${Math.round(value)}`, 20 + index * w / 3, h - 10);
  });
}

function drawLine(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.strokeStyle = "#0e9f8f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  Array.from({ length: 30 }, (_, i) => 20 + Math.sin(i / 3) * 8 + i / 2).forEach((value, index) => {
    const x = index * w / 29;
    const y = h - 25 - value * 3;
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function drawBar(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  LR_AREAS.slice(1, 8).forEach((_, index) => {
    const x = 10 + index * w / 7;
    ctx.fillStyle = "#0e9f8f";
    ctx.fillRect(x, h - 130, w / 18, 95 + index * 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x + w / 18 + 3, h - 65, w / 18, 30 + index * 2);
  });
}

function drawHeat(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h, sx, sy } = setup;
  ctx.fillStyle = "#eef7f8";
  ctx.fillRect(0, 0, w, h);
  state.packages.forEach(pkg => {
    const node = state.nodes[pkg.node];
    const gradient = ctx.createRadialGradient(node.x * sx, node.y * sy, 2, node.x * sx, node.y * sy, 45);
    gradient.addColorStop(0, "rgba(245,158,11,.72)");
    gradient.addColorStop(1, "rgba(245,158,11,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(node.x * sx - 50, node.y * sy - 50, 100, 100);
  });
}

function drawDonut(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const values = [42, 35, 23];
  let start = -Math.PI / 2;
  values.forEach((value, index) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.fillStyle = LR_COLORS[index];
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 3, start, start + Math.PI * 2 * value / 100);
    ctx.fill();
    start += Math.PI * 2 * value / 100;
  });
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 6, 0, Math.PI * 2);
  ctx.fill();
}

