function drawVisibleCanvases() {
  const owner = document.getElementById("ownerMap");
  if (owner) drawOwnerMap(owner);
  const customer = document.getElementById("customerMap");
  if (customer) drawCustomerMap(customer);
  syncBangaloreLeafletMap();
  drawCharts();
}

// --- Leaflet Bangalore map (Owner -> Route Planner) ---

function nodeToLatLng(node) {
  // Project the existing 2D demo coordinates into a rough Bangalore bounding box.
  // This keeps the app offline-data-friendly while giving a real basemap.
  const bounds = {
    latMin: 12.83,
    latMax: 13.15,
    lonMin: 77.45,
    lonMax: 77.78
  };
  const xMin = 70, xMax = 930;
  const yMin = 70, yMax = 620;

  const fx = (node.x - xMin) / (xMax - xMin);
  const fy = (node.y - yMin) / (yMax - yMin);
  const lon = bounds.lonMin + fx * (bounds.lonMax - bounds.lonMin);
  const lat = bounds.latMax - fy * (bounds.latMax - bounds.latMin);
  return [lat, lon];
}

function ensureLeafletMap() {
  const el = document.getElementById("blrMap");
  if (!el) return null;
  if (!window.L) return null;

  if (window.__logirouteLeaflet?.map) {
    // If the app re-rendered, the old element is gone; recreate the map.
    if (window.__logirouteLeaflet.el !== el) {
      try { window.__logirouteLeaflet.map.remove(); } catch { /* ignore */ }
      window.__logirouteLeaflet = null;
    } else {
      return window.__logirouteLeaflet;
    }
  }

  const center = [12.9716, 77.5946];
  const map = window.L.map(el, { zoomControl: true, scrollWheelZoom: true }).setView(center, 11);
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    crossOrigin: true
  }).addTo(map);

  const routesLayer = window.L.layerGroup().addTo(map);
  const markersLayer = window.L.layerGroup().addTo(map);
  const nodesLayer = window.L.layerGroup().addTo(map);

  window.__logirouteLeaflet = {
    el,
    map,
    routesLayer,
    markersLayer,
    nodesLayer,
    warehouseMarker: null,
    truckMarkers: new Map(),
    nodeMarkers: new Map(),
    cache: new Map(),
    lastSignature: "",
    didFit: false
  };

  return window.__logirouteLeaflet;
}

function getLeafletCtx() {
  return window.__logirouteLeaflet?.map ? window.__logirouteLeaflet : null;
}

function blrZoomIn() {
  const ctx = getLeafletCtx();
  if (ctx) ctx.map.zoomIn();
}

function blrZoomOut() {
  const ctx = getLeafletCtx();
  if (ctx) ctx.map.zoomOut();
}

function routeSignature() {
  return state.trucks
    .map(t => `${t.id}:${(t.route || []).join("-")}`)
    .sort()
    .join("|");
}

