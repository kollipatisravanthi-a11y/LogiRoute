function renderOwner() {
  const nav = ["Dashboard", "Fleet Management", "Package Manager", "Route Planner", "Algorithm Control", "Analytics", "Incident Reports"];
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
  if (state.ownerPage === "Algorithm Control") return algorithmPage();
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
        <section class="card map-panel"><div class="panel-title"><h3>Operations Map</h3><span class="muted">Bangalore roads</span></div><div id="blrMap" class="map-canvas"></div></section>
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
      <td>${truck.capacity} kg</td><td>${truck.fuel}%</td><td><span class="pill" style="background:${statusColor(truck.status)};color:#fff;">${truck.status}</span></td>
      <td><div class="action-row"><button class="btn" onclick="selectTruck('${truck.id}')">View</button><button class="btn danger" onclick="removeTruck('${truck.id}')">Delete</button></div></td>
    </tr>`;
}

async function addTruck(event) {
  event.preventDefault();
  const id = document.getElementById("truckId").value.trim();
  if (state.trucks.some(truck => truck.id.toLowerCase() === id.toLowerCase())) {
    notify("Truck ID already exists.", "error");
    return;
  }
  const startNode = Number(document.getElementById("startNode").value);
  const start = state.nodes[startNode];

  const payload = {
    id,
    plate: document.getElementById("plate").value.trim(),
    driver: document.getElementById("driverName").value.trim(),
    mobile: document.getElementById("driverMobile").value.trim(),
    email: document.getElementById("driverEmail").value.trim(),
    vehicleType: document.getElementById("vehicleType").value,
    capacity: Number(document.getElementById("capacity").value),
    fuel: Number(document.getElementById("fuel").value),
    startNode,
    packages: [],
    route: [startNode],
    routeNames: [start.name],
    progress: 0,
    segment: 0,
    completedStops: 0,
    pos: { x: start.x, y: start.y },
    color: LR_COLORS[state.trucks.length % LR_COLORS.length],
    status: "Available"
  };

  if (!state.backendConnected || typeof apiJson !== "function") {
    state.trucks.push(payload);
    runOptimization();
    render();
    return;
  }

  try {
    const created = await apiJson("/api/trucks", { method: "POST", body: payload });
    state.trucks.push(hydrateTruckFromApi(created, state.trucks.length));
    runOptimization();
    render();
  } catch (e) {
    notify(e?.message || "Failed to add truck", "error");
  }
}

async function removeTruck(id) {
  if (!state.backendConnected || typeof apiJson !== "function") {
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
    return;
  }

  try {
    await apiJson(`/api/trucks/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refreshFromBackend();
    render();
  } catch (e) {
    notify(e?.message || "Failed to remove truck", "error");
  }
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
          <label class="field">Status<select id="pkgStatus"><option ${editing && editing.status === "Pending" ? "selected" : ""}>Pending</option><option ${editing && editing.status === "In Transit" ? "selected" : ""}>In Transit</option><option ${editing && editing.status === "Delivered" ? "selected" : ""}>Delivered</option><option ${editing && editing.status === "Failed" ? "selected" : ""}>Failed</option></select></label>
          <label class="field full">Special Instructions<textarea id="pkgInstructions" class="textarea" placeholder="Leave at gate, call before arriving, fragile, etc.">${editing ? editing.instructions : ""}</textarea></label>
          <div class="action-row full"><button class="btn primary">${editing ? "Update Package" : "Add Package"}</button>${editing ? `<button type="button" class="btn" onclick="resetPackageForm()">Cancel Edit</button>` : ""}</div>
        </form>
      </section>
      <section>
        <div class="toolbar">
          <select id="statusFilter" onchange="filterPackages()"><option>All Status</option><option>Pending</option><option>In Transit</option><option>Delivered</option><option>Failed</option></select>
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
  const statusClass = pkg.status === "Delivered" ? "green" : pkg.status === "Pending" ? "amber" : pkg.status === "Failed" ? "red" : "blue";
  return `
    <tr data-status="${pkg.status}" data-truck="${pkg.truckId || "Unassigned"}" data-priority="${pkg.priority}" data-merchant="${pkg.merchant}" data-area="${pkg.destination}">
      <td>${pkg.id}</td><td>${pkg.merchant}</td><td>${pkg.recipient}<br><span class="muted">${pkg.email || ""}</span></td><td>${pkg.destination}</td><td>${pkg.weight} kg</td>
      <td><span class="pill ${pkg.priority === "Urgent" ? "red" : "green"}">${pkg.priority}</span></td>
      <td>${pkg.truckId || "Unassigned"}</td><td><span class="pill ${statusClass}">${pkg.status}</span></td><td>${pkg.eta || "--"}</td>
      <td><div class="action-row"><button class="btn" onclick="editPackage('${pkg.id}')">Edit</button><button class="btn danger" onclick="deletePackage('${pkg.id}')">Delete</button></div></td>
    </tr>`;
}

