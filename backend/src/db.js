const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_DB_FILE = path.join(__dirname, "..", "data", "db.json");

function getDbFilePath() {
  return process.env.LR_DB_FILE ? path.resolve(process.env.LR_DB_FILE) : DEFAULT_DB_FILE;
}

function createEmptyDb() {
  return {
    meta: { version: 1, createdAt: new Date().toISOString() },
    users: [],
    nodes: [],
    trucks: [],
    packages: [],
    incidents: []
  };
}

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function loadDb() {
  const filePath = getDbFilePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyDb(),
      ...parsed,
      meta: { ...createEmptyDb().meta, ...(parsed.meta ?? {}) }
    };
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return createEmptyDb();
    throw error;
  }
}

async function saveDb(db) {
  const filePath = getDbFilePath();
  await ensureDirExists(filePath);

  const tmpPath = filePath + ".tmp";
  const payload = JSON.stringify(db, null, 2);
  await fs.writeFile(tmpPath, payload, "utf8");

  // Atomic rename can fail on Windows/OneDrive due to sync/lock behavior (EPERM/EBUSY).
  // Fall back to a direct write to keep the demo app reliable.
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    const code = error && error.code;
    if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
      await fs.writeFile(filePath, payload, "utf8");
      try { await fs.unlink(tmpPath); } catch { /* ignore */ }
      return;
    }
    throw error;
  }
}

let cached = null;
let cachedAt = 0;

async function getDb() {
  if (cached) return cached;
  cached = await loadDb();
  cachedAt = Date.now();
  return cached;
}

async function updateDb(mutator) {
  const db = await getDb();
  await mutator(db);
  db.meta.updatedAt = new Date().toISOString();
  await saveDb(db);
  return db;
}

function invalidateCache() {
  cached = null;
  cachedAt = 0;
}

module.exports = {
  getDb,
  updateDb,
  saveDb,
  loadDb,
  invalidateCache,
  createEmptyDb,
  getDbFilePath
};
