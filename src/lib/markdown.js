import fs from "bun:fs";
import path from "bun:path";
import md from "markdown-it";
import footnote from "markdown-it-footnote";

const BLOG_ROOT = path.resolve(import.meta.dir, "../content/blog");

// Slugs come straight off the URL (/blog/:slug), so they are attacker-controlled.
// path.join() collapses "..", so a slug like "..%2f..%2fetc" (which the router
// decodes to "../../etc") escapes BLOG_ROOT entirely. Enforce the invariant at
// the filesystem boundary instead of trusting every call site: the resolved
// candidate must sit directly inside BLOG_ROOT, and the slug must be a plain
// file name -- no separators, no traversal, no leading dot.
function resolvePostFile(slug) {
  if (typeof slug !== "string" || slug === "") return null;
  if (slug !== slug.trim()) return null;
  if (slug === "." || slug === "..") return null;
  if (slug.includes("/") || slug.includes("\\")) return null;
  // Reject any NUL/control byte; a truncated path is never a real post.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(slug)) return null;

  const file = path.join(BLOG_ROOT, `${slug}.md`);

  // NOTE: no containment assertion here. The string checks above already make
  // it impossible to leave BLOG_ROOT lexically, and the authoritative check
  // needs the kernel's realpath -- see resolveExistingPostFile() below.
  return file;
}

// Same invariant, checked against the path the kernel actually resolves.
// resolvePostFile()'s checks are purely lexical, so a symlink sitting inside
// BLOG_ROOT would pass them while still reading content from outside the root.
// realpathSync() collapses every symlink, so comparing the resolved parent to
// the resolved root is what makes "stays inside BLOG_ROOT" true rather than
// merely plausible. Returns null for anything missing, not a regular file, or
// resolving outside -- callers treat null as "not a post".
function resolveExistingPostFile(slug) {
  const file = resolvePostFile(slug);

  if (!file) return null;

  // The real BLOG_ROOT must itself be symlink-free, or this comparison is
  // against an unresolved prefix and could never match.
  let realRoot;

  try {
    realRoot = fs.realpathSync(BLOG_ROOT);
  } catch {
    return null;
  }

  // Not using a `real.startsWith(\`${realRoot}${path.sep}\`)` prefix test here,
  // for two reasons, both load-bearing:
  //   1. WITHOUT the trailing separator it wrongly accepts a SIBLING whose
  //      name merely begins with BLOG_ROOT -- /content/blog-backup/x.md and
  //      /content/blogarchive/x.md both start with "/content/blog".
  //   2. WITH the separator it still admits any SUBDIRECTORY of BLOG_ROOT.
  // Comparing the resolved parent to the resolved root states the actual
  // invariant -- a post is a direct child -- in one unambiguous step.
  let real;

  try {
    real = fs.realpathSync(file);
  } catch {
    return null; // missing target
  }

  // Containment, checked realpath-vs-realpath on purpose. Comparing the
  // LEXICAL `file` against a realpath-derived prefix is a category error: it
  // holds only while BLOG_ROOT happens to contain no symlinked ancestor. The
  // moment one exists (/home -> /var/home, a linked worktree, a symlinked
  // repo checkout) the lexical path stops matching the real prefix and every
  // post silently 404s.
  //
  // The prefix test alone would also admit a SUBDIRECTORY of BLOG_ROOT (real
  // path ROOT/sub/x.md satisfies it), so pin the parent explicitly: a post is
  // always a direct child of the root. isFile() alone cannot do this, because
  // it stats the RESOLVED target and would happily accept a symlink pointing
  // into a subdirectory.
  if (path.dirname(real) !== realRoot) {
    return null; // resolved outside BLOG_ROOT, or nested below it
  }

  try {
    return fs.statSync(real).isFile() ? file : null;
  } catch {
    return null;
  }
}

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

  let arrayMatch = val.match(/^\s*\[\s*(.*?)\s*\]\s*$/s);
  if (arrayMatch) {
    let inner = arrayMatch[1];
    if (inner === "") return [];
    // Split on commas not nested in quotes (simple case: no nested brackets)
    return inner
      .split(/,(?=(?:[^'"]*['"][^'"]*['"])*[^'"]*$)/)
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""));
  }

  return val;
}

export function loadPost(slug) {
  // resolveExistingPostFile() performs the realpath containment check AND the
  // existence check, so both are settled before any read happens.
  const file = resolveExistingPostFile(slug);

  if (!file) {
    return null;
  }

  let cached = BLOG_CACHE.get(slug);
  let mtime = readMtime(file);

  if (cached && cached.mtimeMs === mtime) {
    return cached.post;
  }

  let post = renderPost(slug, fs.readFileSync(file, "utf8"));

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
  let names = fs.readdirSync(BLOG_ROOT).filter((fn) => fn.endsWith(".md"));
  let mtimes = new Map();
  let dirty = !BLOG_INDEX_CACHE;

  for (let name of names) {
    let slug = name.replace(/\.md$/, "");
    let mtime = readMtime(path.join(BLOG_ROOT, name));

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
    let posts = names
      .map((name) => {
        let slug = name.replace(/\.md$/, "");
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
    for (let p of posts) {
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
  let match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);

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
  let dtMatch = iso.match(
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
