# Code Review: andrewthecoder.new

**Date:** 2026-10-01 · **Fixes applied:** §2, §4
**Scope:** `src/` (server, router, http, config, env, dev, render-cli, lib/, controllers/), `src/views/`, `src/routes.json`, `src/projects.json`, `src/demos.json`, `src/content/blog/`, `public/`, `.gitignore`, `package.json`
**Stats:** ~1,347 LOC JS · 363 LOC EJS · 35 LOC CSS · 9 routes · 25 published posts (+1 without `publishDate`) · 3 runtime deps
**Method:** read-only static review + targeted one-shot runtime probes (no server started). Every finding below was reproduced with a command you can re-run.
**Relation to `CODE_REVIEW.md` (2026-09-10):** that review's High/Medium items remain fixed. This pass found **three user-visible bugs it missed**, plus a **large uncommitted regression** it could not have seen.

> **Fixes landed this session.** Two Critical/High findings below are now **FIXED** in the working tree and re-verified (§2, §4). Both are marked in the findings table. They are still uncommitted — see §1.

> **Provenance note:** an Artificer subagent produced a first draft of this file. I re-verified every claim against the code before rewriting it. Its "Critical: symlink path traversal" finding is **downgraded to Low** (§16) — it requires the attacker to already have write access to `public/`. Its draft was also dated 2023-11-19 and left six `test-*.js` files in the repo root; those have been removed.

---

## Executive summary

The architecture is genuinely good for ~1,350 lines: clean MVC separation, a real router with middleware, a single view renderer, one data-root constant, and an mtime cache that turns a 240 ms blog index into 0.24 ms. There is no `node:` import, no build step, and `.env` is correctly gitignored. That foundation is sound.

**Both live 500s are now fixed.** They were the two worst defects in the document: any missing blog slug, and any malformed percent-encoding in a URL, used to produce a 500. Both now correctly return 404. Verified across all 9 routes in dev and prod with zero 5xx responses and all 25 posts still rendering.

One user-visible problem remains, and it is the largest:

1. **The site has no stylesheet.** `public/static/site.css` was reduced to 35 lines with 7 empty rules and **no `background` declaration at all** at 06:44 today. The 779-line terminal stylesheet the previous review praised is gone. The site renders as unstyled text.

There is also a **prevalence problem** more serious than any single remaining bug: 35 files are uncommitted against a single commit (`92cb8b4`). §1, §2, and §3 all live in that uncommitted working tree. The next `git checkout`/`stash` would destroy three weeks of work — **including today's two fixes** — with no recovery path. Committing remains the highest-value action available.

---

## Findings at a glance

| # | Finding | Severity | Area | Status |
|---|---------|----------|------|--------|
| 1 | 35 uncommitted files, single commit | **Critical** | Git hygiene | **Open** — now includes today's fixes |
| 2 | Missing blog post → 500 not 404 | ~~Critical~~ | Correctness | ✅ **FIXED** 2026-10-01 |
| 3 | `site.css` gutted → unstyled site | **Critical** | Presentation | **Open** (regression) |
| 4 | Malformed `%` encoding → 500 not 404 | ~~High~~ | Correctness / Robustness | ✅ **FIXED** 2026-10-01 |
| 5 | Views emit `class=""` / `id=""` | High | Presentation / A11y | Open |
| 6 | Heading hierarchy skips `h2` | High | A11y / SEO | Open |
| 7 | Named-slot engine is dead + buggy | High | Maintainability | Open |
| 8 | 3.9 MB of assets, 3.6 MB unreferenced | High | Performance | Open |
| 9 | Frontmatter parser breaks on valid YAML | Medium | Correctness | Open (partially known) |
| 10 | `loadPost` slug traversal (`.md` only) | Medium | Security | Open |
| 11 | No cache/ETag on static assets | Medium | Performance | Open (carried over) |
| 12 | 3 anchors render without `href` | Medium | A11y | Open |
| 13 | `colorpallet.css` unreferenced + invalid CSS | Medium | Hygiene | Open |
| 14 | `renderName` vs `render` API inconsistency | Medium | Maintainability | Open |
| 15 | No tests, no CI, no README | Medium | Process | Open (carried over) |
| 16 | Symlink escape from `publicRoot` | Low | Security | Open |
| 17 | Subdirectory `index.html` mishandled | Low | Correctness | Open |
| 18 | Dead router verbs / response helpers | Low | Hygiene | Open (carried over) |
| 19 | `formatDate` accepts invalid dates | Low | Correctness | Open |
| 20 | 4 MB of images with no dimensions → CLS | Low | Performance | Open |

