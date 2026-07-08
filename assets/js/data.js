const LR_COLORS = ["#0e9f8f", "#38bdf8", "#f59e0b", "#a78bfa", "#f97316", "#22c55e"];
const LR_AREAS = [
  "Central Warehouse", "Koramangala", "Indiranagar", "Whitefield", "HSR Layout",
  "Electronic City", "Jayanagar", "Yeshwanthpur", "Marathahalli", "Hebbal",
  "MG Road", "Rajajinagar", "Bellandur", "Banashankari", "Malleshwaram",
  "Sarjapur", "Kalyan Nagar", "Domlur", "Banaswadi", "JP Nagar",
  "BTM Layout", "Basavanagudi", "Ulsoor", "KR Puram", "Hoodi",
  "Brookefield", "Vijayanagar", "Peenya", "Nagarbhavi", "RT Nagar",
  "Hennur", "Thanisandra", "Jakkur", "Yelahanka", "Devanahalli",
  "Bommanahalli", "Begur", "Kanakapura Road", "Hosur Road", "Frazer Town",
  "Shivajinagar", "Cunningham Road", "Richmond Town", "Varthur", "Kadugodi"
];
const LR_MERCHANTS = [
  "Amazon", "Flipkart", "Myntra", "Meesho", "BigBasket", "Blinkit",
  "Zepto", "Swiggy Instamart", "Reliance Digital", "Tata Cliq",
  "Nykaa", "Ajio", "Decathlon", "Croma", "Local Retail Partner"
];

function lrRand(min, max) {
  return Math.random() * (max - min) + min;
}

function lrChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function lrTimeFromMinutes(minutes) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function lrDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function createCityNodes() {
  const nodes = LR_AREAS.map((name, id) => ({
    id,
    name,
    x: lrRand(70, 930),
    y: lrRand(70, 620)
  }));
  nodes[0].x = 96;
  nodes[0].y = 92;
  return nodes;
}

function createGraph(nodes) {
  const graph = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(Infinity));
  for (let i = 0; i < nodes.length; i++) graph[i][i] = 0;
  for (let i = 0; i < nodes.length; i++) {
    const closest = nodes
      .map((node, j) => ({ j, d: lrDistance(nodes[i], node) }))
      .sort((a, b) => a.d - b.d)
      .slice(1, 5);
    closest.forEach(({ j, d }) => {
      const weight = Math.round(d / 12 + lrRand(1, 8));
      graph[i][j] = Math.min(graph[i][j], weight);
      graph[j][i] = Math.min(graph[j][i], weight);
    });
  }
  return graph;
}

function createPackages(nodes) {
  return Array.from({ length: 30 }, (_, index) => {
    const node = 1 + Math.floor(Math.random() * (nodes.length - 1));
    const deadlineMinutes = Math.round(lrRand(180, 520));
    return {
      id: "LR" + (24000 + index),
      merchant: lrChoice(LR_MERCHANTS),
      recipient: ["Nisha Rao", "Vikram S", "Ananya P", "Sahil M", "Priya K", "Dev Shah"][index % 6],
      email: ["nisha@example.com", "vikram@example.com", "ananya@example.com", "sahil@example.com", "priya@example.com", "dev@example.com"][index % 6],
      phone: "98" + Math.floor(10000000 + Math.random() * 89999999),
      node,
      destination: nodes[node].name,
      weight: Math.round(lrRand(8, 80)),
      volume: Math.round(lrRand(6, 70)),
      priority: Math.random() > .72 ? "Urgent" : "Normal",
      deadlineMinutes,
      deadline: lrTimeFromMinutes(deadlineMinutes),
      status: "Pending",
      eta: "",
      truckId: "",
      dependsOn: index > 5 && Math.random() > .84 ? ["LR" + (24000 + Math.floor(lrRand(0, index - 1)))] : [],
      instructions: ""
    };
  });
}
