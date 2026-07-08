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
        .filter(pkg => pkg.node === nodeReached && !["Delivered", "Returned to Origin"].includes(pkg.status))
        .forEach(pkg => attemptDelivery(pkg, truck));
    }

    truck.pos = {
      x: a.x + (b.x - a.x) * truck.progress,
      y: a.y + (b.y - a.y) * truck.progress
    };
  });

  drawVisibleCanvases();
  updateDistanceText();
}

/* Resolves what happens when a truck reaches a package's destination node.
   Four possible outcomes, so the customer/owner views have real scenarios
   to show rather than a single always-succeeds path:
     1. Blocked by an unresolved incident on the truck (Road Block / Truck Stationary)
        -> delivery attempt is skipped this pass, truck stays "in transit"
     2. Blocked by an unresolved "Delayed Package" incident on this package
        -> status becomes "Delayed" with the incident's reason attached
     3. Attempted and failed (simulated ~18% chance, e.g. recipient unavailable)
        -> first failure -> "Failed" (retried on the truck's next pass through
           this node, since the route loops); second failure -> "Returned to Origin"
     4. Attempted and succeeded -> "Delivered" */
function attemptDelivery(pkg, truck) {
  const blockingIncident = state.incidents.find(i => !i.resolved && i.type !== "Delayed Package" && i.target === truck.id);
  if (blockingIncident) {
    pkg.deliveryNote = `Truck ${truck.id} is delayed: ${blockingIncident.description}`;
    return;
  }
  const delayIncident = state.incidents.find(i => !i.resolved && i.type === "Delayed Package" && i.target === pkg.id);
  if (delayIncident) {
    pkg.status = "Delayed";
    pkg.deliveryNote = delayIncident.description;
    return;
  }

  pkg.attempts = (pkg.attempts || 0) + 1;
  const succeeded = pkg.forcedOutcome ? pkg.forcedOutcome === "Delivered" : Math.random() > 0.18;
  pkg.forcedOutcome = null;

  if (succeeded) {
    pkg.status = "Delivered";
    pkg.deliveryNote = "Delivered successfully.";
    truck.completedStops += 1;
  } else if (pkg.attempts >= 2) {
    pkg.status = "Returned to Origin";
    pkg.deliveryNote = "Recipient unavailable after 2 attempts — returned to origin.";
  } else {
    pkg.status = "Failed";
    pkg.deliveryNote = "Delivery attempt failed: recipient unavailable. Will retry on the next pass.";
  }
}

/* Manual override so a specific scenario can be demoed on demand instead
   of waiting on the ~18% random failure chance. Setting forcedOutcome
   only takes effect the next time the truck actually reaches the node;
   directly setting pkg.status here makes the change visible immediately
   for demo purposes too. */
function simulateOutcome(id, outcome) {
  if (!outcome) return;
  const pkg = state.packages.find(item => item.id === id);
  if (!pkg) return;
  const notes = {
    "Delivered": "Manually marked delivered (demo).",
    "Failed": "Manually marked as a failed delivery attempt (demo): recipient unavailable.",
    "Delayed": "Manually marked delayed (demo).",
    "Returned to Origin": "Manually marked returned to origin (demo)."
  };
  pkg.status = outcome;
  pkg.deliveryNote = notes[outcome];
  if (outcome === "Failed") pkg.attempts = (pkg.attempts || 0) + 1;
  render();
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
  runBenchmarks,
  simulateOutcome,
  state
});

window.addEventListener("resize", drawVisibleCanvases);
setInterval(stepSimulation, 500);
render();