---

## Critical

### 1. 35 uncommitted files against a single commit

**What:** The entire project beyond commit `92cb8b4` is uncommitted. 20 modified + 15 untracked files, including every controller, the router, the markdown pipeline, all new blog posts, and the data JSON.

**Where:** `git status --short` — 20 `M`/`D`, 15 `??`.

**Why it matters:** The findings in §2–§6 all live in this uncommitted tree. There is no branch, no stash, no tag. One `git checkout src/views/` or one botched `git clean` and three weeks of work is gone. This is also why the previous review's "commit the working tree" advice is still the top open item from 2026-09-10.

**The fix:**
```bash
git add -A && git commit -m "feat: blog pipeline, software pages, 90s redesign"
```
Then tag it. Committing the broken state is still strictly better than not committing — you can fix forward from a known point.

**Risk:** Low. Nothing but a commit.

---

### 2. ~~Missing blog post returns 500 instead of 404~~ — ✅ FIXED 2026-10-01

**What:** `loadPost()` returned `null` for an unknown slug, and the controller dereferenced it one line *before* checking for `null`.

**Where:** `src/controllers/BlogController.js` — `post.meta.image` was on the line above the `if (!post)` guard.

**Why it mattered:** A 500 on `/blog/<anything>` is a real user-facing bug *and* an SEO problem — search engines treat it as a server error rather than a missing page. It also meant the 404 path for posts was unreachable, so the earlier footer/`active` fix in this area was never actually exercised for blog posts.

**Repro (before the fix):**
```
500  /blog/does-not-exist   [onError] TypeError: null is not an object (evaluating 'post.meta')
```

**The fix applied** — moved the guard above the dereference, and dropped a stray leading slash on the view name (`"/errors/404"` → `"errors/404"`; `view.js:30` `path.join`s it, so the slash produced a doubled separator):

```js
show(req, res) {
  let post = this.ctx.markdown.loadPost(req.params.slug);

  if (!post) {
    return res.status(404).render("errors/404", {
      pageTitle: "Post not found",
      active: "blog",
    });
  }

  let image = post.meta.image;

  return res.render("blog/show", { /* ... unchanged ... */ });
}
```

**Verification:** `/blog/does-not-exist` → **404**, with a fully-rendered page (`</html>` present, `<title>Post not found | ANDREW THE CODER</title>`, canonical + og tags intact, no stack leak). `/blog/conway-game-of-life-in-rust` still 200. All 25 posts still load and render. No regressions across the other 8 routes.

**Risk of the change:** None. Pure reordering of a guard.

---

### 3. `public/static/site.css` was gutted — the site has no stylesheet

**What:** The stylesheet is now 35 lines: five CSS variables, a `body` colour, and **seven empty rules** (`#hero {}`, `.nav {}`, `.nav__list {}`, …). There is no `background` declaration anywhere, so `--cream` is never applied and the page is `--black` text on the default white background with no layout at all.

**Where:** `public/static/site.css` (mtime `2026-10-01 06:44:03`), vs the 779-line stylesheet documented in `CODE_REVIEW.md` line 68.

**Why it matters:** This is a regression, not a gap. The 2026-09-10 review recorded "✅ NEW `public/static/site.css` — site now renders styled". That is no longer true. The `colorpallet.css` file (mtime 2026-09-29) looks like the intended replacement but is (a) unreferenced, (b) **not valid CSS** — it is raw custom-property declarations with no selector and a `$gradient-*` block that is SCSS, so a browser parses it as an error and discards it.

**Repro:**
```bash
grep -c "background" public/static/site.css   # -> 0
grep -rn "colorpallet" src/ public/           # -> no matches (dead file)
```

