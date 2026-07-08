function renderOwner() {
  const nav = ["Dashboard", "Fleet Management", "Package Manager", "Route Planner", "Fleet Optimization", "Algorithm Control", "Complexity Lab", "Analytics", "Incident Reports"];
  app.innerHTML = `
    <section class="app-shell">
      ${topbar("owner")}
      <div class="layout">
        <aside class="sidebar">${nav.map(name => `<button class="nav-link ${state.ownerPage === name ? "active" : ""}" onclick="routeTo('owner','${name}')">${name}</button>`).join("")}</aside>
        <main class="main">${ownerPage()}</main>
      </div>
    </section>`;
  drawVisibleCanvases();
}

function topbar(role) {
  return `
    <header class="topbar">
      <button class="brand" onclick="routeTo('landing')"><span class="logo-mark">LR</span>LogiRoute</button>
      <span class="muted">${role === "owner" ? "SwiftHaul Logistics" : "Customer Portal"} - ${state.activeUser ? state.activeUser.id : "Guest"}</span>
      <span class="topbar-spacer"></span>
      ${role === "owner" ? `<span class="badge">${state.incidents.filter(i => !i.resolved).length}</span>` : ""}
      ${role === "customer" ? `<button class="btn" onclick="routeTo('account')">Account</button>` : ""}
      <button class="btn" onclick="logout()">Logout</button>
    </header>`;
}

function ownerPage() {
  if (state.ownerPage === "Dashboard") return dashboardPage();
  if (state.ownerPage === "Fleet Management") return fleetPage();
  if (state.ownerPage === "Package Manager") return packagePage();
  if (state.ownerPage === "Route Planner") return routePlannerPage();
  if (state.ownerPage === "Fleet Optimization") return fleetOptimizationPage();
  if (state.ownerPage === "Algorithm Control") return algorithmPage();
  if (state.ownerPage === "Complexity Lab") return complexityLabPage();
  if (state.ownerPage === "Analytics") return analyticsPage();
  return incidentsPage();
}

