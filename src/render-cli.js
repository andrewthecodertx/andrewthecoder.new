/**
 * render-cli.js — render a view to stdout without starting a server.
 *
 *   bun src/render-cli.js home/index
 *   bun src/render-cli.js blog/show slug=process-time-and-the-self
 *   bun src/render-cli.js home/about active=about title="About"
 *
 * Loads the real markdown pipeline (so blog/* views get posts from the actual
 * content dir), then prints the fully-rendered HTML (layout + slots included).
 *
 * Known limitation: the static middleware (public/) never runs here, so
 * <link href="/static/site.css"> etc. are emitted as-is — that's expected
 * when testing template structure, not asset delivery.
 */
import { makeView } from "./lib/view.js";
import * as markdown from "./lib/markdown.js";
import { loadControllers } from "./controllers/index.js";

const [, , viewName, ...argPairs] = process.argv;

if (!viewName) {
  console.error("Usage: bun src/render-cli.js <view> [key=value ...]");
  process.exit(1);
}

const view = makeView();
const ctx = { view, markdown };

loadControllers(ctx);

// Build locals from key=value args (+ hardcoded blog data for blog/* views)
const locals = {};
for (const pair of argPairs) {
  const i = pair.indexOf("=");

  if (i === -1) {
    locals[pair] = true;
  } else {
    locals[pair.slice(0, i)] = pair.slice(i + 1);
  }
}

if (viewName.startsWith("blog/")) {
  const slug = locals.slug || "process-time-and-the-self";
  const post = markdown.loadPost(slug);

  if (post && viewName === "blog/show") {
    locals.post = post;
    locals.pageTitle ||= post.meta.title;
    locals.description ||= post.meta.description;
    locals.active ||= "blog";
  }

  if (viewName === "blog/index") {
    locals.pageTitle ||= "Blog";
    locals.posts ||= markdown.loadAllPosts();
    locals.active ||= "blog";
  }
}

try {
  const html = view.render(viewName, locals);

  process.stdout.write(html);
  if (!html.endsWith("\n")) {
    process.stdout.write("\n");
  }
} catch (err) {
  console.error(`render failed: ${err.message}`);
  process.exit(1);
}