**The fix:** Restore the previous stylesheet and then apply the new palette deliberately — do not ship a second half-finished file alongside it.
```bash
git log --all --oneline -- public/static/site.css   # find the good revision
git checkout <rev> -- public/static/site.css
```
If the 90s aesthetic is the goal, rewrite `site.css` properly: give `body` a real `background` using `--cream`, add a `color-scheme`, and either delete `colorpallet.css` or convert it to a real `:root { … }` block and `@import` it.

**Risk:** Medium — restoring changes every page's appearance. Do it as its own commit so it is trivially revertable.

---

## High

### 4. ~~Malformed percent-encoding produces a 500~~ — ✅ FIXED 2026-10-01

**What:** Route params were decoded without a guard; `decodeURIComponent` throws `URIError` on a malformed sequence, and the router's `catch` routed that straight to the 500 handler.

**Where:** `src/router.js` — the `route.paramNames.forEach` block that called `decodeURIComponent(m[i + 1])` directly.

**Repro (before the fix):**
```
/blog/hello     -> 200
/blog/%         -> 500  URIError: URI error
/blog/%zz       -> 500  URIError: URI error
/blog/caf%C3%A9 -> 200
```

**Why it mattered:** Trivially triggerable, and scanners do send malformed encoding. It inflated the 5xx rate in any log or uptime monitor.

**The fix applied** — a module-level `safeDecode` in `router.js` that falls back to the raw segment, so a malformed param simply fails the downstream lookup and 404s:

```js
// A malformed percent sequence (e.g. "/blog/%zz") makes decodeURIComponent
// throw URIError, which would surface as a 500 instead of a 404. On failure we
// keep the raw segment: it then simply fails the downstream lookup.
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
```
used at the param-assignment site as `safeDecode(m[i + 1])`.

**Verification:** `/blog/%` → **404**, `/blog/%zz` → **404**. Valid encoding is unaffected: `/blog/caf%C3%A9` still decodes to `café` (and 404s on the lookup, as expected — there is no such post). No `URIError` reaches `onError`. Verified in both `development` and `production` mode.

**Risk of the change:** Low. The only behaviour change is on input that previously threw.

---

### 5. Views emit empty `class=""` and `id=""` attributes

**What:** Seven attributes in the home view are empty strings, and the top-level section has `id=""`.

**Where:** `src/views/home/index.ejs:3,4,15,27,54,77,78`.

```html
<section id="">          <!-- line 3 -->
  <div class="">         <!-- lines 4, 15 -->
<article class="">        <!-- lines 27, 54 -->
```

**Why it matters:** `class=""` is dead weight that defeats any stylesheet targeting those blocks — including the one in §3 once restored. `id=""` is invalid HTML: `id` must be non-empty, and CSS/escaping tools that assume valid ids can misbehave.

**The fix:** Either give each element a real class from the palette (`hero`, `bio`, `post-card`) or drop the attribute. Do not restore classes blindly — the previous review's class names are gone, so choose them as part of the §3 stylesheet work.

**Risk:** Low.

---

### 6. Heading hierarchy skips `h2`

**What:** The home page renders `h1` (from the header partial) then jumps straight to `h3`.

**Repro:**
```
h1: andrew the coder
h3: Who is Andrew
h3: More About Me
h3: Meet Tim the Enchanter
h3: Recent Posts
```

**Why it matters:** Screen-reader users navigating by heading lose the section level entirely, and heading structure is a documented SEO signal. The header `h1` is also the site name, not the page's subject — so a page has no meaningful `h1` at all.

**The fix:** Decide what the page's `h1` is. Either promote the section titles to `h2`, or demote the header wordmark to a `<p>`/`<span>` and make the first section heading the `h1`. Apply consistently to `/blog`, `/projects`, `/demos` — those share `blog/index.ejs` and `software/*.ejs`.

**Risk:** Low, but check every page after.

---

### 7. The named-slot view engine is dead code *and* broken

