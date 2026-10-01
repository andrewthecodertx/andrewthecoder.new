import fs from "bun:fs";
import path from "bun:path";
import { Router } from "./src/router.js";
import { loadControllers } from "./src/controllers/index.js";
import { makeView } from "./src/lib/view.js";
import * as markdown from "./src/lib/markdown.js";
import { serveStatic } from "./src/http.js";
import { config } from "./src/config.js";

const view = makeView(undefined, markdown);
const ctrls = loadControllers({ view, markdown });
const router = new Router();
router.use((req) => { req._view = view; });
router.register(
  JSON.parse(fs.readFileSync("src/routes.json", "utf8")).routes,
  ctrls,
);
const PUBLIC_ROOT = path.resolve("public");
router.notFound(async (req, res) => {
  const s = await serveStatic(req, PUBLIC_ROOT);
  if (s) return s;
  return res.status(404).html(view.render("errors/404", { pageTitle: "Resource Not found" }));
});
router.onError((err, req, res) => {
  console.log("  [onError] " + err.constructor.name + ": " + err.message);
  return res.status(500).html(view.render("errors/500", {
    pageTitle: "Internal error",
    error: config.isDev ? { message: err.message, stack: err.stack } : null,
  }));
});

const handler = router.handler();
const cases = [
  "/", "/challenges", "/playground", "/blog",
  "/blog/conway-game-of-life-in-rust",
  "/blog/does-not-exist",
  "/blog/%", "/blog/%zz", "/blog/caf%C3%A9",
  "/demos", "/demos/conway", "/demos/nope",
  "/projects", "/projects/enchanter", "/projects/nope",
  "/static/site.css",
];

let fails = 0;
console.log("=== ROUTE SMOKE ===");
for (const p of cases) {
  const r = await handler(new Request("http://localhost" + p));
  const b = await r.text();
  const bad = r.status >= 500;
  if (bad) fails++;
  console.log(String(r.status).padEnd(4), p.padEnd(38), "len=" + String(b.length).padEnd(7), bad ? "<<< 5xx" : "");
}

// Assert the two specific regressions are gone.
console.log("\n=== ASSERTIONS ===");
const checks = [
  { path: "/blog/does-not-exist", want: 404, label: "missing post -> 404" },
  { path: "/blog/%", want: 404, label: "malformed % -> 404" },
  { path: "/blog/%zz", want: 404, label: "malformed %zz -> 404" },
  { path: "/blog/conway-game-of-life-in-rust", want: 200, label: "real post still 200" },
  { path: "/blog/caf%C3%A9", want: 404, label: "valid utf8 decodes then 404s" },
  { path: "/projects/enchanter", want: 200, label: "project detail 200" },
];
let bad = 0;
for (const c of checks) {
  const r = await handler(new Request("http://localhost" + c.path));
  const ok = r.status === c.want;
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", c.label.padEnd(34), "got", r.status, "want", c.want);
}
console.log(`\n5xx responses: ${fails} | assertion failures: ${bad}`);
process.exit(bad === 0 && fails === 0 ? 0 : 1);
