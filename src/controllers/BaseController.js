import fs from "bun:fs";
import path from "bun:path";

// Single source of truth for data-file lookup. All JSON data lives in src/,
// and never reference this by string-joining "../" relative paths — a future
// move (e.g. controllers into subdirs) silently breaks relative resolution.
export const DATA_ROOT = path.resolve(import.meta.dir, "..");
export const PUBLIC_ROOT = path.resolve(DATA_ROOT, "../public");

export class BaseController {
  constructor(ctx) {
    this.ctx = ctx; // { view, markdown }
  }

  loadBlogPosts(n = 0, f = false) {
    return this.ctx.markdown.loadBlogPosts(n, f);
  }

  loadProjects() {
    return JSON.parse(
      fs.readFileSync(path.join(DATA_ROOT, "projects.json"), "utf8"),
    ).projects;
  }

  loadDemos(n = 0) {
    let demos = JSON.parse(
      fs.readFileSync(path.join(DATA_ROOT, "demos.json"), "utf8"),
    ).demos;

    return n === 0 ? demos : demos.slice(0, n);
  }

  // True when the given site-relative asset path (e.g. /assets/blog/x.webp)
  // exists in this repo's public dir. Used to avoid emitting <img> for
  // images that only exist on the production site.
  assetExists(sitePath) {
    if (!sitePath || !sitePath.startsWith("/")) return false;
    const file = path.join(PUBLIC_ROOT, sitePath.replace(/^\/+/, ""));

    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  }
}
