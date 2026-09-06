// config.js — runtime configuration, centralized.
//
// Bun loads .env / .env.development / .env.production automatically
// (see env.js for the layering rules). This module maps those values onto
// typed defaults so the rest of the app never reads process.env directly.
import { IS_DEV } from "./env.js";

function num(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") return fallback;

  const n = Number(raw);

  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  // Environment mode (dev unless NODE_ENV=production)
  isDev: IS_DEV,

  // HTTP server
  port: num("PORT", 3000),
  host: process.env.HOST || "0.0.0.0",

  // Logging: every request gets logged in dev; prod defaults to off
  // (set LOG_REQUESTS=1 to enable everywhere).
  logRequests: IS_DEV ? true : process.env.LOG_REQUESTS === "1",
};