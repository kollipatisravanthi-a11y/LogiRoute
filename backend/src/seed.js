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

function createPackages(nodes, count = 30) {
  return Array.from({ length: count }, (_, index) => {
    const node = 1 + Math.floor(Math.random() * (nodes.length - 1));
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
      priority: Math.random() > 0.72 ? "Urgent" : "Normal",
      deadline: lrTimeFromMinutes(lrRand(180, 520)),
      status: "Pending",
      eta: "",
      truckId: "",
      dependsOn: index > 5 && Math.random() > 0.84
        ? ["LR" + (24000 + Math.floor(lrRand(0, index - 1)))]
        : [],
      instructions: ""
    };
  });
}

function seedDb(db, { packageCount = 30 } = {}) {
  const nodes = createCityNodes();
  const packages = createPackages(nodes, packageCount);

  db.nodes = nodes;
  db.packages = packages;
  db.trucks = [];
  db.incidents = [];
  db.users = Array.isArray(db.users) ? db.users : [];
  if (db.users.length === 0) {
    const bcrypt = require("bcryptjs");
    const now = new Date().toISOString();
    db.users.push(
      {
        id: "owner@logiroute.in",
        role: "owner",
        name: "Demo Owner",
        passwordHash: bcrypt.hashSync("owner123", 10),
        createdAt: now
      },
      {
        id: "customer@logiroute.in",
        role: "customer",
        name: "Demo Customer",
        passwordHash: bcrypt.hashSync("track123", 10),
        createdAt: now
      }
    );
  }
  db.meta.seededAt = new Date().toISOString();

  return db;
}

module.exports = {
  seedDb
};
