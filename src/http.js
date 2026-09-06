import fs from "node:fs";
import path from "node:path";

export function parseQuery(search) {
  const out = {};

  for (const [key, value] of new URLSearchParams(search)) {
    if (key in out) {
      out[key] = Array.isArray(out[key])
        ? [...out[key], value]
        : [out[key], value];
    } else {
      out[key] = value;
    }
  }

  return out;
}

export function prepareRequest(bunReq, server) {
  const url = new URL(bunReq.url);
  const req = bunReq;

  req.path = url.pathname;
  req.query = parseQuery(url.search);
  req.params = {};
  req.server = server;

  return req;
}

export function makeResponseHelpers() {
  let statusCode = 200;
  const headers = new Headers();

  const api = {
    status(code) {
      statusCode = code;
      return api;
    },
    header(name, value) {
      headers.set(name, value);
      return api;
    },
    json(data, code) {
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(data), {
        status: code ?? statusCode,
        headers,
      });
    },
    text(data, code) {
      headers.set("Content-Type", "text/plain; charset=utf-8");
      return new Response(String(data), {
        status: code ?? statusCode,
        headers,
      });
    },
    html(data, code) {
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(data, { status: code ?? statusCode, headers });
    },
    redirect(location, code = 302) {
      headers.set("Location", location);
      return new Response(null, { status: code, headers });
    },
    send(body, code) {
      return new Response(body, { status: code ?? statusCode, headers });
    },
  };

  return api;
}

export function serveStatic(bunReq, publicRoot) {
  const url = new URL(bunReq.url);
  let filePath = path.join(publicRoot, url.pathname);

  if (url.pathname === "/" || filePath.endsWith("/")) {
    filePath = path.join(publicRoot, "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return null;
  }

  const type =
    {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".png": "image/png",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    }[path.extname(filePath)] || "application/octet-stream";

  const body = fs.readFileSync(filePath);

  return new Response(body, { headers: { "Content-Type": type } });
}
