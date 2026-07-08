function getMetrics() {
  const delivered = state.packages.filter(pkg => pkg.status === "Delivered").length;
  const distance = Math.round(state.trucks.reduce((sum, truck) => sum + (truck.route.length > 1 ? routeDistance(truck.route, state.matrix) : 0), 0));
  return {
    delivered,
    onTime: Math.min(98, 86 + Math.round(delivered / Math.max(1, state.packages.length) * 10)),
    distance,
    fuel: Math.round(distance * 7.8),
    revenue: delivered * 85
  };
}

function nearestNode(pos) {
  return state.nodes.slice().sort((a, b) => lrDistance(pos, a) - lrDistance(pos, b))[0];
}

function currentCustomerPackage() {
  return state.packages.find(pkg => pkg.id === state.customerPackageId) || state.packages[0];
}

function customerDistance(pkg, truck) {
  return (lrDistance(truck.pos, state.nodes[pkg.node]) / 85).toFixed(1);
}

function updateDistanceText() {
  const el = document.getElementById("distanceText");
  if (!el) return;
  const pkg = currentCustomerPackage();
  const truck = state.trucks.find(item => item.id === pkg.truckId);
  if (truck) el.textContent = `Driver is ${customerDistance(pkg, truck)} km away.`;
}

function filterPackages() {
  const status = document.getElementById("statusFilter").value;
  const truck = document.getElementById("truckFilter").value;
  const merchant = document.getElementById("merchantFilter").value;
  const area = document.getElementById("areaFilter").value;
  const priority = document.getElementById("priorityFilter").value;
  document.querySelectorAll("#packageTable tbody tr").forEach(row => {
    row.style.display =
      (status === "All Status" || row.dataset.status === status) &&
      (truck === "All Trucks" || row.dataset.truck === truck) &&
      (merchant === "All Companies" || row.dataset.merchant === merchant) &&
      (area === "All Bangalore Areas" || row.dataset.area === area) &&
      (priority === "All Priority" || row.dataset.priority === priority) ? "" : "none";
  });
}

function notify(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;

  let region = document.getElementById("toastRegion");
  if (!region) {
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = text;
  region.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    window.setTimeout(() => toast.remove(), 180);
  }, 3600);
}

// ------------------------------
// Backend integration helpers
// ------------------------------

function normalizeApiBase(base) {
  const raw = String(base || "").trim();
  return raw.replace(/\/+$/, "");
}

function resolveApiUrl(path) {
  const p = String(path || "");
  if (/^https?:\/\//i.test(p)) return p;

  const base = normalizeApiBase(state?.apiBase);
  if (!base) return p;

  if (p.startsWith("/")) return base + p;
  return base + "/" + p;
}

function authHeader() {
  const token = state?.activeUser?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function apiJson(path, { method = "GET", body, includeAuth = true } = {}) {
  const headers = { ...((includeAuth && authHeader()) || {}) };
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(resolveApiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function recomputeRoutingGraph() {
  state.graph = createGraph(state.nodes);
  const fw = floydWarshall(state.graph);
  state.matrix = fw.d;
  state.next = fw.next;
}

function hydrateTruckFromApi(truck, index = 0) {
  const startNode = Number.isFinite(Number(truck.startNode)) ? Number(truck.startNode) : 0;
  const start = state.nodes[startNode] || state.nodes[0];
  const color = (typeof LR_COLORS !== "undefined" && Array.isArray(LR_COLORS))
    ? LR_COLORS[index % LR_COLORS.length]
    : "#0e9f8f";

  return {
    ...truck,
    startNode,
    packages: [],
    route: [startNode],
    routeNames: [start?.name || ""],
    progress: 0,
    segment: 0,
    completedStops: 0,
    pos: { x: start?.x ?? 0, y: start?.y ?? 0 },
    color
  };
}

function mapIncidentFromApi(inc) {
  const created = inc?.createdAt ? new Date(inc.createdAt) : new Date();
  return {
    id: inc.id,
    type: inc.type || "Delay",
    target: inc.truckId || "",
    description: inc.message || "",
    time: created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    resolved: Boolean(inc.resolved)
  };
}

function applyBackendState(db) {
  if (!db) return;

  if (Array.isArray(db.nodes) && db.nodes.length) state.nodes = db.nodes;
  recomputeRoutingGraph();

  if (Array.isArray(db.packages)) state.packages = db.packages;
  if (!state.customerPackageId || !state.packages.some(p => p.id === state.customerPackageId)) {
    state.customerPackageId = state.packages[0]?.id || "";
  }

  if (Array.isArray(db.trucks)) {
    state.trucks = db.trucks.map((t, i) => hydrateTruckFromApi(t, i));
  }

  if (Array.isArray(db.incidents)) {
    state.incidents = db.incidents.map(mapIncidentFromApi);
  }
}

async function refreshFromBackend() {
  const db = await apiJson("/api/state", { method: "GET" });
  state.backendConnected = true;
  applyBackendState(db);
  if (typeof runOptimization === "function") runOptimization();
  return db;
}

function defaultBackendCandidates() {
  const currentOrigin = window.location.origin;
  const currentPort = String(window.location.port || "");
  const host = window.location.hostname || "localhost";

  const candidates = [
    "", // same-origin
  ];

  // If the UI isn't already on 8080, try the default backend port.
  if (currentPort !== "8080") {
    candidates.push(`http://${host}:8080`);
    // Windows/WSL and some setups resolve localhost differently.
    candidates.push("http://localhost:8080");
    candidates.push("http://127.0.0.1:8080");
  }

  // De-duplicate while preserving order.
  const seen = new Set();
  return candidates
    .map(normalizeApiBase)
    .filter(item => {
      const key = item || currentOrigin;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function tryConnectBackend({ candidates } = {}) {
  const prevBase = normalizeApiBase(state?.apiBase);
  const list = Array.isArray(candidates) && candidates.length ? candidates : defaultBackendCandidates();

  for (const base of list) {
    state.apiBase = normalizeApiBase(base);
    try {
      await refreshFromBackend();
      return true;
    } catch {
      // Try next candidate.
    }
  }

  state.apiBase = prevBase;
  state.backendConnected = false;
  return false;
}

Object.assign(window, {
  notify,
  apiJson,
  refreshFromBackend,
  tryConnectBackend,
  applyBackendState,
  resolveApiUrl,
  hydrateTruckFromApi,
  mapIncidentFromApi
});

