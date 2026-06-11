const app = document.getElementById("app");
const nodes = createCityNodes();
const graph = createGraph(nodes);
const packages = createPackages(nodes);
const fw = floydWarshall(graph);

const state = {
  view: "landing",
  loginRole: "owner",
  authMode: "password",
  authScreen: "login",
  authError: "",
  activeUser: null,
  backendConnected: false,
  // API base URL. "" means same-origin (recommended when running via backend).
  // When running the frontend separately (e.g. Live Server), we will auto-detect
  // the backend and set this to something like "http://localhost:8080".
  apiBase: "",
  ownerPage: "Dashboard",
  nodes,
  graph,
  matrix: fw.d,
  next: fw.next,
  packages,
  trucks: [],
  incidents: [],
  selectedTruck: null,
  customerPackageId: packages[0].id,
  editingPackageId: null,
  weightLimit: 500,
  priorityWeight: 3,
  tspMode: "Branch and Bound",
  tick: 0
};

function seedOwnerDemo() {
  if (state.__ownerDemoSeeded) return;
  state.__ownerDemoSeeded = true;
  if (state.trucks.length) return;

  const seeds = [
    { id: "TRK-101", plate: "KA 05 LR 4300", driver: "Aarav Kumar", mobile: "9876500000", email: "aarav@logiroute.in", vehicleType: "Van", capacity: 650, fuel: 78, startNode: 0 },
    { id: "TRK-204", plate: "KA 03 LR 2199", driver: "Nisha Rao", mobile: "9876501111", email: "nisha@logiroute.in", vehicleType: "Mini Truck", capacity: 520, fuel: 64, startNode: 10 },
    { id: "TRK-330", plate: "KA 01 LR 8872", driver: "Vikram S", mobile: "9876502222", email: "vikram@logiroute.in", vehicleType: "EV Cargo", capacity: 430, fuel: 92, startNode: 5 }
  ];

  seeds.forEach((seed, index) => {
    const startNode = Number.isFinite(seed.startNode) ? seed.startNode : 0;
    const start = state.nodes[startNode] || state.nodes[0];
    state.trucks.push({
      id: seed.id,
      plate: seed.plate,
      driver: seed.driver,
      mobile: seed.mobile,
      email: seed.email,
      vehicleType: seed.vehicleType,
      capacity: seed.capacity,
      fuel: seed.fuel,
      status: "Available",
      packages: [],
      route: [start.id],
      routeNames: [start.name],
      progress: 0,
      segment: 0,
      completedStops: 0,
      pos: { x: start.x, y: start.y },
      color: LR_COLORS[index % LR_COLORS.length]
    });
  });

  const now = Date.now();
  state.incidents = [
    {
      id: now - 20000,
      type: "Road Block",
      target: "TRK-204",
      description: "Road blockage reported near " + lrChoice(LR_AREAS.slice(1)),
      time: new Date(now - 20000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      resolved: false
    },
    {
      id: now - 120000,
      type: "Delayed Package",
      target: state.packages[3]?.id || "LR24003",
      description: "Package may miss its delivery window due to congestion",
      time: new Date(now - 120000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      resolved: false
    },
    {
      id: now - 360000,
      type: "Truck Stationary",
      target: "TRK-101",
      description: "Vehicle has been stationary longer than expected (resolved)",
      time: new Date(now - 360000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      resolved: true
    }
  ];

  // Populate assignments, routes, and ETAs.
  if (typeof runOptimization === "function") runOptimization();
}

function routeTo(view, page) {
  state.view = view;
  if (page) state.ownerPage = page;
  render();
}

function openLogin(role) {
  state.loginRole = role;
  state.authMode = "password";
  state.authScreen = "login";
  state.authError = "";
  routeTo("login");
}

function render() {
  if (state.view === "landing") return renderLanding();
  if (state.view === "login") return renderLogin();
  if (state.view === "owner") return renderOwner();
  if (state.view === "customerHome") return renderCustomerHome();
  if (state.view === "tracking") return renderTracking();
  if (state.view === "account") return renderAccount();
  if (state.view === "confirmation") return renderConfirmation();
}

