const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

const { getDb, updateDb } = require("./db");
const { seedDb } = require("./seed");
const { isNonEmptyString, asNumber, asString, badRequest, notFound, pick } = require("./validation");

const app = express();
app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve the static frontend (no build step) from the same server.
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(FRONTEND_DIR));

const OWNER_ONLY = /^(1|true)$/i.test(process.env.LOGIROUTE_OWNER_ONLY || "");

// Very small demo auth: tokens are held in-memory.
// If LOGIROUTE_OWNER_ONLY is enabled, non-GET /api requests require an owner token.
const tokens = new Map();

function parseBearerToken(req) {
  const header = String(req.get("authorization") || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

function issueToken(user) {
  const token = makeId("TOK");
  tokens.set(token, { user, createdAt: Date.now() });
  return token;
}

app.use((req, res, next) => {
  const token = parseBearerToken(req);
  if (token) {
    const record = tokens.get(token);
    if (record?.user) req.user = record.user;
  }
  next();
});

function requireOwner(req, res, next) {
  if (!OWNER_ONLY) return next();
  if (req.user?.role === "owner") return next();
  return res.status(403).json({ error: { message: "Owner access required" } });
}

app.use("/api", (req, res, next) => {
  if (!OWNER_ONLY) return next();
  if (req.path === "/auth/login" || req.path === "/auth/signup") return next();
  if (req.method === "GET") return next();
  return requireOwner(req, res, next);
});

function makeId(prefix = "ID") {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`.toUpperCase();
}

const BLR_CENTER = {
  lat: asNumber(process.env.LR_BLR_CENTER_LAT, 13.1986),
  lng: asNumber(process.env.LR_BLR_CENTER_LNG, 77.7066)
};
const BLR_RADIUS_KM = asNumber(process.env.LR_BLR_RADIUS_KM, 45);
const KNOWN_BLR_COORDINATES = new Map([
  ["central warehouse", { lat: 13.1986, lng: 77.7066 }],
  ["koramangala", { lat: 12.9352, lng: 77.6245 }],
  ["indiranagar", { lat: 12.9784, lng: 77.6408 }],
  ["whitefield", { lat: 12.9698, lng: 77.7500 }],
  ["hsr layout", { lat: 12.9116, lng: 77.6474 }],
  ["electronic city", { lat: 12.8452, lng: 77.6602 }],
  ["jayanagar", { lat: 12.9250, lng: 77.5938 }],
  ["marathahalli", { lat: 12.9569, lng: 77.7011 }],
  ["hebbal", { lat: 13.0358, lng: 77.5970 }],
  ["yelahanka", { lat: 13.1007, lng: 77.5963 }],
  ["banashankari", { lat: 12.9255, lng: 77.5468 }]
]);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeDestination(value) {
  return asString(value).trim().toLowerCase();
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = n => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function projectLatLngToCanvas(lat, lng) {
  const x = 500 + (lng - BLR_CENTER.lng) * 500;
  const y = 320 - (lat - BLR_CENTER.lat) * 500;
  return {
    x: clamp(Math.round(x), 40, 960),
    y: clamp(Math.round(y), 40, 640)
  };
}

function projectCanvasToLatLng(x, y) {
  return {
    lat: BLR_CENTER.lat + (320 - y) / 500,
    lng: BLR_CENTER.lng + (x - 500) / 500
  };
}

function normalizeWords(value) {
  return normalizeDestination(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNameMatch(query, candidate) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) return 0.9;

  const q = query.split(" ").filter(Boolean);
  const c = candidate.split(" ").filter(Boolean);
  if (!q.length || !c.length) return 0;

  let overlap = 0;
  for (const token of q) {
    if (c.some(t => t.startsWith(token) || token.startsWith(t))) overlap += 1;
  }
  return overlap / Math.max(q.length, c.length);
}

function findBestNodeMatch(nodes, inputName) {
  const query = normalizeWords(inputName);
  let best = null;
  let score = 0;

  for (const node of nodes || []) {
    const candidate = normalizeWords(node?.name);
    const s = scoreNameMatch(query, candidate);
    if (s > score) {
      score = s;
      best = node;
    }
  }
  if (!best || score < 0.45) return null;
  return { node: best, score };
}

function knownBlrCoordinatesFor(name) {
  const normalized = normalizeWords(name);
  for (const [location, coordinates] of KNOWN_BLR_COORDINATES) {
    if (normalized === location || normalized.includes(location) || location.includes(normalized)) {
      return coordinates;
    }
  }
  return null;
}

function resolveAndValidateDestination(db, payload, currentPkg) {
  const nodes = Array.isArray(db?.nodes) ? db.nodes : [];
  const byName = new Map(nodes.map((n, i) => [normalizeDestination(n?.name), i]));

  let node = hasOwn(payload, "node") ? asNumber(payload.node, NaN) : Number(currentPkg?.node);
  let destination = hasOwn(payload, "destination")
    ? asString(payload.destination).trim()
    : asString(currentPkg?.destination).trim();

  if (!Number.isFinite(node) && destination) {
    const indexByName = byName.get(normalizeDestination(destination));
    if (Number.isFinite(indexByName)) node = indexByName;
  }

  if (!Number.isFinite(node)) {
    throw Object.assign(new Error("Destination node is required and must be serviceable"), { status: 400 });
  }

  const nodeIndex = Math.floor(node);
  if (nodeIndex < 0 || nodeIndex >= nodes.length) {
    throw Object.assign(new Error("Destination is not serviceable currently"), { status: 400 });
  }

  const selectedNode = nodes[nodeIndex];
  if (!selectedNode?.name) {
    throw Object.assign(new Error("Destination is not serviceable currently"), { status: 400 });
  }

  if (!destination) {
    destination = selectedNode.name;
  }

  const destinationIndex = byName.get(normalizeDestination(destination));
  if (Number.isFinite(destinationIndex) && destinationIndex !== nodeIndex) {
    throw Object.assign(new Error("Destination and node do not match"), { status: 400 });
  }
  if (!Number.isFinite(destinationIndex)) {
    throw Object.assign(new Error("Destination is not serviceable currently"), { status: 400 });
  }

  const lat = hasOwn(payload, "lat") ? asNumber(payload.lat, NaN) : Number(currentPkg?.lat);
  const lng = hasOwn(payload, "lng") ? asNumber(payload.lng, NaN) : Number(currentPkg?.lng);
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

  if (hasGeo) {
    const distanceKm = haversineKm(lat, lng, BLR_CENTER.lat, BLR_CENTER.lng);
    if (distanceKm > BLR_RADIUS_KM) {
      throw Object.assign(new Error(`Destination is outside BLR service radius (${BLR_RADIUS_KM} km)`), { status: 400 });
    }
  }

  return {
    node: nodeIndex,
    destination: selectedNode.name,
    lat: hasGeo ? lat : null,
    lng: hasGeo ? lng : null
  };
}

function normalizeRole(value) {
  const role = asString(value).trim().toLowerCase();
  return role === "owner" ? "owner" : "customer";
}

function normalizeUserId(value) {
  return asString(value).trim();
}

function publicUser(user) {
  return { role: user.role, id: user.id, name: user.name || "" };
}

function publicDb(db, requester) {
  return {
    meta: db.meta,
    nodes: db.nodes,
    trucks: db.trucks,
    packages: db.packages,
    incidents: db.incidents,
    users: requester?.role === "owner" && Array.isArray(db.users)
      ? db.users.map(publicUser)
      : []
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "logiroute-backend" });
});

app.get("/api/state", async (req, res, next) => {
  try {
    const db = await getDb();
    res.json(publicDb(db, req.user));
  } catch (e) {
    next(e);
  }
});

app.post("/api/seed", async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const packageCount = asNumber(req.body?.packageCount, 30);

    const db = await updateDb(async db0 => {
      const alreadySeeded = (db0.nodes?.length ?? 0) > 0 || (db0.packages?.length ?? 0) > 0;
      if (alreadySeeded && !force) return;
      seedDb(db0, { packageCount });
    });

    res.json({ ok: true, meta: db.meta, counts: {
      nodes: db.nodes.length,
      packages: db.packages.length,
      trucks: db.trucks.length,
      incidents: db.incidents.length
    }});
  } catch (e) {
    next(e);
  }
});

// Nodes
app.get("/api/nodes", async (req, res, next) => {
  try {
    const db = await getDb();
    res.json(db.nodes);
  } catch (e) {
    next(e);
  }
});

app.post("/api/nodes", async (req, res, next) => {
  try {
    const payload = req.body ?? {};
    const name = asString(payload.name).trim();
    if (!isNonEmptyString(name)) return badRequest(res, "Node name is required");

    let createdNode = null;
    await updateDb(async db0 => {
      const exists = db0.nodes.some(n => normalizeDestination(n?.name) === normalizeDestination(name));
      if (exists) throw Object.assign(new Error("NODE_EXISTS"), { status: 409 });

      let lat = asNumber(payload.lat, NaN);
      let lng = asNumber(payload.lng, NaN);
      const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

      if (!hasGeo) {
        const best = findBestNodeMatch(db0.nodes, name);
        if (!best) {
          throw Object.assign(new Error("Location could not be identified in BLR network"), { status: 400 });
        }

        const inferred = best.node;
        const knownCoordinates = knownBlrCoordinatesFor(inferred.name);
        if (knownCoordinates) {
          lat = knownCoordinates.lat;
          lng = knownCoordinates.lng;
        } else if (Number.isFinite(Number(inferred.lat)) && Number.isFinite(Number(inferred.lng))) {
          lat = Number(inferred.lat);
          lng = Number(inferred.lng);
        } else {
          const fromCanvas = projectCanvasToLatLng(
            asNumber(inferred.x, 500),
            asNumber(inferred.y, 320)
          );
          lat = fromCanvas.lat;
          lng = fromCanvas.lng;
        }
      }

      const distanceKm = haversineKm(lat, lng, BLR_CENTER.lat, BLR_CENTER.lng);
      if (distanceKm > BLR_RADIUS_KM) {
        throw Object.assign(new Error(`Location is outside BLR service radius (${BLR_RADIUS_KM} km)`), { status: 400 });
      }

      const projected = projectLatLngToCanvas(lat, lng);
      const x = hasOwn(payload, "x") ? asNumber(payload.x, projected.x) : projected.x;
      const y = hasOwn(payload, "y") ? asNumber(payload.y, projected.y) : projected.y;

      createdNode = {
        id: db0.nodes.length,
        name,
        x: clamp(Math.round(x), 40, 960),
        y: clamp(Math.round(y), 40, 640),
        lat,
        lng
      };
      db0.nodes.push(createdNode);
    });

    return res.status(201).json(createdNode);
  } catch (e) {
    next(e);
  }
});

// Trucks
app.get("/api/trucks", async (req, res, next) => {
  try {
    const db = await getDb();
    res.json(db.trucks);
  } catch (e) {
    next(e);
  }
});

app.post("/api/trucks", async (req, res, next) => {
  try {
    const payload = req.body ?? {};
    const id = asString(payload.id).trim();
    if (!isNonEmptyString(id)) return badRequest(res, "Truck id is required");

    const truck = {
      id,
      plate: asString(payload.plate).trim(),
      driver: asString(payload.driver).trim(),
      mobile: asString(payload.mobile).trim(),
      email: asString(payload.email).trim(),
      vehicleType: asString(payload.vehicleType).trim() || "Mini Truck",
      capacity: asNumber(payload.capacity, 500),
      fuel: asNumber(payload.fuel, 85),
      status: asString(payload.status).trim() || "Active",
      startNode: asNumber(payload.startNode, 0)
    };

    const db = await updateDb(async db0 => {
      if (db0.trucks.some(t => t.id.toLowerCase() === id.toLowerCase())) {
        throw Object.assign(new Error("TRUCK_EXISTS"), { status: 409 });
      }
      db0.trucks.push(truck);
    });

    res.status(201).json(truck);
  } catch (e) {
    next(e);
  }
});

app.get("/api/trucks/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const truck = db.trucks.find(t => t.id === req.params.id);
    if (!truck) return notFound(res, "Truck not found");
    res.json(truck);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/trucks/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const update = req.body ?? {};

    const db = await updateDb(async db0 => {
      const truck = db0.trucks.find(t => t.id === id);
      if (!truck) throw Object.assign(new Error("TRUCK_NOT_FOUND"), { status: 404 });
      Object.assign(truck, pick(update, [
        "plate", "driver", "mobile", "email", "vehicleType", "capacity", "fuel", "status", "startNode"
      ]));
      if (truck.capacity != null) truck.capacity = asNumber(truck.capacity, 500);
      if (truck.fuel != null) truck.fuel = asNumber(truck.fuel, 0);
      if (truck.startNode != null) truck.startNode = asNumber(truck.startNode, 0);
    });

    const truck = db.trucks.find(t => t.id === id);
    res.json(truck);
  } catch (e) {
    next(e);
  }
});

app.delete("/api/trucks/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const db = await updateDb(async db0 => {
      const exists = db0.trucks.some(t => t.id === id);
      if (!exists) throw Object.assign(new Error("TRUCK_NOT_FOUND"), { status: 404 });
      db0.trucks = db0.trucks.filter(t => t.id !== id);
      db0.packages.forEach(pkg => {
        if (pkg.truckId === id) {
          pkg.truckId = "";
          if (pkg.status === "In Transit") pkg.status = "Pending";
        }
      });
    });

    res.json({ ok: true, removed: id, remaining: db.trucks.length });
  } catch (e) {
    next(e);
  }
});

// Packages
app.get("/api/packages", async (req, res, next) => {
  try {
    const db = await getDb();
    let list = db.packages;

    const status = asString(req.query.status).trim();
    const truckId = asString(req.query.truckId).trim();
    const q = asString(req.query.q).trim().toLowerCase();

    if (status) list = list.filter(p => p.status === status);
    if (truckId) list = list.filter(p => (p.truckId || "") === truckId);
    if (q) {
      list = list.filter(p =>
        (p.id || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.phone || "").toLowerCase().includes(q)
      );
    }

    res.json(list);
  } catch (e) {
    next(e);
  }
});

app.post("/api/packages", async (req, res, next) => {
  try {
    const payload = req.body ?? {};
    const id = asString(payload.id).trim();
    if (!isNonEmptyString(id)) return badRequest(res, "Package id is required");
    let pkg = null;

    const db = await updateDb(async db0 => {
      if (db0.packages.some(p => p.id.toLowerCase() === id.toLowerCase())) {
        throw Object.assign(new Error("PACKAGE_EXISTS"), { status: 409 });
      }

      const destination = resolveAndValidateDestination(db0, payload, null);
      pkg = {
        id,
        merchant: asString(payload.merchant).trim(),
        recipient: asString(payload.recipient).trim(),
        email: asString(payload.email).trim(),
        phone: asString(payload.phone).trim(),
        node: destination.node,
        destination: destination.destination,
        lat: destination.lat,
        lng: destination.lng,
        weight: asNumber(payload.weight, 1),
        volume: asNumber(payload.volume, 1),
        priority: asString(payload.priority).trim() || "Normal",
        deadline: asString(payload.deadline).trim(),
        status: asString(payload.status).trim() || "Pending",
        eta: asString(payload.eta).trim(),
        truckId: asString(payload.truckId).trim(),
        dependsOn: Array.isArray(payload.dependsOn) ? payload.dependsOn : [],
        instructions: asString(payload.instructions).trim()
      };
      db0.packages.push(pkg);
    });

    res.status(201).json(pkg);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/packages/bulk", async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (!updates.length) return badRequest(res, "At least one package update is required");
    if (updates.length > 500) return badRequest(res, "Too many package updates");

    const allowed = [
      "merchant", "recipient", "email", "phone", "node", "destination", "weight", "volume",
      "priority", "deadline", "status", "eta", "truckId", "dependsOn", "instructions", "lat", "lng"
    ];
    const changed = [];

    const db = await updateDb(async db0 => {
      for (const item of updates) {
        const id = asString(item?.id).trim();
        if (!id) throw Object.assign(new Error("PACKAGE_ID_REQUIRED"), { status: 400 });

        const pkg = db0.packages.find(p => p.id === id);
        if (!pkg) throw Object.assign(new Error("PACKAGE_NOT_FOUND"), { status: 404 });

        Object.assign(pkg, pick(item, allowed));
        const destination = resolveAndValidateDestination(db0, pkg, pkg);
        pkg.node = destination.node;
        pkg.destination = destination.destination;
        pkg.lat = destination.lat;
        pkg.lng = destination.lng;
        if (pkg.node != null) pkg.node = asNumber(pkg.node, 1);
        if (pkg.weight != null) pkg.weight = asNumber(pkg.weight, 1);
        if (pkg.volume != null) pkg.volume = asNumber(pkg.volume, 1);
        if (!Array.isArray(pkg.dependsOn)) pkg.dependsOn = [];
        changed.push(id);
      }
    });

    res.json({
      ok: true,
      updated: changed.length,
      packages: db.packages.filter(pkg => changed.includes(pkg.id))
    });
  } catch (e) {
    next(e);
  }
});

app.get("/api/packages/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const pkg = db.packages.find(p => p.id === req.params.id);
    if (!pkg) return notFound(res, "Package not found");
    res.json(pkg);
  } catch (e) {
    next(e);
  }
});

app.patch("/api/packages/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const update = req.body ?? {};

    const db = await updateDb(async db0 => {
      const pkg = db0.packages.find(p => p.id === id);
      if (!pkg) throw Object.assign(new Error("PACKAGE_NOT_FOUND"), { status: 404 });

      Object.assign(pkg, pick(update, [
        "merchant", "recipient", "email", "phone", "node", "destination", "weight", "volume",
        "priority", "deadline", "status", "eta", "truckId", "dependsOn", "instructions", "lat", "lng"
      ]));

      const destination = resolveAndValidateDestination(db0, pkg, pkg);
      pkg.node = destination.node;
      pkg.destination = destination.destination;
      pkg.lat = destination.lat;
      pkg.lng = destination.lng;

      if (pkg.node != null) pkg.node = asNumber(pkg.node, 1);
      if (pkg.weight != null) pkg.weight = asNumber(pkg.weight, 1);
      if (pkg.volume != null) pkg.volume = asNumber(pkg.volume, 1);
      if (!Array.isArray(pkg.dependsOn)) pkg.dependsOn = [];
    });

    const pkg = db.packages.find(p => p.id === id);
    res.json(pkg);
  } catch (e) {
    next(e);
  }
});

app.delete("/api/packages/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const db = await updateDb(async db0 => {
      const exists = db0.packages.some(p => p.id === id);
      if (!exists) throw Object.assign(new Error("PACKAGE_NOT_FOUND"), { status: 404 });
      db0.packages = db0.packages.filter(p => p.id !== id);
    });

    res.json({ ok: true, removed: id, remaining: db.packages.length });
  } catch (e) {
    next(e);
  }
});

app.post("/api/packages/:id/assign", async (req, res, next) => {
  try {
    const id = req.params.id;
    const truckId = asString(req.body?.truckId).trim();

    const db = await updateDb(async db0 => {
      const pkg = db0.packages.find(p => p.id === id);
      if (!pkg) throw Object.assign(new Error("PACKAGE_NOT_FOUND"), { status: 404 });
      if (!truckId) {
        pkg.truckId = "";
        if (pkg.status === "In Transit") pkg.status = "Pending";
        return;
      }

      const truckExists = db0.trucks.some(t => t.id === truckId);
      if (!truckExists) throw Object.assign(new Error("TRUCK_NOT_FOUND"), { status: 404 });

      pkg.truckId = truckId;
      if (pkg.status === "Pending") pkg.status = "In Transit";
    });

    const pkg = db.packages.find(p => p.id === id);
    res.json(pkg);
  } catch (e) {
    next(e);
  }
});

// Incidents
app.get("/api/incidents", async (req, res, next) => {
  try {
    const db = await getDb();
    res.json(db.incidents);
  } catch (e) {
    next(e);
  }
});

app.post("/api/incidents", async (req, res, next) => {
  try {
    const payload = req.body ?? {};
    const truckId = asString(payload.truckId).trim();

    const incident = {
      id: makeId("INC"),
      truckId,
      type: asString(payload.type).trim() || "Delay",
      message: asString(payload.message).trim() || "Reported by system",
      createdAt: new Date().toISOString(),
      resolved: false,
      resolvedAt: ""
    };

    const db = await updateDb(async db0 => {
      if (truckId && !db0.trucks.some(t => t.id === truckId)) {
        throw Object.assign(new Error("TRUCK_NOT_FOUND"), { status: 404 });
      }
      db0.incidents.unshift(incident);
    });

    res.status(201).json(incident);
  } catch (e) {
    next(e);
  }
});

app.post("/api/incidents/:id/resolve", async (req, res, next) => {
  try {
    const id = req.params.id;
    const db = await updateDb(async db0 => {
      const inc = db0.incidents.find(i => i.id === id);
      if (!inc) throw Object.assign(new Error("INCIDENT_NOT_FOUND"), { status: 404 });
      inc.resolved = true;
      inc.resolvedAt = new Date().toISOString();
    });

    const incident = db.incidents.find(i => i.id === id);
    res.json(incident);
  } catch (e) {
    next(e);
  }
});

// Auth (placeholder, mirrors frontend demo credentials)
app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const role = normalizeRole(req.body?.role);
    const id = normalizeUserId(req.body?.id);
    const password = asString(req.body?.password);
    const name = asString(req.body?.name).trim();

    if (OWNER_ONLY && role !== "owner") {
      return res.status(403).json({ error: { message: "Owner-only mode enabled" } });
    }

    if (!isNonEmptyString(id)) return badRequest(res, "User id (email) is required");
    if (!isNonEmptyString(password) || password.length < 4) return badRequest(res, "Password must be at least 4 characters");

    const db = await updateDb(async db0 => {
      db0.users = Array.isArray(db0.users) ? db0.users : [];
      const exists = db0.users.some(u => u.role === role && String(u.id).toLowerCase() === id.toLowerCase());
      if (exists) throw Object.assign(new Error("USER_EXISTS"), { status: 409 });
      db0.users.push({
        id,
        role,
        name,
        passwordHash: bcrypt.hashSync(password, 10),
        createdAt: new Date().toISOString()
      });
    });

    const created = (db.users || []).find(u => u.role === role && String(u.id).toLowerCase() === id.toLowerCase());
    const user = publicUser(created || { id, role, name });
    return res.status(201).json({ token: issueToken(user), user });
  } catch (e) {
    next(e);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const role = normalizeRole(req.body?.role);
    const id = normalizeUserId(req.body?.id);
    const password = asString(req.body?.password);

    if (OWNER_ONLY && role !== "owner") {
      return res.status(403).json({ error: { message: "Owner-only mode enabled" } });
    }
    if (!isNonEmptyString(id) || !isNonEmptyString(password)) return badRequest(res, "Id and password are required");

    const db = await getDb();
    const users = Array.isArray(db.users) ? db.users : [];
    const found = users.find(u => u.role === role && String(u.id).toLowerCase() === id.toLowerCase());
    if (!found) return badRequest(res, "Invalid credentials");

    const ok = bcrypt.compareSync(password, found.passwordHash || "");
    if (!ok) return badRequest(res, "Invalid credentials");

    const user = publicUser(found);
    return res.json({ token: issueToken(user), user });
  } catch (e) {
    next(e);
  }
});

// Error handler
app.use((err, req, res, next) => {
  const status = err?.status || 500;
  if (status === 400) return res.status(400).json({ error: { message: err.message || "Bad request" } });
  if (status === 409) return res.status(409).json({ error: { message: "Already exists" } });
  if (status === 404) return res.status(404).json({ error: { message: "Not found" } });

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(status).json({ error: { message: "Server error" } });
});

async function main() {
  const port = Number(process.env.PORT || 8080);

  // Seed automatically the first time (if empty)
  await updateDb(async db0 => {
    const empty = (db0.nodes?.length ?? 0) === 0 && (db0.packages?.length ?? 0) === 0;
    if (empty) seedDb(db0, { packageCount: 30 });

    // Ensure demo users always exist (even if DB was created before users were added).
    db0.users = Array.isArray(db0.users) ? db0.users : [];
    if (db0.users.length === 0) {
      const now = new Date().toISOString();
      db0.users.push(
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
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`LogiRoute backend listening on http://localhost:${port}`);
  });
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