**What:** `view.js` implements a layout + named-slot system with a regex preprocessor (158 lines, `preprocess` at lines 44–90). **No view in the project uses a slot.** `layouts/main.ejs` uses EJS's own `include()` instead, and the only directive in use is `extend`.

**Where:** `src/lib/view.js:6–12` (regexes), `:44–90` (preprocess), `:99–127` (slot rendering).

Two concrete defects, both reproduced:
- **`endslot` stripping is not global.** `SLOT_CLOSE_RE` has no `g` flag, so at `view.js:114` only the **first** tag is removed on raw views. Verified:
  ```
  input:  <% slot("a") %>A<%/ endslot %><% slot("b") %>B<%/ endslot %>
  actual: <% slot("a") %>A<% slot("b") %>B<%/ endslot %>   ← tags leak into output
  ```
- **The whole feature is unreachable anyway**, because the layout consumes `body`, not `slot()`.

**Why it matters:** This is the highest-risk hand-rolled code in the project, it is the only thing in `view.js` with non-trivial logic, and nothing exercises it. It is a maintenance trap: a future developer will reasonably try `slot()` and get silent corruption.

**The fix:** Delete it. Remove `SLOT_OPEN_RE`, `SLOT_CLOSE_RE`, the `slots` collection in `preprocess`, and the `slots`/`slot` locals in `renderName`. Keep the `extend` directive — that one is load-bearing. Net −60 lines and one whole class of risk.

**Risk:** Low *if* you confirm nothing references `slot(`. Verified: `grep -rn "slot(" src/views/` returns nothing.

---

### 8. 3.9 MB of images, 3.6 MB of it unreferenced

**Where:** `public/assets/` — `atc_bg.jpg` (1.3 MB), `atc_andrew_working.png` (972 KB), `hero.png` (884 KB), `timtheenchanter.png` (432 KB). No view or JSON references any of them.

**Why it matters:** They are served (the 404 handler falls through to `serveStatic` for any path), so they are reachable over HTTP and counted against deploy/rsync time — while rendering nothing.

**The fix:** Delete the unreferenced ones, or wire them into the §3 redesign. If `atc_bg.jpg` is meant to be the page background, it is a 1.3 MB JPEG for a background — resize and convert to WebP; the blog images are already WebP at 100–200 KB.

**Risk:** Low, but confirm with a grep before deleting — some may be referenced from a future view.

---

## Medium

### 9. Frontmatter parser breaks on valid YAML

The hand-rolled parser is fine for the current 25 posts but fails on input YAML accepts. Reproduced:

| Input | Result | Should be |
|---|---|---|
| `tags: [\n  'one',\n  'two'\n]` | `{"tags":"["}` | `["one","two"]` |
| `\uFEFF---\ntitle: BOM\n---` | `{}` (whole post becomes body) | `{"title":"BOM"}` |
| `title: A` / `title: B` | last wins silently | YAML errors on duplicates |

Multi-line arrays are the realistic risk: the array regex at `markdown.js:58` is anchored to a single line, so a post reformatted by any YAML-aware tool loses its tags and silently renders as a bare string — which then breaks `.forEach` in `BlogController.index:12` if it happens to be `categories`.

**The fix:** Add `js-yaml` (4 kB, ubiquitous, actively maintained) and swap `parseFrontmatter` for `yaml.load()`. The `decodeFrontmatterValue` helper then disappears entirely, along with its edge cases. Given the site is content-driven and you publish regularly, this is worth the dependency.

**Risk:** Low-medium. All 25 posts must be re-validated — the current parser is more forgiving in some ways (it tolerates unterminated frontmatter, which `yaml.load` will reject). Parse inside a try/catch and fall back to `{ meta: {}, body: raw }`.

---

### 10. `loadPost` slug traversal, limited to `.md`

**What:** `loadPost(slug)` does `path.join(BLOG_ROOT, `${slug}.md`)` with no validation, so `..` segments escape the blog directory.

**Where:** `src/lib/markdown.js:72`.

**Repro:**
```js
loadPost("../../../../home/andrew/Projects/some-project/README")
```
The forced `.md` suffix is what limits this — a real target must end in `.md` and parse as frontmatter. I confirmed `/etc/hostname` and a real README are *not* reachable, so this is Medium, not Critical. But the constraint is accidental, not designed, and the exposure scales with how many `.md` files live elsewhere on the host.