function dashboardPage() {
  const metrics = getMetrics();
  return `
    <div class="page-head">
      <div><h2>Command Center</h2><div class="muted">Add fleet details first, then deploy route plans.</div></div>
      <button class="btn primary" onclick="runOptimization()">Generate Routes</button>
    </div>
    <div class="grid metrics">
      ${metric("Deliveries Today", `${metrics.delivered} / ${state.packages.length}`)}
      ${metric("On-Time Rate", `${metrics.onTime}%`)}
      ${metric("Active Trucks", state.trucks.length)}
      ${metric("Total Distance", `${metrics.distance} km`)}
      ${metric("Fuel Cost", `Rs ${metrics.fuel}`)}
      ${metric("Revenue", `Rs ${metrics.revenue}`)}
    </div>
    ${state.trucks.length ? `
      <div class="dashboard-grid">
        <section class="card map-panel"><div class="panel-title"><h3>Operations Map</h3><span class="muted">Owner-created fleet only</span></div><div class="map-canvas"><canvas id="ownerMap"></canvas></div></section>
        <div class="side-stack">
          <section class="card"><div class="panel-title"><h3>Fleet Status</h3><button class="btn" onclick="routeTo('owner','Fleet Management')">Manage</button></div>${fleetMinis()}</section>
          <section class="card"><div class="panel-title"><h3>Incidents</h3><button class="btn" onclick="createIncident()">Simulate</button></div>${incidentList(4)}</section>
        </div>
      </div>` : emptyFleetNotice()}
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function emptyFleetNotice() {
  return `
    <section class="card" style="padding:24px">
      <h3>No vehicles added yet</h3>
      <p class="muted">The system will not create trucks automatically. Add driver and truck details in Fleet Management, then generate routes.</p>
      <button class="btn primary" onclick="routeTo('owner','Fleet Management')">Add First Vehicle</button>
    </section>`;
}

function fleetPage() {
  return `
    <div class="page-head">
      <div><h2>Fleet Management</h2><div class="muted">Owner manually adds every driver, vehicle, and capacity.</div></div>
    </div>
    <div class="split">
      <section class="card" style="padding:16px">
        <h3>Add Vehicle and Driver</h3>
        <form class="form-grid" onsubmit="addTruck(event)">
          <label class="field">Truck ID<input id="truckId" required placeholder="TRK-101"></label>
          <label class="field">License Plate<input id="plate" required placeholder="KA 05 LR 4300"></label>
          <label class="field">Driver Name<input id="driverName" required placeholder="Aarav Kumar"></label>
          <label class="field">Driver Mobile<input id="driverMobile" required inputmode="numeric" placeholder="9876500000"></label>
          <label class="field">Driver Email<input id="driverEmail" required type="email" placeholder="driver@company.com"></label>
          <label class="field">Vehicle Type<select id="vehicleType"><option>Mini Truck</option><option>Van</option><option>Bike</option><option>EV Cargo</option><option>Refrigerated Van</option></select></label>
          <label class="field">Capacity kg<input id="capacity" required type="number" min="50" value="500"></label>
          <label class="field">Fuel Level %<input id="fuel" required type="number" min="0" max="100" value="85"></label>
          <label class="field full">Starting Location<select id="startNode">${state.nodes.map(node => `<option value="${node.id}">${node.name}</option>`).join("")}</select></label>
          <button class="btn primary full">Add Vehicle</button>
        </form>
      </section>
      <section class="card table-wrap">
        <table>
          <thead><tr><th>Truck ID</th><th>Driver</th><th>Contact</th><th>Vehicle</th><th>Plate</th><th>Capacity</th><th>Fuel</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${state.trucks.length ? state.trucks.map(truckRow).join("") : `<tr><td colspan="9">No vehicles added. Use the form on the left.</td></tr>`}</tbody>
        </table>
      </section>
    </div>`;
}

function truckRow(truck) {
  return `
    <tr>
      <td>${truck.id}</td><td>${truck.driver}</td><td>${truck.mobile}<br><span class="muted">${truck.email}</span></td><td>${truck.vehicleType}</td><td>${truck.plate}</td>
      <td>${truck.capacity} kg</td><td>${truck.fuel}%</td><td><span class="pill green">${truck.status}</span></td>
      <td><div class="action-row"><button class="btn" onclick="selectTruck('${truck.id}')">View</button><button class="btn danger" onclick="removeTruck('${truck.id}')">Delete</button></div></td>
    </tr>`;
}

function addTruck(event) {
  event.preventDefault();
  const id = document.getElementById("truckId").value.trim();
  if (state.trucks.some(truck => truck.id.toLowerCase() === id.toLowerCase())) {
    alert("Truck ID already exists.");
    return;
  }
  const startNode = Number(document.getElementById("startNode").value);
  const start = state.nodes[startNode];
  state.trucks.push({
    id,
    plate: document.getElementById("plate").value.trim(),
    driver: document.getElementById("driverName").value.trim(),
    mobile: document.getElementById("driverMobile").value.trim(),
    email: document.getElementById("driverEmail").value.trim(),
    vehicleType: document.getElementById("vehicleType").value,
    capacity: Number(document.getElementById("capacity").value),
    fuel: Number(document.getElementById("fuel").value),
    status: "Active",
    packages: [],
    route: [startNode],
    routeNames: [start.name],
    progress: 0,
    segment: 0,
    completedStops: 0,
    pos: { x: start.x, y: start.y },
    color: LR_COLORS[state.trucks.length % LR_COLORS.length]
  });
  runOptimization();
  render();
}

function removeTruck(id) {
  state.trucks = state.trucks.filter(truck => truck.id !== id);
  state.packages.forEach(pkg => {
    if (pkg.truckId === id) {
      pkg.truckId = "";
      pkg.status = "Pending";
      pkg.eta = "";
    }
  });
  runOptimization();
  render();
}

function selectTruck(id) {
  state.selectedTruck = id;
  routeTo("owner", "Dashboard");
}

function packagePage() {
  const editing = state.packages.find(pkg => pkg.id === state.editingPackageId);
  return `
    <div class="page-head"><div><h2>Package Manager</h2><div class="muted">Add, edit, delete, filter, and assign ecommerce deliveries.</div></div><button class="btn primary" onclick="resetPackageForm()">New Package</button></div>
    <div class="split">
      <section class="card" style="padding:16px">
        <h3>${editing ? "Edit Package" : "Add Package"}</h3>
        <p class="form-note">Packages can come from Amazon, Flipkart, Myntra, BigBasket, Zepto, local stores, or any custom merchant.</p>
        <form class="form-grid" onsubmit="savePackage(event)">
          <label class="field">Merchant / Company<select id="pkgMerchant">${LR_MERCHANTS.map(name => `<option ${editing && editing.merchant === name ? "selected" : ""}>${name}</option>`).join("")}</select></label>
          <label class="field">Package ID<input id="pkgId" required ${editing ? "readonly" : ""} value="${editing ? editing.id : "LR" + (24000 + state.packages.length)}"></label>
          <label class="field">Recipient Name<input id="pkgRecipient" required value="${editing ? editing.recipient : ""}" placeholder="Customer name"></label>
          <label class="field">Customer Email<input id="pkgEmail" type="email" required value="${editing ? editing.email : ""}" placeholder="customer@email.com"></label>
          <label class="field">Customer Mobile<input id="pkgPhone" required inputmode="numeric" value="${editing ? editing.phone : ""}" placeholder="9876500000"></label>
          <label class="field">Destination<select id="pkgNode">${state.nodes.slice(1).map(node => `<option value="${node.id}" ${editing && editing.node === node.id ? "selected" : ""}>${node.name}</option>`).join("")}</select></label>
          <label class="field">Weight kg<input id="pkgWeight" required type="number" min="1" value="${editing ? editing.weight : 12}"></label>
          <label class="field">Volume L<input id="pkgVolume" required type="number" min="1" value="${editing ? editing.volume : 10}"></label>
          <label class="field">Priority<select id="pkgPriority"><option ${editing && editing.priority === "Normal" ? "selected" : ""}>Normal</option><option ${editing && editing.priority === "Urgent" ? "selected" : ""}>Urgent</option></select></label>
          <label class="field">Status<select id="pkgStatus"><option ${editing && editing.status === "Pending" ? "selected" : ""}>Pending</option><option ${editing && editing.status === "In Transit" ? "selected" : ""}>In Transit</option><option ${editing && editing.status === "Delivered" ? "selected" : ""}>Delivered</option><option ${editing && editing.status === "Failed" ? "selected" : ""}>Failed</option><option ${editing && editing.status === "Delayed" ? "selected" : ""}>Delayed</option><option ${editing && editing.status === "Returned to Origin" ? "selected" : ""}>Returned to Origin</option></select></label>
          <label class="field full">Special Instructions<textarea id="pkgInstructions" class="textarea" placeholder="Leave at gate, call before arriving, fragile, etc.">${editing ? editing.instructions : ""}</textarea></label>
          <div class="action-row full"><button class="btn primary">${editing ? "Update Package" : "Add Package"}</button>${editing ? `<button type="button" class="btn" onclick="resetPackageForm()">Cancel Edit</button>` : ""}</div>
        </form>
      </section>
      <section>
        <div class="toolbar">
          <select id="statusFilter" onchange="filterPackages()"><option>All Status</option><option>Pending</option><option>In Transit</option><option>Delivered</option><option>Failed</option><option>Delayed</option><option>Returned to Origin</option></select>
          <select id="truckFilter" onchange="filterPackages()"><option>All Trucks</option>${state.trucks.map(truck => `<option>${truck.id}</option>`).join("")}<option>Unassigned</option></select>
          <select id="merchantFilter" onchange="filterPackages()"><option>All Companies</option>${LR_MERCHANTS.map(name => `<option>${name}</option>`).join("")}</select>
          <select id="areaFilter" onchange="filterPackages()"><option>All Bangalore Areas</option>${state.nodes.slice(1).map(node => `<option>${node.name}</option>`).join("")}</select>
          <select id="priorityFilter" onchange="filterPackages()"><option>All Priority</option><option>Urgent</option><option>Normal</option></select>
        </div>
        <section class="card table-wrap"><table id="packageTable">
          <thead><tr><th>Package ID</th><th>Company</th><th>Recipient</th><th>Destination</th><th>Weight</th><th>Priority</th><th>Truck</th><th>Status</th><th>ETA</th><th>Actions</th></tr></thead>
          <tbody>${state.packages.map(packageRow).join("")}</tbody>
        </table></section>
      </section>
    </div>`;
}

function packageRow(pkg) {
  const statusClass = pkg.status === "Delivered" ? "green"
    : pkg.status === "Failed" || pkg.status === "Returned to Origin" ? "red"
    : pkg.status === "Delayed" || pkg.status === "Pending" ? "amber"
    : "blue";
  return `
    <tr data-status="${pkg.status}" data-truck="${pkg.truckId || "Unassigned"}" data-priority="${pkg.priority}" data-merchant="${pkg.merchant}" data-area="${pkg.destination}">
      <td>${pkg.id}</td><td>${pkg.merchant}</td><td>${pkg.recipient}<br><span class="muted">${pkg.email || ""}</span></td><td>${pkg.destination}</td><td>${pkg.weight} kg</td>
      <td><span class="pill ${pkg.priority === "Urgent" ? "red" : "green"}">${pkg.priority}</span></td>
      <td>${pkg.truckId || "Unassigned"}</td><td><span class="pill ${statusClass}" title="${pkg.deliveryNote || ""}">${pkg.status}</span></td><td>${pkg.eta || "--"}</td>
      <td><div class="action-row">
        <button class="btn" onclick="editPackage('${pkg.id}')">Edit</button>
        <button class="btn danger" onclick="deletePackage('${pkg.id}')">Delete</button>
        <select onchange="simulateOutcome('${pkg.id}', this.value)" title="Force a delivery outcome for demo purposes">
          <option value="">Simulate...</option>
          <option value="Delivered">Force Deliver</option>
          <option value="Failed">Force Fail</option>
          <option value="Delayed">Force Delay</option>
          <option value="Returned to Origin">Force Return</option>
        </select>
      </div></td>
    </tr>`;
}

function savePackage(event) {
  event.preventDefault();
  const node = Number(document.getElementById("pkgNode").value);
  const id = document.getElementById("pkgId").value.trim();
  const existing = state.packages.find(pkg => pkg.id === id);
  if (!state.editingPackageId && existing) {
    alert("Package ID already exists.");
    return;
  }
  const payload = {
    id,
    merchant: document.getElementById("pkgMerchant").value,
    recipient: document.getElementById("pkgRecipient").value.trim(),
    email: document.getElementById("pkgEmail").value.trim(),
    phone: document.getElementById("pkgPhone").value.trim(),
    node,
    destination: state.nodes[node].name,
    weight: Number(document.getElementById("pkgWeight").value),
    volume: Number(document.getElementById("pkgVolume").value),
    priority: document.getElementById("pkgPriority").value,
    status: document.getElementById("pkgStatus").value,
    deadline: lrTimeFromMinutes(360),
    eta: existing ? existing.eta : "",
    truckId: existing ? existing.truckId : "",
    dependsOn: existing ? existing.dependsOn : [],
    instructions: document.getElementById("pkgInstructions").value.trim()
  };
  if (existing) Object.assign(existing, payload);
  else state.packages.push(payload);
  state.editingPackageId = null;
  runOptimization();
}

function editPackage(id) {
  state.editingPackageId = id;
  render();
}

function deletePackage(id) {
  if (!confirm("Delete this package from today's operation?")) return;
  state.packages = state.packages.filter(pkg => pkg.id !== id);
  state.trucks.forEach(truck => {
    truck.packages = truck.packages.filter(pkg => pkg.id !== id);
  });
  if (state.customerPackageId === id) state.customerPackageId = state.packages[0] ? state.packages[0].id : "";
  state.editingPackageId = null;
  runOptimization();
}

function resetPackageForm() {
  state.editingPackageId = null;
  render();
}

function fleetOptimizationPage() {
  if (!state.trucks.length) {
    return `<div class="page-head"><div><h2>Fleet Optimization</h2><div class="muted">Add a vehicle first so there's a fleet to optimize.</div></div></div>${emptyFleetNotice()}`;
  }

  const routable = state.packages.filter(pkg => !["Delivered", "Returned to Origin"].includes(pkg.status));
  const demand = {};
  routable.forEach(pkg => { demand[pkg.node] = (demand[pkg.node] || 0) + pkg.weight; });
  const stops = [...new Set(routable.map(pkg => pkg.node))];
  const avgCapacity = Math.round(state.trucks.reduce((sum, t) => sum + t.capacity, 0) / state.trucks.length) || state.weightLimit;
  const vrp = stops.length ? clarkeWrightVRP(stops, demand, state.matrix, avgCapacity) : { routes: [], totalDistance: 0, vehiclesUsed: 0 };
  const currentFleetDistance = Math.round(state.trucks.reduce((sum, t) => sum + (t.route.length > 1 ? routeDistance(t.route, state.matrix) : 0), 0));
  const vrpSavingsPct = currentFleetDistance > 0 ? ((currentFleetDistance - vrp.totalDistance) / currentFleetDistance * 100) : 0;

  const activeTruck = state.trucks.find(t => t.route && t.route.length > 2) || state.trucks[0];
  const hasRoute = activeTruck && activeTruck.route && activeTruck.route.length > 2;

  let twoOptHtml = `<p class="muted">Generate routes on the Route Planner first, then come back here to see the 2-opt improvement pass.</p>`;
  let deadlineHtml = `<p class="muted">Generate routes on the Route Planner first, then come back here to see deadline feasibility.</p>`;

  if (hasRoute) {
    const truckStops = [...new Set(activeTruck.packages.map(p => p.node))];
    const greedyRoute = greedyTsp(truckStops, state.matrix);
    const twoOptOnGreedy = twoOptImprove(greedyRoute, state.matrix);
    const twoOptOnCurrent = twoOptImprove(activeTruck.route, state.matrix);

    twoOptHtml = `
      <p class="muted" style="font-size:13px">Truck <b>${activeTruck.id}</b> — Greedy construction: <b>${Math.round(twoOptOnGreedy.startCost)}</b> &rarr; after 2-opt: <b>${Math.round(twoOptOnGreedy.endCost)}</b> (${twoOptOnGreedy.improvementPct.toFixed(1)}% shorter, ${twoOptOnGreedy.passes} pass${twoOptOnGreedy.passes === 1 ? "" : "es"}).</p>
      <p class="muted" style="font-size:13px">Applying 2-opt to the truck's <b>currently active (${state.tspMode})</b> route: ${Math.round(twoOptOnCurrent.startCost)} &rarr; ${Math.round(twoOptOnCurrent.endCost)} (${twoOptOnCurrent.improvementPct.toFixed(1)}% change)${state.tspMode !== "Greedy" ? " — near 0% is expected here, since it confirms the current method already found a locally-optimal (or exactly optimal) tour." : ""}</p>`;

    const packagesByNode = {};
    activeTruck.packages.forEach(pkg => { packagesByNode[pkg.node] = pkg; });
    const currentFeasibility = checkDeadlineFeasibility(activeTruck.route, state.matrix, packagesByNode, 0, 8);
    const edfRoute = earliestDeadlineFirstRoute(truckStops, state.matrix, packagesByNode);
    const edfFeasibility = checkDeadlineFeasibility(edfRoute, state.matrix, packagesByNode, 0, 8);
    const currentDistance = routeDistance(activeTruck.route, state.matrix);
    const edfDistance = routeDistance(edfRoute, state.matrix);

    deadlineHtml = `
      <p class="muted" style="font-size:13px">Truck <b>${activeTruck.id}</b>, distance-optimal (${state.tspMode}) route: <b>${currentFeasibility.onTime}</b> on-time / <b>${currentFeasibility.missed}</b> missed, total distance <b>${Math.round(currentDistance)}</b>.</p>
      <p class="muted" style="font-size:13px">Same stops, Earliest-Deadline-First order: <b>${edfFeasibility.onTime}</b> on-time / <b>${edfFeasibility.missed}</b> missed, total distance <b>${Math.round(edfDistance)}</b>.</p>
      <p class="muted" style="font-size:13px">${edfFeasibility.missed < currentFeasibility.missed
        ? "EDF reduces missed deadlines here, at the cost of extra total distance — a real dispatch trade-off between on-time rate and fuel/time efficiency."
        : edfFeasibility.missed > currentFeasibility.missed
          ? "EDF actually misses more deadlines here — ordering purely by deadline while ignoring geography increased total travel time enough to make lateness worse overall. This is a genuine, honest result: neither objective (distance vs. deadlines) dominates the other in isolation."
          : "Both orderings hit the same number of deadlines here; the distance-optimal route achieves it with less total travel."}</p>`;
  }

  return `
    <div class="page-head"><div><h2>Fleet Optimization</h2><div class="muted">Coordinated, multi-vehicle route construction — addressing what independent per-truck TSP can't.</div></div></div>
    <div class="grid chart-grid">
      <section class="card chart-box" style="height:auto">
        <h3>Clarke-Wright Savings Algorithm (Capacitated VRP)</h3>
        <p class="muted" style="font-size:13px">Builds routes for the <b>whole fleet jointly</b> instead of assigning packages truck-by-truck then solving each truck's TSP alone. Using average truck capacity (${avgCapacity} kg) as the constraint:</p>
        <p class="muted" style="font-size:13px">Jointly-optimized: <b>${vrp.vehiclesUsed}</b> vehicle route${vrp.vehiclesUsed === 1 ? "" : "s"}, total distance <b>${Math.round(vrp.totalDistance)}</b> &nbsp;|&nbsp; Current fleet (independent per-truck routing): total distance <b>${currentFleetDistance}</b> across ${state.trucks.length} truck${state.trucks.length === 1 ? "" : "s"}.</p>
        <p class="muted" style="font-size:13px">${vrpSavingsPct > 0 ? `Joint optimization would save roughly <b>${vrpSavingsPct.toFixed(1)}%</b> total distance versus the current independent routing.` : "Vehicle counts and capacities differ between the two approaches here, so treat this as a structural comparison rather than a direct percentage — the point is that routing is being solved for the fleet as a whole, not truck-by-truck."}</p>
      </section>

      <section class="card chart-box" style="height:auto">
        <h3>2-opt Local Search</h3>
        ${twoOptHtml}
      </section>

      <section class="card chart-box" style="height:auto">
        <h3>Deadline Feasibility (Earliest-Deadline-First)</h3>
        ${deadlineHtml}
      </section>
    </div>`;
}

