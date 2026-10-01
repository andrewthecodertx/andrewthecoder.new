// Regression test for the encoded-slash path-traversal fix.
// Two layers are covered:
//   1. src/router.js  (source)  - a decoded :param must remain ONE path segment
//   2. src/lib/markdown.js (sink) - a resolved post must stay inside BLOG_ROOT
// Run: bun test tools/traversal.test.js
import { expect, test } from "bun:test";
import fs from "bun:fs";
import path from "bun:path";
import { Router } from "../src/router.js";
import { loadPost } from "../src/lib/markdown.js";

const legit = "sudoku-backtracking-in-python";

// --- layer 1: the router source -------------------------------------------

function paramFromRequest(url) {
  const router = new Router();
  let seen = null;

  router.get(
    "/blog/:slug",
    (req, res) => {
      seen = req.params.slug;
      return res.status(200).json({ ok: true });
    },
  );
  router.notFound((req, res) => res.status(404).json({ error: "Not Found" }));

  return router
    .handler()(new Request(url), { port: 0 })
    .then((response) => ({ status: response.status, slug: seen }));
}

test("router: a normal slug param is delivered decoded", async () => {
  const { status, slug } = await paramFromRequest(
    "http://x/blog/sudoku-backtracking-in-python",
  );
  expect(status).toBe(200);
  expect(slug).toBe(legit);
});

test("router: an encoded slash no longer smuggles path segments into a :param", async () => {
  // Each of these MATCHES /blog/:slug when matched raw, but decodes to a value
  // containing "/" (or a bare traversal segment) -- which the [^/]+ pattern
  // promised could never happen. The handler must not be reached at all.
  const attacks = [
    "http://x/blog/..%2f..%2f..%2ftools%2fcanary-traversal",
    "http://x/blog/..%2f..%2fetc%2fpasswd",
    "http://x/blog/..%2f..%2f%2e%2e%2f%2e%2e",
    "http://x/blog/a%2fb",
    "http://x/blog/..%2f",
    "http://x/blog/..%5c..%5cwindows",
  ];

  for (const url of attacks) {
    const { status, slug } = await paramFromRequest(url);
    expect(status).toBe(404);
    expect(slug).toBeNull();
  }
});

test("router: wildcards may still capture across /", async () => {
  const router = new Router();
  let seen = null;

  router.get("/files/*", (req, res) => {
    seen = req.params.wildcard;
    return res.status(200).json({ ok: true });
  });
  router.notFound((req, res) => res.status(404).json({ error: "Not Found" }));

  const res = await router
    .handler()(new Request("http://x/files/a/b/c.txt"), { port: 0 });

  expect(res.status).toBe(200);
  expect(seen).toBe("a/b/c.txt");
});

// --- layer 2: the markdown sink -------------------------------------------

test("a real slug still loads", () => {
  const post = loadPost(legit);
  expect(post).toBeTruthy();
  expect(post.slug).toBe(legit);
  expect(post.html.length).toBeGreaterThan(0);
});

test("sink: traversal slugs resolve to nothing outside BLOG_ROOT", () => {
  for (const raw of [
    "../../../../.enchanter/SOUL",
    "../../../../../.enchanter/memories/SUMMARY",
    "../config",
    "..",
    ".",
    "/etc/passwd",
    "",
  ]) {
    expect(loadPost(decodeURIComponent(raw))).toBeNull();
  }
});

test("sink: non-string and hostile slugs are rejected", () => {
  for (const bad of [null, undefined, 0, {}, [], true, "a\x00b", "a\nb", " post "]) {
    expect(loadPost(bad)).toBeNull();
  }
});