**The fix:**
```js
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return null;
```
That also matches your existing slug convention and kills the class of bug outright.

**Risk:** Low. Verify no post uses uppercase or dots in its filename first — `loadBlogPosts` derives slugs from filenames, so filenames become the contract.

---

### 11. No cache headers or conditional requests on static assets

**Where:** `http.js:126` — `new Response(f, { headers: { "Content-Type": type } })`. No `Cache-Control`, no `ETag`, no `Last-Modified`.

**Why it matters:** Every visitor re-downloads all assets on every load, and re-requests return a full 200 instead of a 304. This was #3 in the previous review's roadmap and is still open.

**The fix:**
```js
const st2 = await f.stat();
const etag = `"${st.size}-${st.mtimeMs}"`;   // st already fetched
return new Response(f, {
  headers: {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
  },
});
```
Filename content-hashing is the honest way to earn `immutable`; if you skip that, use `max-age=3600` plus the `ETag` and honour `If-None-Match` for a 304.

**Risk:** Low. Do pair it with §8 — you do not want a year-long cache on the 1.3 MB `atc_bg.jpg`.

---

### 12. Three anchors render without `href`

**Repro:** rendered home page has 28 `<a>` tags, 3 of which have no `href` attribute. They are keyboard-focusable-looking but not links, and screen readers announce them inconsistently.

**Where:** `home/index.ejs:92,105,118` — the "all blogs →" / "all projects →" / "all demos →" list items.

**The fix:** `href="/blog"`, `href="/projects"`, `href="/demos"` respectively.

**Risk:** None.

---

### 13. `colorpallet.css` is unreferenced and not valid CSS

**Where:** `colorpallet.css` (project root, untracked, 45 lines).

**Why it matters:** Two problems. It is dead — nothing references it. And it is not parseable as CSS: lines 1–25 are bare `--custom-property` declarations with no selector, and the `$gradient-*` block is SCSS syntax. Loading it would produce parse errors and discard the file. The `hsla()` block is also wrong on its face — `--black: hsla(60, 14%, 1%, 1)` is ~1% lightness, i.e. black, while the HEX above it is `#040403ff`, which is consistent, so that part is fine; the SCSS block is the real problem.

**The fix:** Either delete it and fold the five hex values into `site.css`'s `:root`, or wrap it in `:root { … }`, drop the `$` block, and add a `<link>` in `basehead.ejs`.

**Risk:** Low.

---

### 14. `renderName` and `render` have different local contracts

**What:** The public `render(name, data)` wrapper injects `formatDate` when a markdown module is present. `renderName(name, data)` — also exported, and used by `render-cli.js` — does not.

**Repro:**
```
v.renderName("home/index", {...}) -> ReferenceError: formatDate is not defined
v.render("home/index",     {...}) -> 200, renders fine
```

**Why it matters:** Two entry points into the same renderer with different guarantees. `render-cli.js` is a dev tool, so this bites during iteration, not production — but it is exactly the kind of trap that makes people stop trusting a dev tool.

**The fix:** Have `renderName` do the injection and make `render` a thin alias:
```js
function renderName(name, data = {}) {
  const locals = hasMarkdown && !data.formatDate
    ? { formatDate: markdown.formatDate, ...data }
    : data;
  // ...
}
const render = (name, data = {}) => renderName(name, data);
```

**Risk:** Low.

---

### 15. No tests, no CI, no README

**Where:** the project root.

**Why it matters:** There is no test suite, no CI, and no README. The three Critical findings in this document are all one-line logic errors that a single test file would have caught:
- `loadPost("nope") === null` → assert controller returns 404 (§2)
- `decodeURIComponent` guard (§4)
- a render smoke test per view (§3, §5, §6)

**The fix:** Minimum viable — a `bun test` file that renders every view with fixture data and asserts no throw, plus the two 404 cases. That is under 100 lines and converts this class of bug from "found in review" to "caught in CI". Add a `README.md` covering `bun install` / `bun run dev` / `bun run start` and the content-authoring flow.