function routePlannerPage() {
  return `
    <div class="page-head"><div><h2>Route Planner</h2><div class="muted">Routes can be generated only for vehicles added by the owner.</div></div><button class="btn primary" onclick="runOptimization()">Generate Optimal Routes</button></div>
    ${state.trucks.length ? `<div class="dashboard-grid"><section class="card map-panel"><div class="panel-title"><h3>Planned Routes</h3><span class="muted">${state.tspMode}</span></div><div class="map-canvas"><canvas id="ownerMap"></canvas></div></section><section class="card"><div class="panel-title"><h3>Route Summary</h3></div>${fleetMinis()}</section></div>` : emptyFleetNotice()}`;
}

function algorithmPage() {
  const knapItems = state.packages.filter(pkg => pkg.status !== "Delivered" && pkg.status !== "Failed").slice(0, 20);
  const dpResult = knapsack(knapItems, state.weightLimit, state.priorityWeight);
  const fracResult = fractionalKnapsack(knapItems, state.weightLimit, state.priorityWeight);
  const gap = fracResult.totalValue - dpResult.totalValue;

  const dijkstraSourceName = state.nodes[0].name;
  const dijkstraTiming = measureMs(() => dijkstra(state.graph, 0));
  const fwRowTiming = measureMs(() => floydWarshall(state.graph));
  const dijkstraResult = dijkstra(state.graph, 0);
  const rowsMatch = state.matrix[0].every((value, i) => Math.abs(value - dijkstraResult.dist[i]) < 1e-6);

  const mst = primMST(state.graph, 0);

  const stops = state.trucks[0] ? state.trucks[0].packages.map(pkg => pkg.node) : state.packages.slice(0, 8).map(pkg => pkg.node);
  const uniqueStops = [...new Set(stops)].filter(n => n !== 0);
  const bbStats = branchBoundTsp.lastStats || { nodesExplored: 0, nodesPruned: 0 };

  return `
    <div class="page-head"><div><h2>Algorithm Control</h2><div class="muted">Every panel here runs the real algorithm live on the current data, not a canned demo.</div></div></div>
    <div class="grid chart-grid">
      <section class="card chart-box">
        <h3>0/1 Knapsack (DP) vs Fractional Knapsack (Greedy)</h3>
        <label class="field">Priority weight ${state.priorityWeight}x<input type="range" min="1" max="6" value="${state.priorityWeight}" oninput="state.priorityWeight=Number(this.value); runOptimization()"></label>
        <canvas id="dpChart" class="tiny-canvas"></canvas>
        <p class="muted" style="font-size:13px;margin-top:8px">0/1 DP optimum: <b>${Math.round(dpResult.totalValue)}</b> value &nbsp;|&nbsp; Fractional greedy: <b>${Math.round(fracResult.totalValue)}</b> value (+${Math.round(gap)}, only achievable by splitting a package, which isn't physically valid — this is why 0/1 DP is the correct model here even though greedy scores higher).</p>
      </section>

      <section class="card chart-box">
        <h3>Floyd-Warshall vs Dijkstra</h3>
        <canvas id="matrixChart" class="tiny-canvas"></canvas>
        <p class="muted" style="font-size:13px;margin-top:8px">All-pairs (Floyd-Warshall, ${fwRowTiming.toFixed(2)}ms) vs single-source from ${dijkstraSourceName} (Dijkstra, ${dijkstraTiming.toFixed(2)}ms). Row 0 of both ${rowsMatch ? "match exactly" : "differ — check graph weights"}. Dijkstra is faster per source; Floyd-Warshall is cheaper overall once you need every source, which the fleet does.</p>
      </section>

      <section class="card chart-box">
        <h3>Optimal Warehouse Network (Prim's MST)</h3>
        <div class="map-canvas" style="height:220px"><canvas id="mstMap"></canvas></div>
        <p class="muted" style="font-size:13px;margin-top:8px">Cheapest set of links connecting all ${state.nodes.length} areas with no cycles: <b>${mst.edges.length}</b> edges, total weight <b>${Math.round(mst.totalWeight)}</b>.</p>
      </section>

      <section class="card chart-box">
        <h3>TSP: Greedy vs Held-Karp (exact) vs Branch &amp; Bound</h3>
        <div class="toolbar">
          <button class="btn ${state.tspMode === "Greedy" ? "primary" : ""}" onclick="state.tspMode='Greedy'; runOptimization()">Greedy</button>
          <button class="btn ${state.tspMode === "Held-Karp" ? "primary" : ""}" onclick="state.tspMode='Held-Karp'; runOptimization()">Held-Karp</button>
          <button class="btn ${state.tspMode === "Branch and Bound" ? "primary" : ""}" onclick="state.tspMode='Branch and Bound'; runOptimization()">Branch and Bound</button>
        </div>
        <canvas id="tspChart" class="tiny-canvas"></canvas>
        <p class="muted" style="font-size:13px;margin-top:8px">Currently applied to routes: <b>${state.tspMode}</b>. Branch &amp; Bound on this stop set explored <b>${bbStats.nodesExplored}</b> partial routes and pruned <b>${bbStats.nodesPruned}</b> of them using an MST lower bound${uniqueStops.length > 13 ? "" : " — Held-Karp above confirms the provably optimal cost for comparison"}.</p>
      </section>

      <section class="card chart-box"><h3>Topological Sort (delivery dependencies)</h3>${topoSort(state.packages).ordered.slice(0, 8).map((pkg, i) => `<div class="item">${i + 1}. ${pkg.id} <span class="muted">${pkg.dependsOn.length ? "after " + pkg.dependsOn.join(", ") : "no dependency"}</span></div>`).join("")}</section>
    </div>`;
}