async function fetchOsrmRoute(latlngs) {
  // OSRM expects lon,lat; use public demo server (good enough for demos).
  const coords = latlngs.map(([lat, lon]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM_${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) throw new Error("OSRM_BAD_GEOMETRY");
  // Convert [lon,lat] -> [lat,lon]
  return coordinates.map(([lon, lat]) => [lat, lon]);
}

function safeColor(color) {
  return typeof color === "string" && color ? color : "#0e9f8f";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truckPopupHtml(truck) {
  const load = (truck.packages || []).reduce((sum, pkg) => sum + (Number(pkg.weight) || 0), 0);
  const nextStopId = Array.isArray(truck.route) ? truck.route[Math.min(truck.segment + 1, truck.route.length - 1)] : null;
  const nextStopName = nextStopId != null ? state.nodes[nextStopId]?.name : "";
  return `
    <div style="min-width:220px">
      <b>${escapeHtml(truck.id)}</b>
      <div class="muted" style="margin-top:4px">${escapeHtml(truck.driver)} • ${escapeHtml(truck.plate)} • ${escapeHtml(truck.vehicleType)}</div>
      <div style="margin-top:6px">Capacity: <b>${escapeHtml(truck.capacity)}</b> kg • Load: <b>${escapeHtml(load)}</b> kg</div>
      <div>Fuel: <b>${escapeHtml(truck.fuel)}</b>% • Status: <b>${escapeHtml(truck.status)}</b></div>
      ${nextStopName ? `<div style="margin-top:6px">Next: <b>${escapeHtml(nextStopName)}</b></div>` : ""}
      <div style="margin-top:6px">Assigned packages: <b>${escapeHtml((truck.packages || []).length)}</b></div>
    </div>`;
}

function nodePopupHtml(nodeId) {
  const node = state.nodes[nodeId];
  if (!node) return "";

  const visits = state.trucks
    .map(truck => {
      const stopIndex = Array.isArray(truck.route) ? truck.route.indexOf(nodeId) : -1;
      if (stopIndex < 0) return null;
      const pkgs = (truck.packages || []).filter(p => p.node === nodeId);
      return { truck, stopIndex, pkgs };
    })
    .filter(Boolean)
    .sort((a, b) => a.stopIndex - b.stopIndex);

  const totalPkgs = visits.reduce((sum, v) => sum + v.pkgs.length, 0);

  return `
    <div style="min-width:240px">
      <b>${escapeHtml(nodeId === 0 ? "Warehouse" : node.name)}</b>
      <div class="muted" style="margin-top:4px">Vehicles serving this node: <b>${escapeHtml(visits.length)}</b> • Packages: <b>${escapeHtml(totalPkgs)}</b></div>
      <div style="margin-top:8px">
        ${visits.length ? visits.map(v => {
          const firstEta = v.pkgs.find(p => p.eta)?.eta || "";
          return `
            <div style="padding:6px 0;border-top:1px solid #dbe3ee">
              <b>${escapeHtml(v.truck.id)}</b> <span class="muted">(${escapeHtml(v.truck.driver)})</span><br>
              <span class="muted">Stop #${escapeHtml(Math.max(1, v.stopIndex))}${firstEta ? ` • ETA ~ ${escapeHtml(firstEta)}` : ""}</span><br>
              ${v.pkgs.length ? `<span class="muted">Packages:</span> ${v.pkgs.slice(0, 6).map(p => `<span style="display:inline-block;margin:2px 6px 0 0">${escapeHtml(p.id)}</span>`).join("")}${v.pkgs.length > 6 ? `<span class="muted">+${escapeHtml(v.pkgs.length - 6)} more</span>` : ""}` : `<span class="muted">No packages assigned here (pass-through)</span>`}
            </div>`;
        }).join("") : `<div style="padding-top:6px" class="muted">No planned vehicles for this node.</div>`}
      </div>
    </div>`;
}

async function drawRoadRoutes(ctx) {
  const { routesLayer, cache } = ctx;
  routesLayer.clearLayers();

  // Keep waypoint count reasonable for the public OSRM server.
  const MAX_WAYPOINTS = 12;

  for (const truck of state.trucks) {
    const route = Array.isArray(truck.route) ? truck.route : [];
    const unique = route.filter((nodeId, index) => index === 0 || nodeId !== route[index - 1]);
    if (unique.length < 2) continue;

    const points = unique
      .slice(0, MAX_WAYPOINTS)
      .map(nodeId => nodeToLatLng(state.nodes[nodeId]));

    const key = `${truck.id}:${points.map(p => p.join(",")).join("|")}`;
    let lineLatLngs = cache.get(key);

    if (!lineLatLngs) {
      try {
        lineLatLngs = await fetchOsrmRoute(points);
        cache.set(key, lineLatLngs);
      } catch {
        // Fallback: straight polyline if OSRM fails.
        lineLatLngs = points;
        cache.set(key, lineLatLngs);
      }
    }

    window.L.polyline(lineLatLngs, {
      color: safeColor(truck.color),
      weight: 4,
      opacity: 0.85
    }).addTo(routesLayer);
  }
}

function syncTruckMarkers(ctx) {
  const { map, markersLayer, truckMarkers } = ctx;

  // Warehouse marker (create once)
  if (!ctx.warehouseMarker) {
    const wh = nodeToLatLng(state.nodes[0]);
    ctx.warehouseMarker = window.L.circleMarker(wh, { radius: 7, color: "#0e9f8f", weight: 2, fillOpacity: 0.9 })
      .addTo(markersLayer)
      .bindTooltip("Warehouse", { permanent: false });
  }

  // Truck markers (create/update)
  const activeIds = new Set(state.trucks.map(t => t.id));
  for (const [id, marker] of truckMarkers.entries()) {
    if (!activeIds.has(id)) {
      marker.remove();
      truckMarkers.delete(id);
    }
  }

  state.trucks.forEach(truck => {
    const pos = nodeToLatLng(truck.pos);
    const existing = truckMarkers.get(truck.id);
    if (existing) {
      existing.setLatLng(pos);
      existing.setPopupContent(truckPopupHtml(truck));
      return;
    }
    const marker = window.L.circleMarker(pos, { radius: 8, color: safeColor(truck.color), weight: 3, fillOpacity: 0.9 });
    marker.addTo(markersLayer)
      .bindTooltip(truck.id, { permanent: false })
      .bindPopup(truckPopupHtml(truck));
    truckMarkers.set(truck.id, marker);
  });

  // Fit bounds once (first time only)
  if (!ctx.didFit) {
    const wh = nodeToLatLng(state.nodes[0]);
    const all = [wh, ...state.trucks.map(t => nodeToLatLng(t.pos))];
    if (all.length >= 2) {
      const bounds = window.L.latLngBounds(all);
      map.fitBounds(bounds.pad(0.2));
      ctx.didFit = true;
    }
  }
}

function syncNodeMarkers(ctx) {
  const { nodesLayer, nodeMarkers } = ctx;

  // Only show nodes that appear in planned routes to avoid clutter.
  const nodeIds = new Set();
  state.trucks.forEach(truck => {
    (truck.route || []).forEach(id => nodeIds.add(id));
    (truck.packages || []).forEach(p => nodeIds.add(p.node));
  });
  nodeIds.delete(0); // warehouse is shown separately

  for (const [id, marker] of nodeMarkers.entries()) {
    if (!nodeIds.has(id)) {
      marker.remove();
      nodeMarkers.delete(id);
    }
  }

  for (const id of nodeIds.values()) {
    if (nodeMarkers.has(id)) {
      nodeMarkers.get(id).setPopupContent(nodePopupHtml(id));
      continue;
    }
    const ll = nodeToLatLng(state.nodes[id]);
    const marker = window.L.circleMarker(ll, { radius: 5, color: "#475569", weight: 1, fillColor: "#ffffff", fillOpacity: 0.85 });
    marker.addTo(nodesLayer)
      .bindTooltip(state.nodes[id]?.name || `Node ${id}`, { permanent: false })
      .bindPopup(nodePopupHtml(id));
    nodeMarkers.set(id, marker);
  }
}

function syncBangaloreLeafletMap() {
  const ctx = ensureLeafletMap();
  if (!ctx) return;

  // Re-render markers frequently (truck animation)
  syncTruckMarkers(ctx);

  // Recompute road routes only when the planned routes change
  const sig = routeSignature();
  if (sig && sig !== ctx.lastSignature) {
    ctx.lastSignature = sig;
    syncNodeMarkers(ctx);
    // Fire and forget; if OSRM is slow, UI still stays responsive.
    drawRoadRoutes(ctx);
  }
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
  const items = state.packages.slice(0, 10);
  const cap = 120;

  // Use a stable reference scale (max priority weight) so the heatmap
  // visibly changes with the slider instead of re-normalizing every time.
  const table = knapsack(items, cap, state.priorityWeight).dp;
  const ref = knapsack(items, cap, 6).dp;

  let maxVal = 0;
  for (const row of ref) {
    for (const v of row) maxVal = Math.max(maxVal, Number(v) || 0);
  }
  if (!maxVal) maxVal = 1;

  for (let i = 0; i < table.length; i++) {
    for (let j = 0; j < 30; j++) {
      const value = table[i][j * 4] || 0;
      const alpha = Math.max(0.04, Math.min(0.9, (value / maxVal) * 0.9));
      ctx.fillStyle = `rgba(56,189,248,${alpha})`;
      ctx.fillRect(j * w / 30, i * h / table.length, w / 30 - 1, h / table.length - 1);
    }
  }
}

function pickTspStops(maxStops = 8) {
  const out = [];
  const seen = new Set([0]);
  const source = (state.trucks[0] && Array.isArray(state.trucks[0].packages) && state.trucks[0].packages.length)
    ? state.trucks[0].packages
    : state.packages;

  for (const pkg of source) {
    const node = Number(pkg.node);
    if (!Number.isFinite(node) || node === 0) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    out.push(node);
    if (out.length >= maxStops) break;
  }

  // Ensure enough unique stops to make Greedy vs B&B visibly different.
  if (out.length < 5) {
    for (let id = 1; id < state.nodes.length && out.length < maxStops; id++) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }

  return out;
}

function drawTsp(canvas) {
  const setup = chartSetup(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;
  const stops = pickTspStops(8);
  const routes = [
    (typeof bruteForceTsp === "function" ? bruteForceTsp(stops, state.matrix, { maxNodes: 8 }) : branchBoundTsp(stops, state.matrix)),
    greedyTsp(stops, state.matrix),
    branchBoundTsp(stops, state.matrix)
  ];
  const values = routes.map(r => routeDistance(r, state.matrix));

  // Scale to the observed range so small improvements are visible.
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1e-6, max - min);

  ["Brute", "Greedy", "B&B"].forEach((label, index) => {
    const scaled = (values[index] - min) / range; // 0..1
    const height = Math.max(18, 18 + (h - 55) * scaled);
    ctx.fillStyle = LR_COLORS[index];
    ctx.fillRect(25 + index * w / 3, h - height - 28, w / 4, height);
    ctx.fillStyle = "#172033";
    ctx.fillText(label, 25 + index * w / 3, h - 10);
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

