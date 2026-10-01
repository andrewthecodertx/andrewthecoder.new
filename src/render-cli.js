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

const controllers = loadControllers(ctx);
const ctrl = controllers.software;

// Add formatDate helper to locals for template use
const locals = { formatDate: markdown.formatDate };
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
    locals.pageImage ||= post.meta.image;
    locals.hasImage ||= ctrl.assetExists(post.meta.image);
  }

  if (viewName === "blog/index") {
    locals.pageTitle ||= "Blog";
    const posts = locals.posts || markdown.loadBlogPosts();

    // Same category grouping/ordering as BlogController.index
    const raw = posts.reduce((acc, post) => {
      const cats = post.meta.categories || ["Uncategorized"];
      cats.forEach((cat) => {
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(post);
      });
      return acc;
    }, {});
    const categoryOrder = {
      "Software Development": 1,
      Tutorials: 2,
      "Artificial Intelligence": 3,
      Science: 4,
      Theology: 5,
      Poetry: 6,
    };
    locals.postsByCategory = Object.fromEntries(
      Object.keys(raw)
        .sort((a, b) => {
          const ra = categoryOrder[a] ?? 999;
          const rb = categoryOrder[b] ?? 999;
          if (ra !== rb) return ra - rb;
          return a.localeCompare(b);
        })
        .map((cat) => [cat, raw[cat]]),
    );
    locals.posts ||= posts;
    locals.active ||= "blog";
  }
}

if (viewName === "home/index") {
  // Load recent featured posts for home page sidebar
  locals.recentposts ||= markdown.loadBlogPosts(4, true);
  locals.projects ||= ctrl.loadProjects();
  locals.demos ||= ctrl.loadDemos(4);
  locals.pageTitle ||= "Home";
  locals.active ||= "home";
}

if (viewName.startsWith("software/")) {
  // Load demo/project data so software views render standalone.
  if (viewName === "software/demos") {
    locals.demos ||= ctrl.loadDemos();
    locals.pageTitle ||= "Demos";
    locals.active ||= "demos";
  } else if (viewName === "software/projects") {
    locals.projects ||= ctrl.loadProjects();
    locals.pageTitle ||= "Projects";
    locals.active ||= "projects";
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
