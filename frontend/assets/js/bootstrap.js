async function stepSimulation() {
  state.tick++;
  state.trucks.forEach(truck => {
    // Skip trucks that are completed or returned
    if (truck.status === "Completed" || truck.status === "Returned") return;

    if (truck.route.length < 2) return;

    const a = state.nodes[truck.route[truck.segment]];
    const b = state.nodes[truck.route[(truck.segment + 1) % truck.route.length]];
    truck.progress += 0.016;

    if (truck.progress >= 1) {
      truck.progress = 0;
      // Move to next segment
      truck.segment = (truck.segment + 1) % (truck.route.length - 1);

      const nodeReached = truck.route[truck.segment];
      // Deliver packages at this node
      truck.packages
        .filter(pkg => pkg.node === nodeReached && pkg.status !== "Delivered")
        .forEach(pkg => {
          pkg.status = "Delivered";
          truck.completedStops += 1;
        });

      // If this was the last stop (after returning to warehouse), mark completed
      if (truck.segment === 0 && truck.route[truck.segment] === 0) {
        truck.status = "Completed";
        // Optionally stop movement by resetting route length
        // Sync status to backend
        if (state.backendConnected && typeof apiJson === "function") {
          apiJson(`/api/trucks/${encodeURIComponent(truck.id)}`, { method: "PATCH", body: { status: "Completed" } })
            .catch(e => notify(e?.message || "Failed to update truck status", "error"));
        }
      }
    }

    truck.pos = {
      x: a.x + (b.x - a.x) * truck.progress,
      y: a.y + (b.y - a.y) * truck.progress
    };
  });

  drawVisibleCanvases();
  updateDistanceText();
}

Object.assign(window, {
  routeTo,
  openLogin,
  setAuthScreen,
  submitLogin,
  submitSignup,
  logout,
  seedOwnerDemo,
  blrZoomIn,
  blrZoomOut,
  addTruck,
  removeTruck,
  selectTruck,
  runOptimization,
  savePackage,
  editPackage,
  deletePackage,
  resetPackageForm,
  filterPackages,
  createIncident,
  submitIncident,
  resolveIncident,
  trackPackage,
  completeDelivery,
  updateDeliveryInstructions,
  state
});

window.addEventListener("resize", drawVisibleCanvases);

// Prefer backend state when available; otherwise keep offline demo mode.
(async () => {
  if (typeof tryConnectBackend === "function") {
    await tryConnectBackend();
  }
  render();
  setInterval(() => { stepSimulation(); }, 500);
})();
