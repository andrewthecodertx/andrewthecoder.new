/**
 * view.js — EJS renderer with a layout system + named slots for Bun.
 *
 * A controller action calls:
 *   return res.render('home/index', { title: '...', active: 'home' })
 *
 * Templates live under views/, named views/<name>.ejs. The action's template
 * declares its own shell via a directive at the top:
 *
 *   <%- extend('layouts/base') %>        <- shell (alias: layout('...'))
 *   <%- slot('header') %>...<%/ endslot %>  <- named region the view fills
 *
 * The layout then renders those regions:
 *   <%- slot('header') %>   <- named slot ('' if the view didn't fill it)
 *   <%- body %>             <- the view's remaining output (back ward compat)
 *
 * Resolution order for the shell:
 *   1. <%- extend(...) %> in the view (explicit)
 *   2. locals._ayout (controller override), false = raw
 *   3. NO explicit layout directive AND no _ayout -> RAW output (no default)
 *
 * So a standalone page just doesn't extend, and it renders as bare HTML.
 *
 * Tag rules:
 *   - Exactly zero or one extend/layout directive; must appear before slots.
 *   - Slots are flat (no nesting). Duplicate slot names throw.
 *   - If the view renders WITHOUT a layout, slot tags are dropped and their
 *     content is kept inline — the view is just raw HTML (no shell).
 *
 * EJS v6: use ejs.render(str, data, opts) — do NOT construct EJS directly.
 */
import ejs from "ejs";
import path from "node:path";
import fs from "node:fs";

const VIEWS_ROOT = path.resolve(import.meta.dir, "../views");
const EXTEND_RE = new RegExp(
  "<%[-=_]?\\s*(?:extend|layout)\\s*\\(\\s*(['\"])([^'\"]+)\\1\\s*\\)\\s*%>",
);
const SLOT_OPEN_RE = new RegExp(
  "<%[-=_]?\\s*slot\\s*\\(\\s*(['\"])([^'\"]+)\\1\\s*\\)\\s*%>",
);
const SLOT_CLOSE_RE = new RegExp("<%[-=_/]?\\s*endslot\\s*%>");

export function makeView(viewDir = VIEWS_ROOT) {
  let sink = { root: viewDir, views: [viewDir] };
  let cache = new Map(); // file -> { layoutName, bodySource, slots }
  let rawCache = new Map(); // layout file -> raw source

  function optsFor() {
    return {
      views: [viewDir],
      root: viewDir,
      filename: viewDir,
      _localsName: "locals",
    };
  }

  function resolve(name) {
    let file = path.join(viewDir, name.endsWith(".ejs") ? name : `${name}.ejs`);

    if (!fs.existsSync(file)) {
      throw new Error(`View not found: ${name} (looked for ${file})`);
    }

    return file;
  }

  /**
   * Parse a template once: pull out the extend directive and any named slots.
   * The body source retains slot CONTENT inline except the tags; slots are
   * extracted so they can be rendered separately into the layout.
   */
  function preprocess(name) {
    let file = resolve(name);

    if (cache.has(file)) {
      return cache.get(file);
    }

    let src = fs.readFileSync(file, "utf8");
    let layoutName = null;
    let ext = src.match(EXTEND_RE);

    if (ext) {
      layoutName = ext[2];
      src = src.slice(0, ext.index) + src.slice(ext.index + ext[0].length);
    }

    let slots = [];
    let openRe = new RegExp(SLOT_OPEN_RE.source, "g");
    let match;

    while ((match = openRe.exec(src))) {
      let name = match[2];
      let openEnd = match.index + match[0].length;
      let close = SLOT_CLOSE_RE.exec(src.slice(openEnd));

      if (!close) {
        throw new Error(
          `View '${name}': slot '${name}' has no matching <%/ endslot %>`,
        );
      }

      let start = openEnd;
      let end = openEnd + close.index;
      let content = src.slice(start, end);

      // remove the whole block from the body source
      src = src.slice(0, match.index) + src.slice(end + close[0].length);
      slots.push({ name, src: content });
      openRe.lastIndex = match.index; // re-scan from the mutated position
    }

    let t = { layoutName, bodySource: src, slots };

    cache.set(file, t);

    return t;
  }

  function renderName(name, data) {
    let locals = { ...data };
    let t = preprocess(name);
    let layoutName =
      locals._ayout === undefined ? (t.layoutName ?? null) : locals._ayout;

    // Named slots render independently so the layout can place them.
    let slots = {};

    for (let s of t.slots) {
      if (s.name in slots) {
        throw new Error(`View '${name}': duplicate slot '${s.name}'`);
      }

      slots[s.name] = ejs.render(s.src, locals, optsFor());
    }

    let bodySource = t.bodySource;
    if (!layoutName) {
      // Raw view: drop slot tags, keep their content inline.
      bodySource = bodySource
        .replace(SLOT_OPEN_RE, "")
        .replace(SLOT_CLOSE_RE, "");
    }
    let body = ejs.render(bodySource, locals, optsFor());

    if (!layoutName) {
      return body;
    }

    let layoutLocals = {
      ...locals,
      body,
      slots,
      slot: (n) => slots[n] || "",
    };

    let layoutSrc = loadLayout(layoutName);

    return ejs.render(layoutSrc, layoutLocals, optsFor());
  }

  function loadLayout(name) {
    let file = resolve(name);

    if (rawCache.has(file)) {
      return rawCache.get(file);
    }

    let src = fs.readFileSync(file, "utf8");

    rawCache.set(file, src);

    return src;
  }

  // Shared renderer passed to controllers via res.render
  let renderer = (name, data = {}) => renderName(name, data);

  return { render: renderer, renderName, sink };
}