async function savePackage(event) {
  event.preventDefault();
  const node = Number(document.getElementById("pkgNode").value);
  const id = document.getElementById("pkgId").value.trim();
  const existing = state.packages.find(pkg => pkg.id === id);
  if (!state.editingPackageId && existing) {
    notify("Package ID already exists.", "error");
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
  if (state.backendConnected && typeof apiJson === "function") {
    try {
      if (existing) {
        await apiJson(`/api/packages/${encodeURIComponent(id)}`, { method: "PATCH", body: payload });
      } else {
        await apiJson("/api/packages", { method: "POST", body: payload });
      }
      await refreshFromBackend();
      state.editingPackageId = null;
      runOptimization();
    } catch (e) {
      notify(e?.message || "Failed to save package", "error");
    }
    return;
  }

  if (existing) Object.assign(existing, payload);
  else state.packages.push(payload);
  state.editingPackageId = null;
  runOptimization();
}

function editPackage(id) {
  state.editingPackageId = id;
  render();
}

async function deletePackage(id) {
  if (!confirm("Delete this package from today's operation?")) return;
  if (state.backendConnected && typeof apiJson === "function") {
    try {
      await apiJson(`/api/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshFromBackend();
      state.editingPackageId = null;
      runOptimization();
      return;
    } catch (e) {
      notify(e?.message || "Failed to delete package", "error");
      return;
    }
  }

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

function routePlannerPage() {
  return `
    <div class="page-head"><div><h2>Route Planner</h2><div class="muted">Routes can be generated only for vehicles added by the owner.</div></div><button class="btn primary" onclick="runOptimization()">Generate Optimal Routes</button></div>
    ${state.trucks.length ? `<div class="dashboard-grid"><section class="card map-panel"><div class="panel-title"><h3>Planned Routes</h3><span class="muted">${state.tspMode} on Bangalore roads</span></div><div id="blrMap" class="map-canvas"></div></section><section class="card"><div class="panel-title"><h3>Route Summary</h3></div>${fleetMinis()}</section></div>` : emptyFleetNotice()}`;
}

function algorithmPage() {
  return `
    <div class="page-head"><div><h2>Algorithm Control</h2><div class="muted">Algorithms are real, but fleet capacity comes from owner-added vehicles.</div></div></div>
    <div class="grid chart-grid">
      <section class="card chart-box"><h3>Knapsack Loading</h3><label class="field">Priority weight ${state.priorityWeight}x<input type="range" min="1" max="6" value="${state.priorityWeight}" oninput="state.priorityWeight=Number(this.value); runOptimization()"></label><canvas id="dpChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>Floyd-Warshall Matrix</h3><canvas id="matrixChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>TSP Comparison</h3><div class="toolbar"><button class="btn ${state.tspMode === "Greedy" ? "primary" : ""}" onclick="state.tspMode='Greedy'; runOptimization()">Greedy</button><button class="btn ${state.tspMode === "Branch and Bound" ? "primary" : ""}" onclick="state.tspMode='Branch and Bound'; runOptimization()">Branch and Bound</button></div><canvas id="tspChart" class="tiny-canvas"></canvas></section>
      <section class="card chart-box"><h3>Topological Sort</h3>${topoSort(state.packages).ordered.slice(0, 8).map((pkg, i) => `<div class="item">${i + 1}. ${pkg.id} <span class="muted">${pkg.dependsOn.length ? "after " + pkg.dependsOn.join(", ") : "no dependency"}</span></div>`).join("")}</section>
    </div>`;
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
    <section class="card" style="padding:16px">
      <form class="form-grid" onsubmit="submitIncident(event)">
        <label class="field">Type<select id="incidentType"><option>Accident</option><option>Road Block</option><option>Delayed Package</option><option>Truck Stationary</option></select></label>
        <label class="field">Truck ID<select id="incidentTruck"><option value="">No truck</option>${state.trucks.map(truck => `<option>${truck.id}</option>`).join("")}</select></label>
        <label class="field full">Message<textarea id="incidentMessage" class="textarea" placeholder="Describe the incident"></textarea></label>
        <button class="btn primary full">Report Incident</button>
      </form>
    </section>
    <section class="card" style="margin-top:18px">${incidentList(20)}</section>`;
}

function runOptimization() {
  const before = new Map(state.packages.map(pkg => [pkg.id, {
    truckId: pkg.truckId || "",
    eta: pkg.eta || "",
    status: pkg.status || "Pending"
  }]));

  state.packages.forEach(pkg => {
    if (pkg.status !== "Delivered" && pkg.status !== "Failed") {
      pkg.status = "Pending";
      pkg.truckId = "";
      pkg.eta = "";
    }
  });
  state.trucks.forEach(truck => {
    const current = nearestNode(truck.pos).id;
    truck.packages = [];
    truck.route = [current];
    truck.routeNames = [state.nodes[current].name];
    truck.completedStops = 0;
    if (truck.status !== "Completed" && truck.status !== "Returned") truck.status = "Active";
  });
  if (!state.trucks.length) {
    drawVisibleCanvases();
    return;
  }

  const unassigned = state.packages
    .filter(pkg => pkg.status !== "Delivered" && pkg.status !== "Failed")
    .slice()
    .sort((a, b) => (b.priority === "Urgent") - (a.priority === "Urgent"));

  state.trucks.forEach(truck => {
    const { selected } = knapsack(unassigned, truck.capacity, state.priorityWeight);
    truck.packages = selected;
    selected.forEach(pkg => {
      pkg.truckId = truck.id;
      pkg.status = "In Transit";
      const index = unassigned.indexOf(pkg);
      if (index >= 0) unassigned.splice(index, 1);
    });
  });
  state.trucks.forEach(truck => {
    const ordered = topoSort(truck.packages).ordered;
    const stops = ordered.map(pkg => pkg.node);
    const route = state.tspMode === "Greedy" ? greedyTsp(stops, state.matrix) : branchBoundTsp(stops, state.matrix);
    truck.route = route;
    truck.routeNames = route.map(node => state.nodes[node].name);
    truck.packages.forEach(pkg => {
      const stopIndex = Math.max(1, route.indexOf(pkg.node));
      pkg.eta = lrTimeFromMinutes(110 + stopIndex * 26);
    });
  });

  if (state.backendConnected && typeof apiJson === "function") {
    (async () => {
      const updates = [];
      for (const pkg of state.packages) {
        const prev = before.get(pkg.id);
        if (!prev) continue;

        const truckChanged = (prev.truckId || "") !== (pkg.truckId || "");
        const etaChanged = (prev.eta || "") !== (pkg.eta || "");
        const statusChanged = (prev.status || "") !== (pkg.status || "");
        if (!truckChanged && !etaChanged && !statusChanged) continue;

        updates.push({
          id: pkg.id,
          truckId: pkg.truckId || "",
          eta: pkg.eta || "",
          status: pkg.status || "Pending"
        });
      }

      if (!updates.length) return;
      try {
        await apiJson("/api/packages/bulk", { method: "PATCH", body: { updates } });
      } catch {
        notify("Route plan saved locally, but backend sync failed.", "error");
      }
    })();
  }

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
      ${incident.resolved ? "" : `<button class="btn" onclick="resolveIncident('${String(incident.id).replaceAll("'", "\\'")}')">Mark Resolved</button>`}
    </div>`).join("");
}

async function createIncident() {
  const type = lrChoice(["Road Block", "Delayed Package", "Truck Stationary"]);
  const truck = state.trucks.length ? lrChoice(state.trucks) : null;
  const pkg = lrChoice(state.packages);

  const target = type === "Delayed Package" ? pkg.id : truck ? truck.id : "";
  const description = type === "Road Block"
    ? "Road blockage reported near " + lrChoice(LR_AREAS.slice(1))
    : type === "Delayed Package"
      ? pkg.id + " may miss its delivery window"
      : (truck ? truck.id : "A planned vehicle") + " has been stationary too long";

  if (state.backendConnected && typeof apiJson === "function") {
    try {
      const created = await apiJson("/api/incidents", {
        method: "POST",
        body: { truckId: type === "Delayed Package" ? "" : (truck ? truck.id : ""), type, message: description }
      });
      state.incidents.unshift(mapIncidentFromApi(created));
      render();
      return;
    } catch (e) {
      notify(e?.message || "Failed to create incident", "error");
      return;
    }
  }

  state.incidents.unshift({
    id: Date.now(),
    type,
    target,
    description,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    resolved: false
  });
  render();
}

async function submitIncident(event) {
  event.preventDefault();

  const type = (document.getElementById("incidentType")?.value || "Accident").trim() || "Accident";
  const truckId = (document.getElementById("incidentTruck")?.value || "").trim();
  const messageRaw = (document.getElementById("incidentMessage")?.value || "").trim();

  const fallback = type === "Accident"
    ? "Accident reported"
    : type === "Road Block"
      ? "Road blockage reported"
      : "Incident reported";
  const message = messageRaw || (truckId ? `${fallback} for ${truckId}.` : `${fallback}.`);

  if (state.backendConnected && typeof apiJson === "function") {
    try {
      const created = await apiJson("/api/incidents", { method: "POST", body: { truckId, type, message } });
      state.incidents.unshift(mapIncidentFromApi(created));
      render();
    } catch (e) {
      notify(e?.message || "Failed to submit incident", "error");
    }
    return;
  }

  state.incidents.unshift({
    id: Date.now(),
    type,
    target: truckId || "",
    description: message,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    resolved: false
  });
  render();
}

async function resolveIncident(id) {
  const incident = state.incidents.find(item => String(item.id) === String(id));
  if (!incident) return;

  if (state.backendConnected && typeof apiJson === "function") {
    try {
      const resolved = await apiJson(`/api/incidents/${encodeURIComponent(String(id))}/resolve`, { method: "POST" });
      Object.assign(incident, mapIncidentFromApi(resolved));
      render();
      return;
    } catch (e) {
      notify(e?.message || "Failed to resolve incident", "error");
      return;
    }
  }

  incident.resolved = true;
  render();
}

function statusColor(status) {
  switch (status) {
    case "In Transit":
      return "#1e90ff";
    case "Completed":
      return "#800080";
    case "Available":
    case "Idle":
    case "Active":
    default:
      return "#28a745";
  }
}
