const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const dbDir = path.join(repoRoot, ".dist");

async function waitForHealth(baseUrl, child) {
  const started = Date.now();
  let lastError;

  while (Date.now() - started < 8000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }

    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
      lastError = new Error(`Health returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  throw lastError || new Error("Timed out waiting for server health");
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 2000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

test("backend serves state, auth, and bulk package updates", async () => {
  await fs.mkdir(dbDir, { recursive: true });

  const port = 19000 + Math.floor(Math.random() * 1000);
  const dbFile = path.join(dbDir, `test-db-${process.pid}-${port}.json`);
  const child = spawn(process.execPath, ["backend/src/server.js"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), LR_DB_FILE: dbFile },
    stdio: "ignore",
    windowsHide: true
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl, child);

    const stateRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(stateRes.status, 200);
    const state = await stateRes.json();
    assert.equal(state.nodes.length, 45);
    assert.equal(state.packages.length, 30);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner", id: "owner@logiroute.in", password: "owner123" })
    });
    assert.equal(loginRes.status, 200);
    const session = await loginRes.json();
    assert.ok(session.token);

    const bulkRes = await fetch(`${baseUrl}/api/packages/bulk`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        updates: [
          { id: "LR24000", status: "In Transit", truckId: "TRK-TEST", eta: "10:30 AM" },
          { id: "LR24001", instructions: "Leave at reception" }
        ]
      })
    });
    assert.equal(bulkRes.status, 200);
    const bulk = await bulkRes.json();
    assert.equal(bulk.updated, 2);

    const pkgRes = await fetch(`${baseUrl}/api/packages/LR24000`);
    assert.equal(pkgRes.status, 200);
    const pkg = await pkgRes.json();
    assert.equal(pkg.status, "In Transit");
    assert.equal(pkg.truckId, "TRK-TEST");
    assert.equal(pkg.eta, "10:30 AM");

    const badDestinationRes = await fetch(`${baseUrl}/api/packages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        id: "LR-INVALID-001",
        recipient: "Demo User",
        destination: "Mysuru"
      })
    });
    assert.equal(badDestinationRes.status, 400);

    const outsideBlrRes = await fetch(`${baseUrl}/api/packages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        id: "LR-INVALID-002",
        recipient: "Demo User",
        node: 1,
        destination: "Koramangala",
        lat: 12.9716,
        lng: 80.2707
      })
    });
    assert.equal(outsideBlrRes.status, 400);

    const addNearNodeRes = await fetch(`${baseUrl}/api/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        name: "Near BLR Test Node",
        lat: 13.18,
        lng: 77.69
      })
    });
    assert.equal(addNearNodeRes.status, 201);
    const createdNode = await addNearNodeRes.json();
    assert.equal(createdNode.name, "Near BLR Test Node");

    const addByNameOnlyRes = await fetch(`${baseUrl}/api/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        name: "Koramangala East"
      })
    });
    assert.equal(addByNameOnlyRes.status, 201);
    const byNameNode = await addByNameOnlyRes.json();
    assert.equal(byNameNode.name, "Koramangala East");

    const addFarNodeRes = await fetch(`${baseUrl}/api/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({
        name: "Far Test Node",
        lat: 12.9716,
        lng: 80.2707
      })
    });
    assert.equal(addFarNodeRes.status, 400);
  } finally {
    await stopServer(child);
    await fs.rm(dbFile, { force: true });
  }
});
