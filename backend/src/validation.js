function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pick(obj, keys) {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
  }
  return out;
}

function badRequest(res, message, details) {
  return res.status(400).json({ error: { message, details } });
}

function notFound(res, message = "Not found") {
  return res.status(404).json({ error: { message } });
}

module.exports = {
  isNonEmptyString,
  asString,
  asNumber,
  pick,
  badRequest,
  notFound
};
