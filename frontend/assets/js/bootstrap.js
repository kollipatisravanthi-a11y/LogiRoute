function stepSimulation() {
  state.tick++;
  state.trucks.forEach(truck => {
    if (truck.route.length < 2) return;

    const a = state.nodes[truck.route[truck.segment]];
    const b = state.nodes[truck.route[(truck.segment + 1) % truck.route.length]];
    truck.progress += 0.016;

    if (truck.progress >= 1) {
      truck.progress = 0;
      truck.segment = (truck.segment + 1) % (truck.route.length - 1);

      const nodeReached = truck.route[truck.segment];
      truck.packages
        .filter(pkg => pkg.node === nodeReached && pkg.status !== "Delivered")
        .forEach(pkg => {
          pkg.status = "Delivered";
          truck.completedStops += 1;
        });
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
  setAuthMode,
  submitLogin,
  logout,
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
  resolveIncident,
  trackPackage,
  state
});

window.addEventListener("resize", drawVisibleCanvases);
setInterval(stepSimulation, 500);
render();