function complexityLabPage() {
  const results = state.benchmarks;
  const groups = [
    { title: "All-Pairs / Single-Source / MST Family — O(V^2) to O(V^3)", keys: ["Floyd-Warshall", "Dijkstra", "Prim's MST"], colors: [LR_COLORS[0], LR_COLORS[1], LR_COLORS[3]] },
    { title: "Knapsack Family — DP O(nW) vs Greedy O(n log n)", keys: ["0/1 Knapsack", "Fractional Knapsack"], colors: [LR_COLORS[0], LR_COLORS[2]] },
    { title: "TSP Family — Greedy O(n^2) vs Exact/Exponential", keys: ["Greedy TSP", "Held-Karp TSP", "Branch and Bound TSP"], colors: [LR_COLORS[0], LR_COLORS[1], LR_COLORS[4]] },
    { title: "Topological Sort — O(V + E)", keys: ["Topological Sort"], colors: [LR_COLORS[0]] }
  ];
  return `
    <div class="page-head">
      <div><h2>Complexity Lab</h2><div class="muted">Runs each algorithm on synthetic inputs of growing size and times it, so the theoretical Big-O below is backed by real measurements.</div></div>
      <button class="btn primary" onclick="runBenchmarks()">${state.benchmarkStatus === "running" ? "Running..." : "Run Benchmarks"}</button>
    </div>
    <section class="card table-wrap" style="margin-bottom:14px">
      <table>
        <thead><tr><th>Algorithm</th><th>Problem</th><th>Technique</th><th>Time Complexity</th><th>Space Complexity</th></tr></thead>
        <tbody>${LR_BIG_O.map(row => `<tr><td>${row.name}</td><td>${row.category}</td><td>${row.technique}</td><td>${row.time}</td><td>${row.space}</td></tr>`).join("")}</tbody>
      </table>
    </section>
    ${results ? `
      <div class="grid chart-grid">
        ${groups.map(group => `
          <section class="card chart-box">
            <h3>${group.title}</h3>
            <canvas id="bench_${group.keys[0].replace(/[^a-zA-Z0-9]/g, "")}" class="tiny-canvas"></canvas>
            <p class="muted" style="font-size:12px;margin-top:8px">${group.keys.map((key, i) => `<span style="color:${group.colors[i]}">&#9632;</span> ${key}`).join(" &nbsp; ")}</p>
          </section>`).join("")}
      </div>
      <p class="muted" style="margin-top:10px;font-size:13px">Timings are measured in-browser with performance.now() on randomly generated inputs (see assets/js/benchmarks.js), so exact numbers vary by device — what matters for a DAA writeup is the shape of the curve, not the absolute milliseconds.</p>
    ` : `<section class="card" style="padding:24px"><p class="muted">Click "Run Benchmarks" to generate the runtime-vs-input-size charts. Exact TSP algorithms (Held-Karp, Branch and Bound) are capped at small input sizes since they are exponential — that cap is itself the point being demonstrated.</p></section>`}
  `;
}

function runBenchmarks() {
  state.benchmarkStatus = "running";
  render();
  setTimeout(() => {
    state.benchmarks = runAllBenchmarks();
    state.benchmarkStatus = "done";
    render();
    drawBenchmarkCharts();
  }, 30);
}

function drawBenchmarkCharts() {
  if (!state.benchmarks) return;
  const groups = [
    { id: "bench_FloydWarshall", keys: ["Floyd-Warshall", "Dijkstra", "Prim's MST"], colors: [LR_COLORS[0], LR_COLORS[1], LR_COLORS[3]] },
    { id: "bench_01Knapsack", keys: ["0/1 Knapsack", "Fractional Knapsack"], colors: [LR_COLORS[0], LR_COLORS[2]] },
    { id: "bench_GreedyTSP", keys: ["Greedy TSP", "Held-Karp TSP", "Branch and Bound TSP"], colors: [LR_COLORS[0], LR_COLORS[1], LR_COLORS[4]] },
    { id: "bench_TopologicalSort", keys: ["Topological Sort"], colors: [LR_COLORS[0]] }
  ];
  groups.forEach(group => {
    const canvas = document.getElementById(group.id);
    if (!canvas) return;
    const series = group.keys.map((key, i) => ({ label: key, color: group.colors[i], data: state.benchmarks[key] || [] }));
    drawBenchmarkChart(canvas, series);
  });
}

function analyticsPage() {
  return `
    <div class="page-head"><div><h2>Analytics</h2><div class="muted">Performance charts update after owner fleet deployment.</div></div></div>
    <div class="grid chart-grid">
      <section class="card chart-box"><h3>Deliveries Per Day</h3><canvas id="lineChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>On-time vs Late</h3><canvas id="barChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>Delivery Density</h3><canvas id="heatChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>Cost Breakdown</h3><canvas id="donutChart" class="tiny-canvas"></canvas></section>
    </div>`;
}

function incidentsPage() {
  return `
    <div class="page-head"><div><h2>Incident Reports</h2><div class="muted">Incidents use owner-added truck IDs when vehicles are available.</div></div><button class="btn primary" onclick="createIncident()">Simulate Incident</button></div>
    <section class="card">${incidentList(20)}</section>`;
}

function runOptimization() {
  const terminalOrHeld = ["Delivered", "Failed", "Delayed", "Returned to Origin"];
  state.packages.forEach(pkg => {
    if (!terminalOrHeld.includes(pkg.status)) {
      pkg.status = "Pending";
      pkg.truckId = "";
      pkg.eta = "";
    }
  });
  state.trucks.forEach(truck => {
    const current = nearestNode(truck.pos).id;
    const held = truck.packages.filter(pkg => terminalOrHeld.includes(pkg.status));
    truck.packages = held;
    truck.route = [current];
    truck.routeNames = [state.nodes[current].name];
    truck.completedStops = held.filter(pkg => pkg.status === "Delivered").length;
  });
  if (!state.trucks.length) {
    drawVisibleCanvases();
    return;
  }
  const unassigned = state.packages.filter(pkg => !terminalOrHeld.includes(pkg.status)).slice().sort((a, b) => (b.priority === "Urgent") - (a.priority === "Urgent"));
  state.trucks.forEach(truck => {
    const { selected } = knapsack(unassigned, truck.capacity, state.priorityWeight);
    truck.packages = truck.packages.concat(selected);
    selected.forEach(pkg => {
      pkg.truckId = truck.id;
      pkg.status = "In Transit";
      const index = unassigned.indexOf(pkg);
      if (index >= 0) unassigned.splice(index, 1);
    });
  });
  state.trucks.forEach(truck => {
    const routablePackages = truck.packages.filter(pkg => !["Delivered", "Returned to Origin"].includes(pkg.status));
    const ordered = topoSort(routablePackages).ordered;
    const stops = ordered.map(pkg => pkg.node);
    const route = state.tspMode === "Greedy" ? greedyTsp(stops, state.matrix)
      : state.tspMode === "Held-Karp" ? heldKarpTsp(stops, state.matrix).route
      : branchBoundTsp(stops, state.matrix);
    truck.route = route;
    truck.routeNames = route.map(node => state.nodes[node].name);
    routablePackages.forEach(pkg => {
      const stopIndex = Math.max(1, route.indexOf(pkg.node));
      pkg.eta = lrTimeFromMinutes(110 + stopIndex * 26);
    });
  });
  render();
}

function fleetMinis() {
  return state.trucks.map(truck => {
    const load = truck.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
    return `
      <div class="item">
        <div class="item-top"><b style="color:${truck.color}">${truck.id}</b><span>${truck.driver}</span></div>
        <div class="muted">${truck.plate} - ${truck.packages.length} assigned packages - ${load}/${truck.capacity} kg</div>
        <div class="progress"><i style="width:${Math.min(100, load / truck.capacity * 100)}%; background:${truck.color}"></i></div>
      </div>`;
  }).join("");
}

function incidentList(limit) {
  if (!state.incidents.length) return `<div class="item"><b>No incidents yet</b><div class="muted">Use Simulate Incident to test the panel.</div></div>`;
  return state.incidents.slice(0, limit).map(incident => `
    <div class="item">
      <b>${incident.type}</b>
      <div>${incident.description}</div>
      <div class="muted">${incident.target} - ${incident.time} - ${incident.resolved ? "Resolved" : "Open"}</div>
      ${incident.resolved ? "" : `<button class="btn" onclick="resolveIncident(${incident.id})">Mark Resolved</button>`}
    </div>`).join("");
}

function createIncident() {
  const type = lrChoice(["Road Block", "Delayed Package", "Truck Stationary"]);
  const truck = state.trucks.length ? lrChoice(state.trucks) : null;
  const pkg = lrChoice(state.packages);
  state.incidents.unshift({
    id: Date.now(),
    type,
    target: type === "Delayed Package" ? pkg.id : truck ? truck.id : "No truck assigned",
    description: type === "Road Block" ? "Road blockage reported near " + lrChoice(LR_AREAS.slice(1)) : type === "Delayed Package" ? pkg.id + " may miss its delivery window" : (truck ? truck.id : "A planned vehicle") + " has been stationary too long",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    resolved: false
  });
  render();
}

function resolveIncident(id) {
  const incident = state.incidents.find(item => item.id === id);
  if (incident) incident.resolved = true;
  render();
}

