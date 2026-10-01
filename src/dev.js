// dev.js — development server with hot reload for JS AND templates/content.
//
// Why this file exists:
//   bun --watch restarts only when an IMPORTED module changes. This app reads
//   views (.ejs), blog posts (.md), and routes.json via fs at request time,
//   so edits to those would silently go unnoticed. dev.js therefore:
//     1. spawns `bun --watch src/server.js` (restarts on JS changes), and
//     2. watches non-JS source files (views, content, routes.json) and
//        restarts the child when any of them change.
//
// Usage: bun run dev   (or: bun src/dev.js)
import fs from "bun:fs";
import path from "bun:path";

const ROOT = path.resolve(import.meta.dir, "..");
// Watch these non-JS source locations (relative to ROOT). JS files are
// already covered by bun --watch inside the child process.
const WATCH_DIRS = ["src/views", "src/content", "src/routes.json"];

let child = null;
let restartTimer = null;
let stopping = false; // true while WE are stopping the child (for restart/shutdown)

function startServer() {
  stopping = false;
  child = Bun.spawn(
    [process.execPath, "--watch", "src/server.js"],
    {
      cwd: ROOT,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: { ...process.env, NODE_ENV: "development" },
    },
  );

  child.exited.then((code) => {
    // If the child died on its own (crash / Ctrl+C on the child), shut the
    // runner down rather than spawn a zombie. If WE killed it (restart or
    // shutdown), just clear the reference.
    if (!stopping) {
      if (code !== 0) {
        console.error(`[dev] server exited unexpectedly with code ${code}`);
      }
      process.exit(0);
    }
    child = null;
  });
}

function stopServer() {
  if (child) {
    stopping = true;
    child.kill("SIGTERM");
    child = null;
  }
}

function restart(msg) {
  if (restartTimer) return; // already queued

  console.log(`\n[dev] ${msg} — restarting…`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    stopServer();
    // Give the old process a moment to release the port before rebinding.
    setTimeout(startServer, 150);
  }, 120);
}

function watchDir(dir) {
  const full = path.join(ROOT, dir);

  if (!fs.existsSync(full)) return;

  fs.watch(full, { recursive: true }, (event, filename) => {
    if (!filename) return;
    // Ignore editor temp/swap files and dotfiles
    const basename = path.basename(filename);

    if (basename.startsWith(".") || basename.endsWith("~") || basename.includes(".swp")) {
      return;
    }
    restart(`changed: ${path.join(dir, filename)}`);
  });
}

startServer();
for (const dir of WATCH_DIRS) watchDir(dir);

// Shutdown: Ctrl+C on the parent also stops the child.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopping = true;
    stopServer();
    process.exit(0);
  });
}

console.log("[dev] watching views, content, and routes.json for changes");