import fs from "bun:fs";
import path from "bun:path";
import { Router } from "./router.js";
import { makeView } from "./lib/view.js";
import * as markdown from "./lib/markdown.js";
import { loadControllers } from "./controllers/index.js";
import { serveStatic } from "./http.js";
import { config } from "./config.js";

const SRV_ROOT = import.meta.dir;
const PUBLIC_ROOT = path.resolve(SRV_ROOT, "../public");

let app = {
  view: makeView(undefined, markdown),
  markdown,
  controllers: {},
};

// Build controllers sharing a single view+markdown context
app.controllers = loadControllers(app);

let router = new Router();

// Global middleware — log every request (dev only) + expose the view renderer
router.use((req) => {
  req._view = app.view;

  if (config.logRequests) {
    console.log(`${req.method} ${req.path}`);
  }
});

// Load routes.json and register against controllers
let routes = JSON.parse(
  fs.readFileSync(path.join(SRV_ROOT, "routes.json"), "utf8"),
).routes;

router.register(routes, app.controllers);

// 404
router.notFound(async (req, res) => {
  const staticRes = await serveStatic(req, PUBLIC_ROOT);

  if (staticRes) {
    return staticRes;
  }

  return res
    .status(404)
    .html(app.view.render("errors/404", { pageTitle: "Resource Not found" }));
});

// Error handler
router.onError((err, req, res) => {
  console.error("Unhandled error:", err.message);

  return res.status(500).html(
    app.view.render("errors/500", {
      pageTitle: "Internal error",
      error: config.isDev ? { message: err.message, stack: err.stack } : null,
    }),
  );
});

Bun.serve({
  port: config.port,
  hostname: config.host,

  fetch: async (req) => {
    let url = new URL(req.url);
    let staticRes = url.pathname.startsWith("/static/")
      ? await serveStatic(req, PUBLIC_ROOT)
      : null;

    if (staticRes) {
      return staticRes;
    }

    let handler = router.handler();

    return handler(req, null);
  },
});

console.log(
  `Andrew the Coder MVC listening on http://${config.host}:${config.port}`,
);
console.log(`Routes registered: ${routes.length}`);
console.log(`Mode: ${config.isDev ? "development" : "production"}`);