test("sink: a symlink inside BLOG_ROOT cannot read content from outside it", () => {
  // The lexical dirname() check alone passes for a symlink whose lexical
  // location is a direct child of BLOG_ROOT, so containment has to be
  // re-verified against the realpath the kernel resolves.
  //
  // loadPost() appends ".md" to the slug, so the slug is the link's basename
  // WITHOUT the extension -- otherwise this would look for "x.md.md" and pass
  // for the wrong reason (target missing) instead of exercising the guard.
  const BLOG_ROOT = path.resolve(import.meta.dir, "../src/content/blog");
  const slug = "zz-tmp-symlink";
  const linkPath = path.join(BLOG_ROOT, `${slug}.md`);
  const outside = path.join(
    BLOG_ROOT,
    "..",
    "..",
    "..",
    "zz-tmp-secret.md",
  );

  // Clean any residue from a previously aborted run before creating fixtures,
  // so a red run cannot cascade into EEXIST noise.
  try {
    fs.unlinkSync(linkPath);
  } catch {
    /* not present */
  }
  try {
    fs.unlinkSync(outside);
  } catch {
    /* not present */
  }

  fs.writeFileSync(
    outside,
    "---\ntitle: t\npublishDate: 2026-10-01\n---\nSYMLINK_ESCAPE_4A11\n",
  );
  fs.symlinkSync(outside, linkPath);

  let result;

  try {
    // Precondition: the symlink really is a lexical child of BLOG_ROOT and
    // really does point outside it. Without these the test is vacuous.
    expect(path.dirname(linkPath)).toBe(BLOG_ROOT);
    expect(fs.realpathSync(linkPath)).toBe(path.resolve(outside));
    expect(fs.realpathSync(linkPath).startsWith(BLOG_ROOT + path.sep)).toBe(
      false,
    );

    // The whole point: no post, so no content from outside the root.
    result = loadPost(slug);
  } finally {
    fs.unlinkSync(linkPath);
    fs.unlinkSync(outside);
  }

  expect(result).toBeNull();
});

test("sink: a sibling directory sharing BLOG_ROOT's name prefix is not 'inside' it", () => {
  // Guards the classic prefix bug: a bare real.startsWith(BLOG_ROOT) would
  // accept /content/blog-backup/x.md, because that string also begins with
  // "/content/blog". The trailing path.sep in the prefix is what prevents it.
  const BLOG_ROOT = path.resolve(import.meta.dir, "../src/content/blog");
  const slug = "zz-prefix-sibling";
  const sibling = path.join(BLOG_ROOT, `${path.sep}..${path.sep}blog-backup`);
  const siblingFile = path.join(sibling, `${slug}.md`);
  const linkPath = path.join(BLOG_ROOT, `${slug}.md`);

  for (const p of [linkPath, siblingFile]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* not present */
    }
  }

  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(
    siblingFile,
    "---\ntitle: sib\npublishDate: 2026-10-01\n---\nPREFIX_ESCAPE_8C22\n",
  );
  fs.symlinkSync(siblingFile, linkPath);

  let result;

  try {
    const real = fs.realpathSync(linkPath);

    // Preconditions: lexically a child, really outside, and -- the trap --
    // a BARE prefix test would wrongly accept it.
    expect(path.dirname(linkPath)).toBe(BLOG_ROOT);
    expect(real.startsWith(BLOG_ROOT + path.sep)).toBe(false);
    expect(real.startsWith(BLOG_ROOT)).toBe(true);

    result = loadPost(slug);
  } finally {
    try {
      fs.unlinkSync(linkPath);
    } catch {
      /* gone */
    }
    fs.rmSync(sibling, { recursive: true, force: true });
    try {
      fs.unlinkSync(siblingFile);
    } catch {
      /* gone */
    }
  }

  expect(result).toBeNull();
});

test("sink: a symlink to a SUBDIRECTORY of BLOG_ROOT is still not a post", () => {
  // A prefix test (`real.startsWith(root + sep)`) would accept anything under
  // BLOG_ROOT, including one level down. resolveExistingPostFile() pins the
  // parent instead, so only direct children are posts.
  const BLOG_ROOT = path.resolve(import.meta.dir, "../src/content/blog");
  const slug = "zz-subdir-link";
  const subdir = path.join(BLOG_ROOT, "zz-subdir-target");
  const subdirFile = path.join(subdir, "inner.md");
  const linkPath = path.join(BLOG_ROOT, `${slug}.md`);

  fs.rmSync(subdir, { recursive: true, force: true });
  try {
    fs.unlinkSync(linkPath);
  } catch {
    /* not present */
  }

  fs.mkdirSync(subdir, { recursive: true });
  fs.writeFileSync(
    subdirFile,
    "---\ntitle: inner\npublishDate: 2026-10-01\n---\nSUBDIR_ESCAPE_5D77\n",
  );
  fs.symlinkSync(subdirFile, linkPath);

  let result;

  try {
    const real = fs.realpathSync(linkPath);

    // Precondition: genuinely under BLOG_ROOT (so a prefix test would pass)...
    expect(real.startsWith(BLOG_ROOT + path.sep)).toBe(true);
    // ...but not a direct child of it.
    expect(path.dirname(real)).not.toBe(BLOG_ROOT);

    result = loadPost(slug);
  } finally {
    try {
      fs.unlinkSync(linkPath);
    } catch {
      /* gone */
    }
    fs.rmSync(subdir, { recursive: true, force: true });
  }

  expect(result).toBeNull();
});
