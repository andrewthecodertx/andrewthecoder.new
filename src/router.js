/**
 * router.js — a minimal, dependency-free HTTP router for Bun.
 *
 * Features:
 *  - Method-based routing (get/post/put/patch/delete/head/options/all)
 *  - Path params:      /users/:id
 *  - Optional params:  /users/:id?
 *  - Wildcards:        /files/*  (captured as req.params.wildcard)
 *  - Middleware:       router.use(fn) — global, or per-route via extra args
 *  - Route groups:     router.group('/api', r => { r.get('/health', ...) })
 *  - Query string parsing (req.query)
 *  - JSON body helper (req.json()), already native via Bun's Request
 *  - res helpers: json(), text(), html(), redirect(), status()
 *  - 404 / 405 / error handlers you can override
 *  - Zero dependencies — just Bun.serve
 *
 * Usage:
 *   import { Router } from './router.js';
 *   const router = new Router();
 *
 *   router.use((req) => { console.log(req.method, req.path); });
 *
 *   router.get('/', (req, res) => res.text('hello'));
 *   router.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
 *
 *   Bun.serve({ port: 3000, fetch: router.handler() });
 */
import { prepareRequest, makeResponseHelpers } from "./http.js";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export class Router {
  constructor() {
    this.routes = []; // { method, regex, paramNames, handlers, raw }
    this.middleware = [];
    this.notFoundHandler = (req, res) =>
      res.status(404).json({ error: "Not Found", path: req.path });
    this.errorHandler = (err, req, res) => {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    };
  }

  use(fn) {
    this.middleware.push(fn);

    return this;
  }

  group(prefix, fn) {
    const sub = new Router();

    fn(sub);

    const base = prefix.replace(/\/$/, "");

    for (const route of sub.routes) {
      const raw = base + route.raw;
      const { regex, paramNames } = this.compileRoute(raw);

      // Group middleware runs before this route's own handlers (scoped to
      // the group — it is NOT appended to the top-level middleware list).
      const middleware = [...sub.middleware, ...(route.middleware || [])];

      this.routes.push({ ...route, raw, regex, paramNames, middleware });
    }

    return this;
  }

  _add(method, path, handlers) {
    const { regex, paramNames } = this.compileRoute(path);

    this.routes.push({ method, regex, paramNames, handlers, middleware: [], raw: path });

    return this;
  }

  get(path, ...handlers) {
    return this._add("GET", path, handlers);
  }

  post(path, ...handlers) {
    return this._add("POST", path, handlers);
  }

  put(path, ...handlers) {
    return this._add("PUT", path, handlers);
  }

  patch(path, ...handlers) {
    return this._add("PATCH", path, handlers);
  }

  delete(path, ...handlers) {
    return this._add("DELETE", path, handlers);
  }

  head(path, ...handlers) {
    return this._add("HEAD", path, handlers);
  }

  options(path, ...handlers) {
    return this._add("OPTIONS", path, handlers);
  }

  all(path, ...handlers) {
    for (const m of METHODS) this._add(m, path, handlers);

    return this;
  }

  /**
   * Register routes from a config array (see routes.json) against controllers.
   * Each entry: { method, path, controller, action }.
   * controllers maps a name -> an instance (or class to resolve lazily).
   * Controllers receive a render fn via res.render('view', locals).
   */
  register(routes, controllers) {
    for (const r of routes) {
      const method = (r.method || "GET").toUpperCase();

      if (!METHODS.includes(method) && method !== "ALL") continue;

      const ctrl = controllers[r.controller];

      if (!ctrl)
        throw new Error(
          `register: unknown controller '${r.controller}' (route ${r.path})`,
        );

      const fn = typeof ctrl === "function" ? ctrl : ctrl[r.action];

      if (typeof fn !== "function") {
        throw new Error(
          `register: controller '${r.controller}' has no action '${r.action}' (route ${r.path})`,
        );
      }
      // bind the action and expose res.render from the request-scoped view renderer
      const bound = fn.bind(ctrl);
      const handler = (req, res) => {
        if (req._view) {
          res.render = (name, data) => res.html(req._view.render(name, data));
        }

        return bound(req, res);
      };
      if (method === "ALL") {
        this.all(r.path, handler);
      } else {
        this[method.toLowerCase()](r.path, handler);
      }
    }

    return this;
  }

  notFound(fn) {
    this.notFoundHandler = fn;

    return this;
  }

  onError(fn) {
    this.errorHandler = fn;

    return this;
  }

  // Returns a fetch-compatible handler for Bun.serve({ fetch: router.handler() })
  handler() {
    return async (bunReq, server) => {
      const url = new URL(bunReq.url);
      const method = bunReq.method.toUpperCase();
      const req = prepareRequest(bunReq, server);
      const res = makeResponseHelpers();

      try {
        for (const mw of this.middleware) {
          const result = await mw(req, res);

          if (result instanceof Response) {
            return result;
          }
        }

        const candidates = this.routes.filter((r) => r.method === method);
        let matched = null;
        let allowedMethods = new Set();

        for (const route of this.routes) {
          const m = route.regex.exec(url.pathname);

          if (m) {
            allowedMethods.add(route.method);

            if (route.method === method) {
              matched = { route, m };
              break;
            }
          }
        }

        if (!matched) {
          if (allowedMethods.size > 0) {
            return res
              .status(405)
              .header("Allow", [...allowedMethods].join(", "))
              .json({ error: "Method Not Allowed", path: url.pathname });
          }

          const result = await this.notFoundHandler(req, res);

          return result instanceof Response
            ? result
            : res.status(404).json({ error: "Not Found" });
        }

        const { route, m } = matched;

        route.paramNames.forEach((name, i) => {
          req.params[name] =
            m[i + 1] !== undefined ? decodeURIComponent(m[i + 1]) : undefined;
        });

        // Route/group middleware — runs only for the matched route.
        for (const mw of route.middleware || []) {
          const result = await mw(req, res);

          if (result instanceof Response) {
            return result;
          }
        }

        let finalResult;

        for (const handler of route.handlers) {
          finalResult = await handler(req, res);

          if (finalResult instanceof Response) {
            return finalResult;
          }
        }
        return finalResult instanceof Response
          ? finalResult
          : res
              .status(500)
              .json({ error: "Handler did not return a Response" });
      } catch (err) {
        const result = await this.errorHandler(err, req, res);

        return result instanceof Response
          ? result
          : res.status(500).json({ error: "Internal Server Error" });
      }
    };
  }

  // Turn "/users/:id/edit?" or "/files/*" into a RegExp + param name list.
  compileRoute(path) {
    const paramNames = [];
    const segments = path.split("/").filter(Boolean);
    const parts = segments.map((seg) => {
      if (seg === "*") {
        paramNames.push("wildcard");
        return "(.*)";
      }
      if (seg.startsWith(":")) {
        const optional = seg.endsWith("?");
        const name = optional ? seg.slice(1, -1) : seg.slice(1);
        paramNames.push(name);
        return optional ? "(?:([^/]+))?" : "([^/]+)";
      }

      return seg.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    });

    const pattern = "^/" + parts.join("/") + "/?$";

    return { regex: new RegExp(pattern), paramNames };
  }
}
