function renderCustomerHome() {
  app.innerHTML = `
    <section class="app-shell">
      ${topbar("customer")}
      <main class="customer-home">
        <div class="track-shell">
          <h1>Track Your Delivery</h1>
          <div class="search-row"><input id="trackingInput" placeholder="Enter tracking ID or mobile number" value="${state.customerPackageId}"><button class="btn primary" onclick="trackPackage()">Track</button></div>
          <div class="service-icons"><div>GPS<b>Live GPS Tracking</b></div><div>ETA<b>Real-Time ETA Updates</b></div><div>SMS<b>Instant Notifications</b></div></div>
        </div>
      </main>
    </section>`;
}

function trackPackage() {
  const query = document.getElementById("trackingInput").value.trim();
  const pkg = state.packages.find(item =>
    item.id.toLowerCase() === query.toLowerCase() ||
    item.phone.endsWith(query.slice(-4)) ||
    (item.email && item.email.toLowerCase() === query.toLowerCase())
  ) || state.packages[0];
  state.customerPackageId = pkg.id;
  routeTo("tracking");
}

function renderTracking() {
  const pkg = currentCustomerPackage();
  const truck = state.trucks.find(item => item.id === pkg.truckId);
  const stopNumber = truck ? Math.max(1, truck.route.indexOf(pkg.node)) : 0;
  app.innerHTML = `
    <section class="app-shell">
      ${topbar("customer")}
      <main class="customer-main">
        <section class="card eta-card">
          <div><h2>${truck ? `Arriving by ${pkg.eta}` : "Waiting for dispatch"}</h2><p>${truck ? `Your delivery is stop ${stopNumber} on ${truck.id}.` : "The owner has not assigned this package to a vehicle yet."}</p><p id="distanceText">${truck ? `Driver is ${customerDistance(pkg, truck)} km away.` : "You will get an email/SMS notification after assignment."}</p></div>
          <button class="btn primary" onclick="routeTo('confirmation')">Delivery Complete</button>
        </section>
        <div class="tracking-grid">
          <section class="card customer-map"><canvas id="customerMap"></canvas></section>
          <aside class="customer-side">
            <section class="card timeline">${timeline(pkg)}</section>
            <section class="card" style="padding:16px">${driverInfo(truck, pkg)}</section>
            <section class="card" style="padding:16px"><b>Notifications</b>${["Email ETA updates", "SMS when nearby", "Delivery confirmation"].map((text, i) => `<div class="notify-row"><span>${text}</span><button class="switch ${i < 2 ? "on" : ""}" onclick="this.classList.toggle('on')"></button></div>`).join("")}</section>
          </aside>
        </div>
        <section class="card" style="padding:16px;margin-top:18px"><b>Package Details</b><p>${pkg.merchant} - ${pkg.recipient} - ${pkg.email || "No email"} - ${pkg.phone} - ${pkg.id} - ${pkg.weight} kg - ${pkg.destination}</p><p class="muted">${pkg.instructions || "No special instructions."}</p></section>
      </main>
    </section>`;
  drawVisibleCanvases();
}

function driverInfo(truck, pkg) {
  if (!truck) return `<b>Driver pending</b><p class="muted">Driver and truck details appear here after the owner assigns a vehicle.</p><textarea class="textarea" placeholder="Leave delivery instructions">${pkg.instructions}</textarea>`;
  return `<div class="driver-top"><div class="avatar">${truck.driver[0]}</div><div><b>${truck.driver.split(" ")[0]}</b><div class="muted">${truck.plate} - ${truck.vehicleType}</div></div></div><p class="muted">${truck.mobile} - ${truck.email}</p><button class="btn primary">Contact Driver</button><textarea class="textarea" placeholder="Leave delivery instructions">${pkg.instructions}</textarea>`;
}

function timeline(pkg) {
  const stages = ["Order Placed", "Package Received", "Loaded onto Truck", "Out for Delivery", "Delivered"];
  const current = pkg.status === "Delivered" ? 4 : pkg.truckId ? 3 : 1;
  return stages.map((stage, index) => `<div class="stage ${index < current ? "done" : index === current ? "current" : ""}"><div class="dot">${index < current ? "OK" : index + 1}</div><div><b>${stage}</b><div class="muted">${index < current ? lrTimeFromMinutes(index * 35) : index === current ? "In progress" : "Pending"}</div></div></div>`).join("");
}

function renderAccount() {
  app.innerHTML = `
    <section class="app-shell">${topbar("customer")}
      <main class="customer-main"><div class="page-head"><div><h2>Order History</h2><div class="muted">Orders linked to ${state.activeUser ? state.activeUser.id : "this account"}.</div></div></div>
      <section class="grid">${state.packages.slice(0, 8).map(pkg => `<div class="card item"><div class="item-top"><b>${pkg.id}</b><span class="pill ${pkg.status === "Pending" ? "amber" : "blue"}">${pkg.status}</span></div><div>${pkg.merchant}</div><div class="muted">${pkg.destination} - ${pkg.eta || "Awaiting assignment"}</div><button class="btn primary" onclick="state.customerPackageId='${pkg.id}'; routeTo('tracking')">Track Again</button></div>`).join("")}</section></main>
    </section>`;
}

function renderConfirmation() {
  const pkg = currentCustomerPackage();
  pkg.status = "Delivered";
  app.innerHTML = `
    <section class="app-shell">${topbar("customer")}
      <main class="customer-main" style="display:grid;place-items:center;min-height:calc(100vh - 66px)">
        <section class="card" style="padding:28px;text-align:center;width:min(620px,100%)">
          <div style="width:90px;height:90px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-size:34px;margin:0 auto 18px">OK</div>
          <h1>Delivered</h1><p class="muted">${pkg.id} delivered at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          <textarea class="textarea" placeholder="Optional comments"></textarea><br><br>
          <button class="btn danger">Report Issue</button> <button class="btn primary" onclick="routeTo('customerHome')">Done</button>
        </section>
      </main>
    </section>`;
}