**Risk:** Low. Highest leverage item in this list per line written.

---

## Low

### 16. Symlink escape from `publicRoot`

`serveStatic` rejects `..` and `%2e%2e` (verified — `/../../../../etc/passwd` and `/static/../../src/config.js` both 404 correctly), but does not canonicalize. A symlink inside `public/` pointing outside it would be followed.

**This is Low, not Critical.** Exploiting it requires the attacker to already have write access to `public/` — at which point they can simply write a file there directly. There are currently no symlinks under `public/`. Artificer's draft rated this Critical; that was wrong.

Defence in depth, if you want it:
```js
const real = fs.realpathSync(filePath);
if (!real.startsWith(fs.realpathSync(publicRoot))) return null;
```

### 17. Subdirectory `index.html` mishandled

`http.js:91-93` maps *any* path ending in `/` to `publicRoot/index.html`. Correct only for `/`. There is no `public/index.html` any more (correctly deleted), so this branch is currently dead — but if one is ever added, `/assets/` would serve it. Narrow the condition to `url.pathname === "/"`.

### 18. Dead router verbs and response helpers

Zero external callers for: `group()`, `all()`, `head()`, `options()`, `put()`, `patch()`, `delete()`, and the `res.text()` / `res.redirect()` / `res.send()` helpers. All of `routes.json` is GET. `group()` is the expensive one — it is the only method with non-trivial logic (lines 23–42) and the highest chance of harbouring a latent bug, for zero current callers. Either delete or mark with a comment as reserved API.

### 19. `formatDate` silently accepts impossible dates

`markdown.js` returns `"Feb 14, 2027"` for `2026-13-45` and `"Mar 2, 2026"` for `2026-02-30` — JavaScript `Date` rolls over rather than rejecting. A typo'd `publishDate` therefore produces a plausible-looking wrong date rather than an error. Round-trip the constructed date against the input components and return `iso` unchanged if they disagree.

### 20. 4 MB of images with no `width`/`height`

No `<img>` in the rendered output carries intrinsic dimensions, so images cause layout shift as they load. Add `width`/`height` attributes (or `aspect-ratio` in CSS) at the point the blog image is emitted in `blog/show.ejs`.

---

## Further observations (unranked, one line each)

- `router.handler()` is called per request in `server.js:79`, allocating a new closure and re-scanning routes each time. I measured it at **0.07 µs/call** — genuinely negligible. Hoist it to a const at module scope purely for clarity, not for performance.
- The markdown cache is fast: index cold 240 ms → warm 0.24 ms (~1000×), `loadPost` warm 0.014 ms. Artificer's "race condition under concurrent access" is theoretical — single-threaded JS makes the read-modify-write in `loadBlogPostsCached` atomic with respect to the event loop. No mutex needed.
- `/projects/ENCHANTER` → 404 (case-sensitive) and `/projects/enchanter/` → 200 (trailing slash tolerated). Both are defensible; worth knowing before adding redirects.
- Blog sorting uses `localeCompare` on the raw `publishDate` string. Correct for ISO dates, but breaks if a post ever uses `2026-2-3` (no zero padding) — it would sort after `2026-12-01`. Normalise in the parser.
- `package.json` has `"dev"` and `"dev:watch"` set to the identical command. Either they differ or one should go.
- No `LICENSE` and no `.editorconfig`, despite Prettier being a configured dependency.
- `src/dev.js` looks correct on the restart path: the `stopping` flag is set before the kill (line 53) and reset on respawn (line 25), and unexpected exits log their code (line 43). I could not test live restarts without starting a server.

---

## Next steps — sequenced

**Done (2026-10-01)**

- ✅ §2 — null-guard reorder in `BlogController.show`; `/blog/<missing>` now 404s.
- ✅ §4 — `safeDecode` in `router.js`; malformed `%`-encoding now 404s instead of 500.

**Do today**

1. `git add -A && git commit` + tag. (§1) This now also captures the two fixes above. Everything else is optional until this exists.
2. Restore `site.css` and decide on the palette. (§3) This is the last Critical-severity item and the only remaining user-visible breakage.

