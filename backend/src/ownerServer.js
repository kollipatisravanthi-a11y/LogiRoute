// Wrapper to run the backend in owner-only mode.
// This keeps Windows npm scripts simple (no cross-env needed).
process.env.LOGIROUTE_OWNER_ONLY = process.env.LOGIROUTE_OWNER_ONLY || "1";

require("./server");
