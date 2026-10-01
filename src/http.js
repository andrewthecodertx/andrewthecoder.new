import fs from "bun:fs";
import path from "bun:path";

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

export async function serveStatic(bunReq, publicRoot) {
  const url = new URL(bunReq.url);
  let filePath;

  // Defense-in-depth: reject any path segment containing ".." (Bun's URL
  // normalizes dot segments, but a future code path that hand-builds a
  // pathname could reintroduce traversal). Reject raw "%2e%2e" too.
  if (
    /\/(?:\.\.|%2e%2e)(?:\/|$)/i.test(url.pathname) ||
    url.pathname.includes("..")
  ) {
    return null;
  }

  filePath = path.join(publicRoot, url.pathname);

  if (url.pathname === "/" || filePath.endsWith("/")) {
    filePath = path.join(publicRoot, "index.html");
  }

  const f = Bun.file(filePath);
  let st;

  try {
    st = await f.stat();
  } catch {
    return null;
  }

  if (!st.isFile()) {
    return null;
  }

  const type =
    {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".mjs": "text/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".txt": "text/plain; charset=utf-8",
      ".xml": "application/xml",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
    }[path.extname(filePath)] || "application/octet-stream";

  return new Response(f, { headers: { "Content-Type": type } });
}
