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
  const banner = trackingBanner(pkg, truck, stopNumber);
  app.innerHTML = `
    <section class="app-shell">
      ${topbar("customer")}
      <main class="customer-main">
        <section class="card eta-card" style="border-left-color:${banner.color}">
          <div><h2>${banner.title}</h2><p>${banner.subtitle}</p><p id="distanceText">${banner.distanceText}</p></div>
          ${banner.action}
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

/* Builds the tracking page's top banner: title, subtitle, accent color,
   and the right-hand action, branching on which delivery scenario the
   package is currently in (see attemptDelivery() in bootstrap.js). */
function trackingBanner(pkg, truck, stopNumber) {
  if (pkg.status === "Delivered") {
    return { color: "var(--green)", title: "Delivered", subtitle: pkg.deliveryNote || "Delivered successfully.", distanceText: "", action: `<span class="pill green" style="font-size:14px;padding:8px 16px">Delivered</span>` };
  }
  if (pkg.status === "Failed") {
    return { color: "var(--red)", title: "Delivery Attempt Failed", subtitle: pkg.deliveryNote || "The recipient was unavailable. The driver will retry on the next pass.", distanceText: "", action: `<span class="pill red" style="font-size:14px;padding:8px 16px">Attempt Failed</span>` };
  }
  if (pkg.status === "Returned to Origin") {
    return { color: "var(--red)", title: "Returned to Origin", subtitle: pkg.deliveryNote || "Delivery could not be completed after repeated attempts and the package has been sent back to the warehouse.", distanceText: "", action: `<span class="pill red" style="font-size:14px;padding:8px 16px">Returned</span>` };
  }
  if (pkg.status === "Delayed") {
    return { color: "var(--amber)", title: "Delivery Delayed", subtitle: pkg.deliveryNote || "This delivery has been delayed.", distanceText: "", action: `<span class="pill amber" style="font-size:14px;padding:8px 16px">Delayed</span>` };
  }
  if (truck) {
    return { color: "var(--teal)", title: `Arriving by ${pkg.eta}`, subtitle: `Your delivery is stop ${stopNumber} on ${truck.id}.`, distanceText: `Driver is ${customerDistance(pkg, truck)} km away.`, action: `<button class="btn primary" onclick="routeTo('confirmation')">Delivery Complete</button>` };
  }
  return { color: "var(--teal)", title: "Waiting for dispatch", subtitle: "The owner has not assigned this package to a vehicle yet.", distanceText: "You will get an email/SMS notification after assignment.", action: "" };
}

function driverInfo(truck, pkg) {
  if (!truck) return `<b>Driver pending</b><p class="muted">Driver and truck details appear here after the owner assigns a vehicle.</p><textarea class="textarea" placeholder="Leave delivery instructions">${pkg.instructions}</textarea>`;
  return `<div class="driver-top"><div class="avatar">${truck.driver[0]}</div><div><b>${truck.driver.split(" ")[0]}</b><div class="muted">${truck.plate} - ${truck.vehicleType}</div></div></div><p class="muted">${truck.mobile} - ${truck.email}</p><button class="btn primary">Contact Driver</button><textarea class="textarea" placeholder="Leave delivery instructions">${pkg.instructions}</textarea>`;
}

function timeline(pkg) {
  const early = [
    { label: "Order Placed", note: lrTimeFromMinutes(0), state: "done" },
    { label: "Package Received", note: lrTimeFromMinutes(35), state: "done" },
    { label: "Loaded onto Truck", note: lrTimeFromMinutes(70), state: "done" }
  ];
  let stages;
  if (pkg.status === "Delivered") {
    stages = [...early,
      { label: "Out for Delivery", note: "Completed", state: "done" },
      { label: "Delivered", note: pkg.deliveryNote || "Delivered successfully.", state: "done" }
    ];
  } else if (pkg.status === "Failed") {
    stages = [...early,
      { label: "Out for Delivery", note: "Attempted", state: "done" },
      { label: "Delivery Attempt Failed", note: pkg.deliveryNote || "Recipient unavailable.", state: "failed" }
    ];
  } else if (pkg.status === "Returned to Origin") {
    stages = [...early,
      { label: "Out for Delivery", note: "Multiple attempts made", state: "done" },
      { label: "Returned to Origin", note: pkg.deliveryNote || "Sent back to the warehouse.", state: "failed" }
    ];
  } else if (pkg.status === "Delayed") {
    stages = [...early,
      { label: "Out for Delivery", note: pkg.deliveryNote || "Delayed", state: "current" },
      { label: "Delivered", note: "Pending", state: "pending" }
    ];
  } else if (pkg.truckId) {
    stages = [...early,
      { label: "Out for Delivery", note: "In progress", state: "current" },
      { label: "Delivered", note: "Pending", state: "pending" }
    ];
  } else {
    stages = [
      { label: "Order Placed", note: lrTimeFromMinutes(0), state: "done" },
      { label: "Package Received", note: "Pending", state: "pending" },
      { label: "Loaded onto Truck", note: "Pending", state: "pending" },
      { label: "Out for Delivery", note: "Pending", state: "pending" },
      { label: "Delivered", note: "Pending", state: "pending" }
    ];
  }
  return stages.map((stage, index) => {
    const cls = stage.state === "done" ? "done" : stage.state === "current" ? "current" : stage.state === "failed" ? "failed" : "";
    const dot = stage.state === "done" ? "OK" : stage.state === "failed" ? "!" : index + 1;
    return `<div class="stage ${cls}"><div class="dot">${dot}</div><div><b>${stage.label}</b><div class="muted">${stage.note}</div></div></div>`;
  }).join("");
}

function renderAccount() {
  app.innerHTML = `
    <section class="app-shell">${topbar("customer")}
      <main class="customer-main"><div class="page-head"><div><h2>Order History</h2><div class="muted">Orders linked to ${state.activeUser ? state.activeUser.id : "this account"}.</div></div></div>
      <section class="grid">${state.packages.slice(0, 8).map(pkg => `<div class="card item"><div class="item-top"><b>${pkg.id}</b><span class="pill ${pkg.status === "Delivered" ? "green" : pkg.status === "Failed" || pkg.status === "Returned to Origin" ? "red" : pkg.status === "Delayed" || pkg.status === "Pending" ? "amber" : "blue"}">${pkg.status}</span></div><div>${pkg.merchant}</div><div class="muted">${pkg.destination} - ${pkg.eta || "Awaiting assignment"}</div><button class="btn primary" onclick="state.customerPackageId='${pkg.id}'; routeTo('tracking')">Track Again</button></div>`).join("")}</section></main>
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

