import fs from "bun:fs";
import path from "bun:path";
import md from "markdown-it";
import footnote from "markdown-it-footnote";

const BLOG_ROOT = path.resolve(import.meta.dir, "../content/blog");

let mdLib = md({
  // Raw HTML in post bodies is intentional — several posts ship hand-written
  // markup (e.g. building-weightogether.md uses <div> rows). Escaping it was
  // a content-integrity regression vs the Astro site.
  html: true,
  linkify: true,
  typographer: true,
}).use(footnote);

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };

  let end = raw.indexOf("\n---", 4);

  if (end === -1) return { meta: {}, body: raw };

  let block = raw.slice(4, end);
  let body = raw.slice(end + 4);
  let meta = {};

  for (let line of block.split("\n")) {
    if (!line.includes(":")) continue;

    let i = line.indexOf(":");
    let key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    // strip a leading/trailing matching quote pair
    if (val.length >= 2 && val[0] === "'" && val[val.length - 1] === "'") {
      val = val.slice(1, -1);
    } else if (
      val.length >= 2 &&
      val[0] === '"' &&
      val[val.length - 1] === '"'
    ) {
      val = val.slice(1, -1);
    }

    meta[key] = decodeFrontmatterValue(val);
  }

  return { meta, body };
}

// Decode simple YAML-ish values in frontmatter ("true"/"false", numbers,
// and ['a', 'b'] style arrays). Everything else stays a string.
function decodeFrontmatterValue(val) {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^-?\d+$/.test(val)) return Number(val);

  const arrayMatch = val.match(/^\s*\[\s*(.*?)\s*\]\s*$/s);
  if (arrayMatch) {
    const inner = arrayMatch[1];
    if (inner === "") return [];
    // Split on commas not nested in quotes (simple case: no nested brackets)
    return inner.split(/,(?=(?:[^'"]*['"][^'"]*['"])*[^'"]*$)/).map((item) =>
      item.trim().replace(/^['"]|['"]$/g, ""),
    );
  }

  return val;
}

export function loadPost(slug) {
  let file = path.join(BLOG_ROOT, `${slug}.md`);

  if (!fs.existsSync(file)) {
    return null;
  }

  const cached = BLOG_CACHE.get(slug);
  const mtime = readMtime(file);

  if (cached && cached.mtimeMs === mtime) {
    return cached.post;
  }

  const post = renderPost(slug, fs.readFileSync(file, "utf8"));

  BLOG_CACHE.set(slug, { post, mtimeMs: mtime });

  return post;
}

function renderPost(slug, raw) {
  let { meta, body } = parseFrontmatter(raw);

  return {
    slug,
    meta,
    html: mdLib.render(body),
  };
}

const BLOG_CACHE = new Map(); // slug -> { post, mtimeMs }
let BLOG_INDEX_CACHE = null; // { posts, mtimes: Map<slug, mtimeMs> }

function readMtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

// mtime-aware cache: re-parses only when a file's mtime changed. In prod the
// content is static after deploy; in dev, dev.js restarts the child on .md
// edits anyway, so this makes index renders ~O(1) instead of 22 file reads +
// full markdown render per request.
function loadBlogPostsCached(n, f) {
  const names = fs.readdirSync(BLOG_ROOT).filter((fn) => fn.endsWith(".md"));
  const mtimes = new Map();
  let dirty = !BLOG_INDEX_CACHE;

  for (const name of names) {
    const slug = name.replace(/\.md$/, "");
    const mtime = readMtime(path.join(BLOG_ROOT, name));
    mtimes.set(slug, mtime);
    if (!dirty && BLOG_INDEX_CACHE.mtimes.get(slug) !== mtime) {
      dirty = true;
    }
  }

  // A deleted file also dirties the cache (missing from the new mtimes map).
  if (!dirty && BLOG_INDEX_CACHE.mtimes.size !== mtimes.size) {
    dirty = true;
  }

  if (dirty) {
    const posts = names
      .map((name) => {
        const slug = name.replace(/\.md$/, "");
        return renderPost(
          slug,
          fs.readFileSync(path.join(BLOG_ROOT, name), "utf8"),
        );
      })
      .filter((p) => p.meta.publishDate)
      .filter((p) => !(p.meta.hidden === true || p.meta.hidden === "true"))
      .sort((a, b) =>
        (b.meta.publishDate || "").localeCompare(a.meta.publishDate || ""),
      );

    BLOG_INDEX_CACHE = { posts, mtimes };
    // Keep the per-slug cache in sync so loadPost benefits from the same parse.
    for (const p of posts) {
      BLOG_CACHE.set(p.slug, { post: p, mtimeMs: mtimes.get(p.slug) });
    }
  }

  let posts = BLOG_INDEX_CACHE.posts;

  if (f) {
    posts = posts.filter(
      (p) => p.meta.featured === true || p.meta.featured === "true",
    );
  }

  return n > 0 ? posts.slice(0, n) : posts;
}

export function loadBlogPosts(n = 0, f = false) {
  return loadBlogPostsCached(n, f);
}

export function formatDate(iso) {
  if (!iso) return "";

  // Parse YYYY-MM-DD as LOCAL time to avoid UTC midnight shift in negative-UTC timezones
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    let d = new Date(+match[1], +match[2] - 1, +match[3]);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Parse YYYY-MM-DDTHH:MM[:SS] as LOCAL time as well.
  const dtMatch = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (dtMatch) {
    let d = new Date(
      +dtMatch[1],
      +dtMatch[2] - 1,
      +dtMatch[3],
      +dtMatch[4],
      +dtMatch[5],
      dtMatch[6] ? +dtMatch[6] : 0,
    );
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return iso;
}
