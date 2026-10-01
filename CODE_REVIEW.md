# Code Review: andrewthecoder.new

**Date:** 2026-09-10 (initial review) · **Re-verified:** 2026-09-10
**Scope:** `src/` (controllers, lib, views, router, http, server, config, dev), `routes.json`, `projects.json`, `demos.json`, `public/`
**Stats:** ~1,648 LOC across 53+ source/view files, 23 blog posts, 8 routes, 1 production dependency (ejs, markdown-it, markdown-it-footnote)

---

## Status summary (re-verification pass)

Most original High/Medium findings have been **fixed in the working tree** since the initial review. Remaining open items are mostly Low/cleanup plus two user-visible gaps (missing stylesheet, serveStatic content types).

| # | Finding | Severity | Status (2026-09-10 re-verify) |
|---|---------|----------|-------------------------------|
| 1 | Demo/project detail links 404 | **High** | ✅ FIXED — routes + `demoShow`/`projectShow` added |
| 2 | Stale Astro `public/index.html` | **High** | ✅ FIXED — deleted; only `assets/` remains |
| 3 | `html:false` escapes MD raw HTML | High/Med | ✅ FIXED — `html:true`; post image + `og:image` wired |
| 4 | Blog re-parsed every request | Medium | ✅ FIXED — mtime-aware `BLOG_CACHE`/`BLOG_INDEX_CACHE` |
| 5 | `loadProjects` path by accident | Medium | ✅ FIXED — `DATA_ROOT`/`PUBLIC_ROOT` in BaseController |
| 6 | Hardcoded demo/project stubs | Medium | ✅ FIXED — stubs deleted; JSON used everywhere |
| 7 | `description` passed, never rendered | Medium | ✅ FIXED — basehead uses it (with fallback) |
| 8 | Two home pages | Low/Med | ✅ FIXED — stale index.html gone |
| 9 | Router dead code (candidates) | Low | ✅ FIXED — `candidates` removed; no `_ayout` typo in code |
| 10 | serveStatic traversal / types | Low | ✅ FIXED — `..`/`%2e%2e` guard + 14 content types |
| 11 | Asymmetric caching | Low | ✅ FIXED — markdown cache added (see #4) |
| 12 | dev.js edge cases | Low | ✅ FIXED — exit code logged on unexpected crash |
| 13 | Duplicate not-found views | Low | ✅ RESOLVED — contextual `software/not-found.ejs` intentional |
| 14 | Data typos (ned/worlde, ids, Interets) | Low | ✅ FIXED — slugs corrected; IDs unique; typos gone |
| 15 | API inconsistencies | Low | ✅ FIXED — `loadDemos(n)`/`loadProjects()` share DATA_ROOT |
| A | Markdown render cache | Suggestion | ✅ DONE — mtime-aware cache |
| B | Static assets (missing site.css) | Suggestion | ✅ DONE — `public/static/site.css` added (terminal aesthetic) |
| C | Single `data/` module | Suggestion | ✅ PARTIAL — DATA_ROOT centralizes; files still separate |
| D | Router.register binding | Suggestion | ✅ WONTFIX — `req._view` guard is intentional decoupling |

---

## Critical / High — fix first

*(All original High findings are fixed. No new High issues found in re-verification.)*

---

## Medium — correctness & efficiency

*(All original Medium findings are fixed. No new Medium issues found in re-verification.)*

---

## Low — cleanup & hardening

*(All original Low findings are fixed. See the status table for the record.)*

### 9. Router dead code (remaining)

- `group()`, `use()` (global middleware), `notFound()`, `Router.head/options/put/patch/delete/all` are still **unused** by any registered route (`routes.json` is GET-only). Not harmful; either trim or document as the future API.
- (Fixed in re-verify: the dead `candidates` array in `router.handler()` was removed; there is no `_ayout` typo in the code — `view.js` correctly uses `locals._layout`.)

### 12. `dev.js` (fixed)

- `child.exited.then(...)` now logs the exit code when the child dies unexpectedly (`!stopping`), so a fast crash (e.g., port in use) is visible instead of a silent exit 0.

---

## Suggestions (bigger picture)

### B. Serve static assets properly (DONE — 2026-09-10)

- `public/static/site.css` added — full vanilla stylesheet matching the production terminal aesthetic (palette `--terminal-*`, JetBrains Mono stack, prose/footnotes/grid/detail/error styles, footer, reduced-motion).
- `serveStatic` now maps 14 content types (html, css, js, mjs, json, png, webp, svg, ico, txt, xml, woff, woff2, ttf). `Cache-Control` headers (immutable for hashed assets) are still a future nicety for prod.

### D. `Router.register` binding (WONTFIX)

- The `req._view` guard is one property check per request; hoisting it would couple Router to the view singleton. Router stays decoupled (receives only controllers) — the guard is intentional and cheap. Verified `server.js` sets `req._view` unconditionally in global middleware, so the guard is technically dead branching, but removing it adds coupling for a nanosecond win. Not worth it unless Router learns a proper render-injection API.

### C. Consider a single `data/` module (downgraded)

- `DATA_ROOT`/`PUBLIC_ROOT` in `BaseController` already centralizes path resolution, so the original path-fragility (#5) is fixed. If `projects.json` + `demos.json` + `routes.json` grow more accessors, a tiny `src/data.js` that resolves each once and exports typed accessors is still a good consolidation move — lower priority now.

---

## Verified Summary (re-verification, 2026-09-10)

- ✅ Routes: 8 entries incl. `/demos/:slug` + `/projects/:slug`; SoftwareController reads JSON, 404s via contextual view
- ✅ `public/index.html` gone; `public/` = `assets/` + `static/site.css`
- ✅ markdown-it `html: true`; blog show renders post image; basehead gets `pageImage` → `og:image`
- ✅ `BLOG_CACHE` + `BLOG_INDEX_CACHE` with mtime invalidation; deleted-file detection present
- ✅ `loadDemos(n)`/`loadProjects()` resolved from `DATA_ROOT`; `loadBlogPosts(n, f)` shared
- ✅ `description` fallback wired into basehead; `pageUrl`/`pageImage` supported
- ✅ `demos.json` slugs correct (`/demos/nes`, `/demos/wordle`, "Enigma M3 Machine"); `id="projects"` unique
- ✅ `candidates` removed from router; `view.js` uses `_layout` (no typo)
- ✅ **NEW** `public/static/site.css` — site now renders styled; served as `text/css`
- ✅ **NEW** `serveStatic` — `..`/`%2e%2e`/`%2e%2f` traversal guard (404s verified) + 14 content types
- ✅ **NEW** `dev.js` — logs unexpected child exit codes
- ⚠️ Git: 1 commit (`92cb8b4`); 34 working-tree changes uncommitted; `CODE_REVIEW.md`, `.obsidian/`, `public/assets/`, `src/demos.json`, `src/controllers/BaseController.js`, `src/content/blog/sudoku-backtracking-in-python.md` untracked — commit before the working tree grows further
- ⚠️ Demo detail pages render title + language only (`demos.json` entries lack `description`/`demo`/`github`) — data gap, not a bug

---

## Priority order for the next fix pass

1. **Commit the working tree** (34 files) — the review doc itself is untracked
2. **Add `description` fields to `demos.json`** (demo detail pages are thin)
3. **Cache-Control headers** for static assets (immutable for hashed, no-cache for index)
4. **Trim or document unused router verbs** (`group`/`use`/`head`/`options`/`put`/`patch`/`delete`/`all`)
5. **Optional `src/data.js`** consolidation if JSON accessors grow