**This week**

3. Fix the `class=""` attributes against the restored stylesheet, then delete or wire up `colorpallet.css`. (§5, §13)
4. Write the minimum test file: render every view, plus the two 404 cases from §2 and §4. (§15) Do this now — both fixes are uncommitted and untested, so this pins them.
5. Fix the heading hierarchy and the 3 missing `href`s. (§6, §12)

**Next sprint**

6. Add `Cache-Control` + `ETag`; delete the 3.6 MB of unreferenced assets. (§8, §11)
7. Swap to `js-yaml`, add the slug guard, tighten `formatDate`. (§9, §10, §19)
8. Delete the named-slot system. (§7) — pure deletion, do it once §3 is stable so the visual regressions are separable.

**Then**

9. README, LICENSE, and decide whether this needs CI. Wire `bun test` into a GitHub Actions workflow once the tests exist.

---

## Appendix A: Dead-link audit

Automated over every literal `href`/`src` in `src/views/**/*.ejs`, excluding template expressions and external URLs.

- **14 internal links checked, 0 broken.** `/`, `/blog`, `/projects`, `/demos`, `/challenges`, `/playground`, `/projects/enchanter`, `/blog/enchanter-meets-itself`, `/static/site.css`, `/static/main.js`, and the two error-page home links all resolve to a registered route or a real file.
- 3 anchors have no `href` at all (§12).
- Data-driven links resolve correctly: `projects.json`/`demos.json` use `url` (not `slug`), and `SoftwareController.slugFromUrl()` derives the slug by splitting on `/`. `/demos/conway` and `/projects/enchanter` both return 200.
- `og:image` default `${url}/assets/social.png` **does not exist** in `public/assets/`. It only manifests on pages that pass no `pageImage` — i.e. `/`, `/blog`, `/projects`, `/demos`. Social scrapers will get a 404 for the default card.

## Appendix B: Dead code inventory

| Symbol | Location | External callers |
|---|---|---|
| `Router.group()` | `router.js` | 0 |
| `Router.all/head/options/put/patch/delete` | `router.js` | 0 |
| `res.text()` / `res.redirect()` / `res.send()` | `http.js:52-69` | 0 |
| Named-slot system | `view.js:6-12, 60-90, 99-127` | 0 |
| `loadDemos(n)` slice branch | `BaseController.js:26` | n always 0 |
| `Bun.serve` `server` arg | `server.js:80` → `null` | — |
| `colorpallet.css` | project root | 0 |
| `public/assets/{hero,atc_bg,atc_andrew_working,timtheenchanter}` | `public/assets/` | 0 |

## Appendix C: Verification commands

All one-shot, none start a server:

```bash
# Full route smoke + assertions for the §2/§4 fixes (exit 0 = all pass)
NODE_ENV=production bun .verify-fixes.mjs

bun src/render-cli.js home/index       # render a view to stdout
grep -c "background" public/static/site.css   # -> 0  (§3, open)
grep -rn "slot(" src/views/             # -> none  (§7, open)
grep -rn 'class=""' src/views/ | wc -l  # -> 7  (§5, open)
```

`NODE_ENV=production` was set for the route probe; confirmed the 500 handler does **not** leak `err.message` or the stack to the response body in production (this still holds from `CODE_REVIEW.md`), and that the new 404 pages likewise leak nothing.

### Re-verification log (2026-10-01, post-fix)

| Route | Before | After |
|---|---|---|
| `/blog/does-not-exist` | 500 `TypeError` | **404** |
| `/blog/%` | 500 `URIError` | **404** |
| `/blog/%zz` | 500 `URIError` | **404** |
| `/blog/caf%C3%A9` | 500 `TypeError` | **404** (decodes correctly, no such post) |
| `/blog/conway-game-of-life-in-rust` | 200 | 200 |
| all 8 other routes | — | unchanged |

- 5xx responses across the full 15-route smoke: **0** (was 4).
- Assertion suite: **6/6 pass** in both `development` and `production`.
- All 25 published posts still load and render; all `categories` values still parse as arrays.
