const app = document.getElementById("app");
const nodes = createCityNodes();
const graph = createGraph(nodes);
const packages = createPackages(nodes);
const fw = floydWarshall(graph);

const state = {
  view: "landing",
  loginRole: "owner",
  authMode: "password",
  authError: "",
  activeUser: null,
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
  knapsackCompare: false,
  dijkstraCompare: false,
  mstView: false,
  benchmarks: null,
  benchmarkStatus: "idle",
  tick: 0
};

function routeTo(view, page) {
  state.view = view;
  if (page) state.ownerPage = page;
  render();
}

function openLogin(role) {
  state.loginRole = role;
  state.authMode = "password";
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

