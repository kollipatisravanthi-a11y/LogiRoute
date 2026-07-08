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
  const terminal = ["Delivered", "Failed", "Delayed", "Returned to Origin"];
  if (truck && !terminal.includes(pkg.status)) el.textContent = `Driver is ${customerDistance(pkg, truck)} km away.`;
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

