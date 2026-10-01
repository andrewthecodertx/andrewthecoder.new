import { prepareRequest, makeResponseHelpers } from "./http.js";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function isValidSegmentParam(value) {
  if (value === undefined) return true;
  if (value.includes("/") || value.includes("\\")) return false;
  if (value === "." || value === "..") return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(value)) return false;
  return true;
}

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
      const middleware = [...sub.middleware, ...(route.middleware || [])];

      this.routes.push({ ...route, raw, regex, paramNames, middleware });
    }

    return this;
  }

  _add(method, path, handlers) {
    const { regex, paramNames } = this.compileRoute(path);

    this.routes.push({
      method,
      regex,
      paramNames,
      handlers,
      middleware: [],
      raw: path,
    });

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
      const pathname = decodePathname(url.pathname);

      if (pathname === null) {
        return this.notFoundHandler(req, res);
      }

      req.path = pathname;

      try {
        for (const mw of this.middleware) {
          const result = await mw(req, res);

          if (result instanceof Response) {
            return result;
          }
        }

        let matched = null;
        const allowedMethods = new Set();

        for (const route of this.routes) {
          const m = route.regex.exec(pathname);

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
              .json({ error: "Method Not Allowed", path: pathname });
          }

          const result = await this.notFoundHandler(req, res);

          return result instanceof Response
            ? result
            : res.status(404).json({ error: "Not Found" });
        }

        const { route, m } = matched;

        let paramInvalid = false;

        route.paramNames.forEach((name, i) => {
          const value = m[i + 1];

          // Values are already decoded; validating the segment shape here is
          // what rejects the ones ([^/]+) still admits, e.g. "%2e%2e".
          if (name !== "wildcard" && !isValidSegmentParam(value)) {
            paramInvalid = true;
          }

          req.params[name] = value;
        });

        if (paramInvalid) {
          return this.notFoundHandler(req, res);
        }

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
